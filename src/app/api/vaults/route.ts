import { NextRequest, NextResponse } from 'next/server';
import { getCuratorVaults, getTopVaults } from '@/lib/defillama';
import { getAllVaultsTvl } from '@/lib/dune';
import { getVaultRiskWithCreditRatings, type VaultWithCreditRating } from '@/lib/risk';

// Morpho vault APY data interface
interface MorphoVaultApy {
  symbol: string;
  name: string;
  tvlUsd: number;
  apy: number;
  netApy: number;
}

// In-memory cache for Morpho APY data
let morphoApyCache: { data: MorphoVaultApy[]; timestamp: number } | null = null;
const MORPHO_APY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

    const result = vaults.map((v: { name: string; symbol: string; state: { totalAssetsUsd: number; apy: number; netApy: number } }) => ({
      symbol: v.symbol,
      name: v.name,
      tvlUsd: v.state?.totalAssetsUsd || 0,
      apy: (v.state?.apy || 0) * 100, // Convert to percentage
      netApy: (v.state?.netApy || 0) * 100,
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

    // Fetch from all sources in parallel
    const [vaults, duneVaults, vaultRiskData, morphoApyData] = await Promise.all([
      curatorSlug ? getCuratorVaults(curatorSlug) : getTopVaults(limit),
      getAllVaultsTvl().catch(() => []),
      includeRisk ? getVaultRiskWithCreditRatings().catch(() => []) : Promise.resolve([]),
      getMorphoVaultApyData().catch(() => []), // Morpho API APY data
    ]);

    // Create lookup maps
    const duneMap = new Map(
      duneVaults.map(v => [`${v.protocol.toLowerCase()}-${v.chain.toLowerCase()}`, v])
    );

    // Create risk lookup by vault name (normalized)
    const normalizeName = (s: string) => s.toLowerCase().replace(/[\s\-_]/g, '');
    const riskMap = new Map<string, VaultWithCreditRating>();
    for (const vault of vaultRiskData) {
      // Map by multiple keys for better matching
      riskMap.set(normalizeName(vault.name), vault);
      riskMap.set(normalizeName(vault.symbol), vault);
    }

    // Create Morpho APY lookup by symbol (normalized)
    // Try multiple matching strategies
    const morphoApyMap = new Map<string, MorphoVaultApy>();
    for (const vault of morphoApyData) {
      morphoApyMap.set(normalizeName(vault.symbol), vault);
      morphoApyMap.set(normalizeName(vault.name), vault);
    }
    console.log(`[Vaults] Morpho APY data available for ${morphoApyData.length} vaults`);

    // Transform to a cleaner format with risk data
    const transformedVaults = vaults.map(vault => {
      const duneKey = `${vault.project.toLowerCase()}-${vault.chain.toLowerCase()}`;
      const duneVault = duneMap.get(duneKey);

      // Try to match risk data by name or symbol
      const normalizedSymbol = normalizeName(vault.symbol);
      const normalizedMeta = normalizeName(vault.poolMeta || '');

      const riskData = riskMap.get(normalizedSymbol)
        || riskMap.get(normalizedMeta)
        || Array.from(riskMap.values()).find(r =>
            normalizeName(r.name).includes(normalizedSymbol) ||
            normalizedSymbol.includes(normalizeName(r.symbol))
          );

      // Try to get APY from Morpho API if DeFiLlama has 0
      // This fixes morpho-v1 pools that show 0% APY in DeFiLlama
      let finalApy = vault.apy || 0;
      let finalApyBase = vault.apyBase || 0;
      let apySource = 'defillama';

      if (finalApy === 0 && vault.project.toLowerCase().includes('morpho')) {
        // Try to find matching Morpho vault APY
        const morphoApy = morphoApyMap.get(normalizeName(vault.symbol))
          || morphoApyMap.get(normalizeName(vault.poolMeta || ''))
          || Array.from(morphoApyMap.values()).find(m =>
              normalizeName(m.symbol).includes(normalizeName(vault.symbol)) ||
              normalizeName(vault.symbol).includes(normalizeName(m.symbol)) ||
              normalizeName(m.name).includes(normalizeName(vault.symbol))
            );

        if (morphoApy && morphoApy.apy > 0) {
          finalApy = morphoApy.netApy || morphoApy.apy;
          finalApyBase = morphoApy.apy;
          apySource = 'morpho';
        }
      }

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
        // Curator from Morpho on-chain data (authoritative) or fallback to poolMeta
        curator: riskData?.curator || vault.poolMeta || null,
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

    return NextResponse.json({
      vaults: transformedVaults.slice(0, limit),
      count: transformedVaults.length,
      curator: curatorSlug || null,
      dataSource: [
        'DeFiLlama',
        morphoApyData.length > 0 ? `Morpho APY (${vaultsWithMorphoApy})` : null,
        vaultRiskData.length > 0 ? 'Morpho Risk' : null,
        duneVaults.length > 0 ? 'Dune' : null,
      ].filter(Boolean).join(' + '),
      vaultsWithRiskData: transformedVaults.filter(v => v.riskScore !== undefined).length,
      vaultsWithMorphoApy,
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
