import { NextRequest, NextResponse } from 'next/server';
import { getCuratorVaults, getTopVaults } from '@/lib/defillama';
import { getAllVaultsTvl } from '@/lib/dune';
import { getVaultRiskWithCreditRatings, type VaultWithCreditRating } from '@/lib/risk';
import { getVaultToCuratorMap } from '@/lib/morpho';
import { DataSourceTracker } from '@/lib/data-source-tracker';
import { decimalToPercent } from '@/lib/fees';

// Symbol prefix to curator mapping for DeFiLlama data
// This catches vaults where the symbol encodes the curator name
const SYMBOL_PREFIX_TO_CURATOR: Record<string, string> = {
  'steak': 'Steakhouse Financial',
  'bbq': 'Steakhouse Financial',  // Steakhouse High Yield
  'gt': 'Gauntlet',               // gtUSDC, gtWETH, etc.
  'mw': 'Moonwell',               // mwUSDC, mwETH
  'sm': 'Seamless',               // smUSDC, smWETH
  're7': 'RE7 Labs',
  'sen': 'Sentora',               // senPYUSD
  'mev': 'MEV Capital',
  'spark': 'SparkDAO',
  'vb': 'Gauntlet',               // Vault Bridge (Gauntlet managed)
  'yog': 'Yearn',                 // Yearn OG vaults
  'ymv': 'Yearn',                 // Yearn vaults
  'exm': 'Gauntlet',              // Extrafi (Gauntlet curated)
  'ap': 'Apostro',                // Apostro vaults
  'hyper': 'Hyperithm',
  'p': 'Pangolins',               // pUSDC
  '9s': '9Summits',
  'cs': 'Clearstar',
  'kd': 'Kedao',
};

// Morpho vault APY data interface
interface MorphoVaultApy {
  address: string;
  symbol: string;
  name: string;
  tvlUsd: number;
  apy: number;
  netApy: number;
}

// In-memory cache for Morpho APY data
let morphoApyCache: { data: MorphoVaultApy[]; timestamp: number } | null = null;
const MORPHO_APY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Infer curator from symbol prefix
function getCuratorFromSymbol(symbol: string): string | null {
  const lowerSymbol = symbol.toLowerCase();

  // Check prefixes in order of specificity (longer prefixes first)
  const sortedPrefixes = Object.keys(SYMBOL_PREFIX_TO_CURATOR)
    .sort((a, b) => b.length - a.length);

  for (const prefix of sortedPrefixes) {
    if (lowerSymbol.startsWith(prefix)) {
      return SYMBOL_PREFIX_TO_CURATOR[prefix];
    }
  }

  return null;
}

// Check if this is a raw lending market (no curator) vs a vault
// Raw markets are identified by simple asset symbols with 0% APY
function isRawLendingMarket(vault: { symbol: string; apy: number | null }): boolean {
  const rawAssetSymbols = ['cbbtc', 'wbtc', 'lbtc', 'weth', 'wsteth', 'usdc', 'usdt', 'dai', 'eth'];
  const lowerSymbol = vault.symbol.toLowerCase();

  // If the symbol is a raw asset (not a vault token) and has 0 APY, it's likely a raw market
  return rawAssetSymbols.includes(lowerSymbol) && (vault.apy === 0 || vault.apy === null);
}

// Fetch APY data directly from Morpho GraphQL API (cached)
async function getMorphoVaultApyData(): Promise<MorphoVaultApy[]> {
  // Return cached data if valid
  if (morphoApyCache && Date.now() - morphoApyCache.timestamp < MORPHO_APY_CACHE_TTL) {
    console.log('[Morpho APY] Using cached data');
    return morphoApyCache.data;
  }

  const MORPHO_BLUE_API = 'https://blue-api.morpho.org/graphql';

  const query = `
    query GetVaultApys {
      vaults(first: 500, orderBy: TotalAssets, orderDirection: Desc) {
        items {
          address
          name
          symbol
          state {
            totalAssetsUsd
            apy
            netApy
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(MORPHO_BLUE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      console.error('[Morpho APY] API error:', response.status);
      return [];
    }

    const data = await response.json();
    const vaults = data?.data?.vaults?.items || [];

    // Morpho returns apy/netApy as decimals (0.05 = 5%). Convert to Percent
    // at this source boundary; downstream code expects Percent throughout.
    const result = vaults.map((v: { address?: string; name: string; symbol: string; state: { totalAssetsUsd: number; apy: number; netApy: number } }) => ({
      address: (v.address || '').toLowerCase(),
      symbol: v.symbol,
      name: v.name,
      tvlUsd: v.state?.totalAssetsUsd || 0,
      apy: decimalToPercent(v.state?.apy || 0),
      netApy: decimalToPercent(v.state?.netApy || 0),
    }));

    // Cache the result
    morphoApyCache = { data: result, timestamp: Date.now() };
    return result;
  } catch (error) {
    console.error('[Morpho APY] Error fetching:', error);
    // Return stale cache if available
    if (morphoApyCache) {
      console.log('[Morpho APY] Returning stale cache due to error');
      return morphoApyCache.data;
    }
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const curatorSlug = searchParams.get('curator');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const includeRisk = searchParams.get('risk') !== 'false'; // Include risk by default

    // Fetch from all sources in parallel (tracked for visibility)
    const tracker = new DataSourceTracker();
    const [vaults, duneVaults, vaultRiskData, morphoApyData, curatorMap] = await Promise.all([
      tracker.track(
        curatorSlug ? 'DeFiLlama Curator Vaults' : 'DeFiLlama Top Vaults',
        curatorSlug ? getCuratorVaults(curatorSlug) : getTopVaults(limit),
        [],
      ),
      tracker.track('Dune TVL', getAllVaultsTvl(), []),
      includeRisk
        ? tracker.track('Morpho Risk', getVaultRiskWithCreditRatings(), [])
        : Promise.resolve([]),
      tracker.track('Morpho APY', getMorphoVaultApyData(), []),
      tracker.track('Curator Map', getVaultToCuratorMap(), new Map<string, string>()),
    ]);

    // Create lookup maps
    const duneMap = new Map(
      duneVaults.map(v => [`${v.protocol.toLowerCase()}-${v.chain.toLowerCase()}`, v])
    );

    // Create risk lookup by vault name (normalized)
    const normalizeName = (s: string) => s.toLowerCase().replace(/[\s\-_]/g, '');
    const riskMap = new Map<string, VaultWithCreditRating>();
    // Pre-build comprehensive index to avoid O(n²) fallback matching
    const riskByNameSubstr = new Map<string, VaultWithCreditRating>();
    for (const vault of vaultRiskData) {
      const nameNorm = normalizeName(vault.name);
      const symbolNorm = normalizeName(vault.symbol);
      riskMap.set(nameNorm, vault);
      riskMap.set(symbolNorm, vault);
      // Index by name tokens for substring matching
      riskByNameSubstr.set(nameNorm, vault);
      riskByNameSubstr.set(symbolNorm, vault);
    }

    // Create Morpho APY lookup by symbol (normalized)
    const morphoApyMap = new Map<string, MorphoVaultApy>();
    const morphoByNameSubstr = new Map<string, MorphoVaultApy>();
    for (const vault of morphoApyData) {
      const nameNorm = normalizeName(vault.name);
      const symbolNorm = normalizeName(vault.symbol);
      morphoApyMap.set(symbolNorm, vault);
      morphoApyMap.set(nameNorm, vault);
      morphoByNameSubstr.set(nameNorm, vault);
      morphoByNameSubstr.set(symbolNorm, vault);
    }
    // Address-based lookup (most reliable for Morpho vaults)
    const morphoApyByAddress = new Map<string, MorphoVaultApy>();
    for (const vault of morphoApyData) {
      if (vault.address) {
        morphoApyByAddress.set(vault.address, vault);
      }
    }
    console.log(`[Vaults] Morpho APY data available for ${morphoApyData.length} vaults (${morphoApyByAddress.size} with addresses)`);

    // Transform to a cleaner format with risk data
    const transformedVaults = vaults.map(vault => {
      const duneKey = `${vault.project.toLowerCase()}-${vault.chain.toLowerCase()}`;
      const duneVault = duneMap.get(duneKey);

      // Try to match risk data by name or symbol
      const normalizedSymbol = normalizeName(vault.symbol);
      const normalizedMeta = normalizeName(vault.poolMeta || '');

      // O(1) lookup: try exact keys, then check substring index
      let riskData = riskMap.get(normalizedSymbol) || riskMap.get(normalizedMeta);
      if (!riskData) {
        // Check if any risk entry's name/symbol contains the vault symbol or vice versa
        for (const [key, val] of riskByNameSubstr) {
          if (key.includes(normalizedSymbol) || normalizedSymbol.includes(key)) {
            riskData = val;
            break;
          }
        }
      }

      // Get APY — prefer Morpho API for Morpho vaults (always fresher than DeFiLlama)
      let finalApy = vault.apy || 0;
      let finalApyBase = vault.apyBase || 0;
      let apySource = 'defillama';

      if (vault.project.toLowerCase().includes('morpho')) {
        // Priority: 1) address match (most reliable), 2) symbol, 3) name substring
        const poolAddress = (vault.pool || '').toLowerCase();
        let morphoApy = morphoApyByAddress.get(poolAddress)
          || morphoApyMap.get(normalizeName(vault.symbol))
          || morphoApyMap.get(normalizeName(vault.poolMeta || ''));
        if (!morphoApy) {
          const vaultSymNorm = normalizeName(vault.symbol);
          for (const [key, val] of morphoByNameSubstr) {
            if (key.includes(vaultSymNorm) || vaultSymNorm.includes(key)) {
              morphoApy = val;
              break;
            }
          }
        }

        if (morphoApy && morphoApy.apy > 0) {
          finalApy = morphoApy.netApy || morphoApy.apy;
          finalApyBase = morphoApy.apy;
          apySource = 'morpho';
        }
      }

      // Look up curator from multiple sources (priority order):
      // 1. Morpho vault-to-curator map (most reliable for Morpho vaults)
      // 2. Risk data curator field
      // 3. Symbol prefix inference (STEAKUSDC → Steakhouse, GTUSDCP → Gauntlet)
      // 4. poolMeta as fallback
      const curatorFromMap = curatorMap.get(normalizedSymbol)
        || curatorMap.get(normalizeName(vault.poolMeta || ''))
        || curatorMap.get(normalizeName(vault.symbol));

      // Check if this is a raw lending market (no curator possible)
      const isRawMarket = isRawLendingMarket(vault);

      // Infer curator from symbol prefix if Morpho API didn't have it
      const curatorFromSymbol = getCuratorFromSymbol(vault.symbol);

      // Final curator determination
      const curator = isRawMarket
        ? null  // Raw markets have no curator
        : curatorFromMap || riskData?.curator || curatorFromSymbol || vault.poolMeta || null;

      // Pass through the actual APY values. Outlier handling is done at the
      // display layer: curator-level averages use median-based outlier
      // exclusion (see curators/route.ts), and chart components filter out
      // entries with APY > 500% from scatter plots (see flow-analysis.ts).
      // Individual vaults with extreme APY (e.g. KHYPE, Clearstar) are still
      // shown in the vault table with their real values for transparency.

      return {
        id: vault.pool,
        name: formatVaultName(vault),
        chain: vault.chain,
        project: vault.project,
        symbol: vault.symbol,
        tvl: vault.tvlUsd,
        apy: finalApy,
        apyBase: finalApyBase,
        apyReward: vault.apyReward || 0,
        apySource, // Track where APY came from
        apyChange7d: vault.apyPct7D || 0,
        stablecoin: vault.stablecoin,
        exposure: vault.exposure,
        poolMeta: vault.poolMeta,
        // Curator from Morpho API (authoritative), risk data, or poolMeta fallback
        curator,
        // Type: raw lending market (no curator) vs curated vault
        isRawMarket,
        // Dune cross-reference data
        duneTvl: duneVault?.tvl || null,
        dataVerified: duneVault ? Math.abs((vault.tvlUsd - duneVault.tvl) / vault.tvlUsd) < 0.15 : false,
        // Risk metrics (from Morpho on-chain data)
        riskScore: riskData?.riskScore,
        riskLevel: riskData?.riskLevel,
        maxUtilization: riskData?.maxUtilization,
        avgLltv: riskData?.avgLltv,
        hasBadDebt: riskData?.hasBadDebt,
        redWarningCount: riskData?.redWarningCount,
        criticalWarnings: riskData?.criticalWarnings,
        markets: riskData?.markets,
        // Credit rating (three-pillar system)
        creditRating: riskData?.creditRating,
      };
    });

    // Also include Morpho vaults that might not be in DeFiLlama
    // (if we have risk data for them)
    if (includeRisk && !curatorSlug) {
      const existingSymbols = new Set(vaults.map(v => normalizeName(v.symbol)));

      for (const riskVault of vaultRiskData) {
        if (!existingSymbols.has(normalizeName(riskVault.symbol))) {
          transformedVaults.push({
            id: riskVault.address,
            name: riskVault.name,
            chain: riskVault.chain === 1 ? 'Ethereum' : riskVault.chain === 8453 ? 'Base' : `Chain ${riskVault.chain}`,
            project: 'morpho',
            symbol: riskVault.symbol,
            tvl: riskVault.tvlUsd,
            apy: riskVault.apy,
            apyBase: riskVault.apy,
            apyReward: 0,
            apySource: 'morpho', // On-chain data
            apyChange7d: 0,
            stablecoin: false,
            exposure: 'single',
            poolMeta: riskVault.curator,
            curator: riskVault.curator, // Curator from Morpho on-chain data
            isRawMarket: false, // Risk data only includes vaults, not raw markets
            duneTvl: null,
            dataVerified: true, // On-chain data
            riskScore: riskVault.riskScore,
            riskLevel: riskVault.riskLevel,
            maxUtilization: riskVault.maxUtilization,
            avgLltv: riskVault.avgLltv,
            hasBadDebt: riskVault.hasBadDebt,
            redWarningCount: riskVault.redWarningCount,
            criticalWarnings: riskVault.criticalWarnings,
            markets: riskVault.markets,
            creditRating: riskVault.creditRating,
          });
        }
      }
    }

    // Sort by TVL
    transformedVaults.sort((a, b) => b.tvl - a.tvl);

    // Count how many vaults got APY from Morpho
    const vaultsWithMorphoApy = transformedVaults.filter(v => v.apySource === 'morpho').length;
    // Count how many vaults have curator attribution
    const vaultsWithCurator = transformedVaults.filter(v => v.curator && v.curator !== '—').length;
    // Count raw lending markets (no curator)
    const rawMarketCount = transformedVaults.filter(v => v.isRawMarket).length;
    console.log(`[Vaults] ${vaultsWithCurator}/${transformedVaults.length} vaults have curator attribution, ${rawMarketCount} are raw markets`);

    return NextResponse.json({
      vaults: transformedVaults.slice(0, limit),
      count: transformedVaults.length,
      curator: curatorSlug || null,
      dataSource: [
        'DeFiLlama',
        morphoApyData.length > 0 ? `Morpho APY (${vaultsWithMorphoApy})` : null,
        curatorMap.size > 0 ? `Curators (${vaultsWithCurator})` : null,
        vaultRiskData.length > 0 ? 'Morpho Risk' : null,
        duneVaults.length > 0 ? 'Dune' : null,
      ].filter(Boolean).join(' + '),
      vaultsWithRiskData: transformedVaults.filter(v => v.riskScore !== undefined).length,
      vaultsWithMorphoApy,
      vaultsWithCurator,
      rawMarketCount,
      _meta: { dataSources: tracker.getSummary() },
    });
  } catch (error) {
    console.error('Error fetching vaults:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vault data' },
      { status: 500 }
    );
  }
}

function formatVaultName(vault: {
  symbol: string;
  poolMeta: string | null;
  project: string;
}): string {
  // Create a readable vault name from symbol and metadata
  let name = vault.symbol;

  if (vault.poolMeta) {
    // Add pool metadata if it provides useful context
    const meta = vault.poolMeta;
    if (!name.toLowerCase().includes(meta.toLowerCase())) {
      name = `${name} (${meta})`;
    }
  }

  return name;
}
