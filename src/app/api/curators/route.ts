import { NextResponse } from 'next/server';
import { getAllProtocols, filterRiskCurators, extractChains, getYieldPools, filterCuratorVaultsFromPools, getProtocol30dChange, type VaultPool } from '@/lib/defillama';
import { getMorphoCuratorData, crossReferenceCuratorData } from '@/lib/dune';
import { getAllCuratorsFeeData, getMorphoCuratorsTvl } from '@/lib/morpho';
import { getEulerCuratorFeeData, getEulerCuratorsTvl } from '@/lib/euler';
import { getRiskMetrics } from '@/lib/risk';
import { assessCapitalSafety, assessLiquidityHealth, assessCuratorQuality, scoreToRating, isInvestmentGrade } from '@/lib/risk-rating';
import { getKaminoCuratorsTvl, type KaminoCuratorTvlData } from '@/lib/kamino-onchain';
import { DataSourceTracker } from '@/lib/data-source-tracker';
import { CURATOR_FEE_OVERRIDES } from '@/lib/curator-fee-overrides';
import { decimalToPercent, assertReasonablePercent } from '@/lib/fees';
import { getCuratorPlatforms } from '@/lib/curator-platforms';
import type { Curator } from '@/types';

// In-memory cache for Kamino data (expensive Solana RPC call).
// We track `stale: true` separately so consumers can surface a "stale" badge
// when we serve cached data after a fetch failure or timeout.
let kaminoCache: { data: KaminoCuratorTvlData[]; timestamp: number; stale: boolean } | null = null;
let kaminoPendingRequest: Promise<KaminoCuratorTvlData[]> | null = null;
const KAMINO_CACHE_TTL = 20 * 60 * 1000; // 20 minutes (Solana RPC is expensive)
const KAMINO_RPC_TIMEOUT_MS = 15_000; // 15s — public mainnet RPC can be slow but anything beyond this is broken

/**
 * Fetch Kamino curator data with actual on-chain TVL.
 *
 * Caching layers:
 *   1. Fresh cache (< KAMINO_CACHE_TTL): returned immediately.
 *   2. In-flight dedup: concurrent requests share a single promise.
 *   3. Stale-on-error: if the RPC fetch fails or times out, we serve the last
 *      known data with `kaminoCache.stale = true` so callers can warn the UI.
 *
 * Production note: the public mainnet RPC (`api.mainnet-beta.solana.com`) is
 * heavily rate-limited (~300 req/day). Set `SOLANA_RPC_URL` to a paid endpoint
 * (Helius / QuickNode / Triton) for reliable production behavior.
 */
async function getKaminoCuratorData(): Promise<KaminoCuratorTvlData[]> {
  // Return cached data if still within TTL
  if (kaminoCache && Date.now() - kaminoCache.timestamp < KAMINO_CACHE_TTL) {
    console.log(`[Kamino] Using cached data (stale=${kaminoCache.stale})`);
    return kaminoCache.data;
  }

  // Deduplicate concurrent requests — share the in-flight promise
  if (kaminoPendingRequest) {
    console.log('[Kamino] Deduplicating concurrent request');
    return kaminoPendingRequest;
  }

  kaminoPendingRequest = (async () => {
    try {
      const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
      if (!process.env.SOLANA_RPC_URL && process.env.NODE_ENV === 'production') {
        console.warn(
          '[Kamino] SOLANA_RPC_URL not set — using public mainnet endpoint. ' +
          'This is heavily rate-limited and unreliable in production. ' +
          'Configure a paid RPC (Helius/QuickNode/Triton) ASAP.',
        );
      }

      // Race the RPC fetch against a hard timeout — without this, a hung
      // Solana RPC can pin the entire /api/curators request until Vercel's
      // 60s/300s function timeout fires (504 to the user).
      const curators = await Promise.race([
        getKaminoCuratorsTvl(rpcUrl),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Kamino RPC timeout after ${KAMINO_RPC_TIMEOUT_MS}ms`)), KAMINO_RPC_TIMEOUT_MS),
        ),
      ]);
      console.log(`[Kamino] Fetched ${curators.length} curators with on-chain TVL`);
      kaminoCache = { data: curators, timestamp: Date.now(), stale: false };
      return curators;
    } finally {
      kaminoPendingRequest = null;
    }
  })();

  try {
    return await kaminoPendingRequest;
  } catch (error) {
    console.error('[Kamino] Fetch failed:', error instanceof Error ? error.message : error);
    // Stale-on-error: serve the last good data, marked stale so the UI can
    // warn users that Kamino TVL may not reflect current chain state.
    if (kaminoCache) {
      console.warn(`[Kamino] Serving stale cache (age=${Math.round((Date.now() - kaminoCache.timestamp) / 1000)}s)`);
      kaminoCache.stale = true;
      return kaminoCache.data;
    }
    return [];
  }
}

/** Whether the most recent Kamino data we served was cached after a failure. */
function isKaminoDataStale(): boolean {
  return kaminoCache?.stale ?? false;
}

export const revalidate = 300; // 5 minutes

// Fallback curator metadata - only used when vault data is unavailable.
// Last verified 2026-04-16. Includes both Risk Curators and Onchain Capital
// Allocator entries. See src/lib/curator-names.ts for the full slug catalogue.
const CURATOR_METADATA: Record<string, { protocols: string[] }> = {
  // Risk Curators
  'steakhouse-financial': { protocols: ['Morpho', 'Kamino', 'Spark'] },
  'gauntlet': { protocols: ['Morpho', 'Kamino', 'Symbiotic', 'Drift'] },
  'sentora': { protocols: ['EtherFi', 'Morpho', 'Aave'] },
  'mev-capital': { protocols: ['Morpho', 'Euler'] },
  'k3-capital': { protocols: ['Morpho'] },
  're7-labs': { protocols: ['Morpho', 'Euler'] },
  'block-analitica': { protocols: ['Morpho', 'Spark'] },
  'euler-dao': { protocols: ['Euler'] },
  'yearn-curating': { protocols: ['Yearn', 'Morpho'] },
  'vault-bridge': { protocols: ['Morpho'] },
  'ultrayield-by-edge': { protocols: ['Morpho'] },
  'hyperithm': { protocols: ['Morpho'] },
  'b-protocol': { protocols: ['Morpho'] },
  'summer-fi': { protocols: ['Morpho', 'Ajna'] },
  'clearstar': { protocols: ['Morpho'] },
  'telos-consilium': { protocols: ['Morpho'] },
  'tulipa-capital': { protocols: ['Morpho'] },
  'kpk': { protocols: ['Morpho'] },
  'alphaping': { protocols: ['Morpho'] },
  '9summits': { protocols: ['Morpho'] },
  'rockawayx': { protocols: ['Morpho', 'Solana'] },

  // Self-curating platforms (DeFiLlama categorizes as OCA, not Risk Curators)
  'veda': { protocols: ['BoringVault', 'Morpho', 'Aave'] },
  'mellow-core': { protocols: ['EigenLayer', 'Symbiotic', 'Morpho'] },
};

// Calculate real metrics from vault data (using pre-fetched pools to avoid N+1 queries)
function getCuratorRealMetrics(slug: string, allPools: VaultPool[]): {
  vaultCount: number;
  avgApy: number;
  protocols: string[];
  chains: string[];
  vaultTvl: number;
} | null {
  try {
    const vaults = filterCuratorVaultsFromPools(slug, allPools);
    if (vaults.length === 0) return null;

    const totalTvl = vaults.reduce((sum, v) => sum + v.tvlUsd, 0);

    // Calculate TVL-weighted average APY
    let weightedApy = 0;
    vaults.forEach(v => {
      const weight = totalTvl > 0 ? v.tvlUsd / totalTvl : 0;
      weightedApy += (v.apy || 0) * weight;
    });

    // Extract unique protocols and chains
    const protocols = [...new Set(vaults.map(v => formatProtocolName(v.project)))];
    const chains = [...new Set(vaults.map(v => v.chain))];

    return {
      vaultCount: vaults.length,
      avgApy: weightedApy,
      protocols,
      chains,
      vaultTvl: totalTvl,
    };
  } catch {
    return null;
  }
}

function formatProtocolName(project: string): string {
  const nameMap: Record<string, string> = {
    'morpho': 'Morpho',
    'morpho-blue': 'Morpho',
    'morpho-steakhouse': 'Morpho',
    'morpho-gauntlet': 'Morpho',
    'morpho-mev-capital': 'Morpho',
    'morpho-re7': 'Morpho',
    'morpho-k3': 'Morpho',
    'morpho-block-analitica': 'Morpho',
    'morpho-sentora': 'Morpho',
    'euler': 'Euler',
    'euler-v2': 'Euler',
    'kamino': 'Kamino',
    'kamino-lend': 'Kamino',
    'yearn-finance': 'Yearn',
    'aave-v3': 'Aave',
    'spark': 'Spark',
    'compound-v3': 'Compound',
    'gearbox': 'Gearbox',
    'sommelier': 'Sommelier',
    'mellow-protocol': 'Mellow',
    'symbiotic': 'Symbiotic',
    'drift-protocol': 'Drift',
    'meteora': 'Meteora',
  };

  const lower = project.toLowerCase();
  return nameMap[lower] || project.charAt(0).toUpperCase() + project.slice(1);
}

import { CURATOR_NAME_VARIANTS, formatCuratorName } from '@/lib/curator-names';

// Look up fee data using multiple name matching strategies
function lookupFeeData(
  protocolName: string,
  protocolSlug: string,
  feeDataMap: Map<string, { avgPerformanceFee: number; avgManagementFee: number; estimatedAnnualFeeRevenue: number; avgGrossApy: number; avgNetApy: number }>
) {
  // Normalize function for consistent key generation
  const normalize = (s: string) => s.toLowerCase().replace(/[\s.-]/g, '');

  // Strategy 1: Try slug directly
  let feeData = feeDataMap.get(normalize(protocolSlug));
  if (feeData) return feeData;

  // Strategy 2: Try formatted protocol name
  feeData = feeDataMap.get(normalize(formatCuratorName(protocolName)));
  if (feeData) return feeData;

  // Strategy 3: Try protocol name as-is
  feeData = feeDataMap.get(normalize(protocolName));
  if (feeData) return feeData;

  // Strategy 4: Try known name variants for this slug
  const variants = CURATOR_NAME_VARIANTS[protocolSlug];
  if (variants) {
    for (const variant of variants) {
      feeData = feeDataMap.get(normalize(variant));
      if (feeData) return feeData;
    }
  }

  return undefined;
}

export async function GET() {
  try {
    // Fetch data from all sources in parallel (tracked for visibility)
    const tracker = new DataSourceTracker();
    const [
      allProtocols,
      duneCuratorData,
      morphoFeeData,
      eulerFeeData,
      allYieldPools,
      morphoCuratorTvl,  // On-chain TVL (primary source for Morpho)
      eulerCuratorTvl,   // On-chain TVL (primary source for Euler)
      riskData,          // Risk metrics
      kaminoCuratorData, // Kamino Solana data with on-chain TVL
    ] = await Promise.all([
      tracker.track('DeFiLlama Protocols', getAllProtocols(), []),
      tracker.track('Dune Curator Data', getMorphoCuratorData(), []),
      tracker.track('Morpho Fees', getAllCuratorsFeeData(), []),
      tracker.track('Euler Fees', getEulerCuratorFeeData(), []),
      tracker.track('DeFiLlama Yield Pools', getYieldPools(), []),
      tracker.track('Morpho On-Chain TVL', getMorphoCuratorsTvl(), []),
      tracker.track('Euler On-Chain TVL', getEulerCuratorsTvl(), []),
      tracker.track('Risk Metrics', getRiskMetrics(), null),
      tracker.track('Kamino On-Chain TVL', getKaminoCuratorData(), []),
    ]);

    // Create Morpho TVL lookup map (normalized curator name -> data)
    const normalizeName = (s: string) => s.toLowerCase().replace(/[\s.-]/g, '');
    const morphoTvlMap = new Map(
      morphoCuratorTvl.map(c => [normalizeName(c.curatorName), c])
    );

    // Create Euler TVL lookup map (authoritative for Euler curators)
    const eulerTvlMap = new Map(
      eulerCuratorTvl.map(c => [normalizeName(c.curatorName), c])
    );
    console.log(`[Curators] Euler TVL data available for ${eulerCuratorTvl.length} curators`);

    // Create risk data lookup map
    const riskMap = new Map(
      riskData?.curators.map(c => [normalizeName(c.curatorName), c]) || []
    );

    // Create Kamino data lookup map (for Solana TVL - now with ACTUAL on-chain TVL)
    const kaminoMap = new Map(
      kaminoCuratorData.map(c => [normalizeName(c.curatorName), c])
    );
    console.log(`[Curators] Kamino data available for ${kaminoCuratorData.length} curators (on-chain TVL)`);

    // Create a map of fee data by curator name (normalized)
    // Combine Morpho and Euler data
    const feeDataMap = new Map<string, {
      avgPerformanceFee: number;
      avgManagementFee: number;
      estimatedAnnualFeeRevenue: number;
      avgGrossApy: number;
      avgNetApy: number;
    }>();

    // Consistent normalization for fee data keys
    const normalizeFeeKey = (s: string) => s.toLowerCase().replace(/[\s.-]/g, '');

    // Add Morpho fee data
    for (const fd of morphoFeeData) {
      const key = normalizeFeeKey(fd.curatorName);
      feeDataMap.set(key, {
        avgPerformanceFee: fd.avgPerformanceFee,
        avgManagementFee: fd.avgManagementFee,
        estimatedAnnualFeeRevenue: fd.estimatedAnnualFeeRevenue,
        avgGrossApy: fd.avgGrossApy,
        avgNetApy: fd.avgNetApy,
      });
    }

    // Merge/add Euler fee data (preserve both Morpho and Euler contributions)
    for (const ed of eulerFeeData) {
      const key = normalizeFeeKey(ed.curatorName);
      const existing = feeDataMap.get(key);

      // Euler fee comes in as a Percent value (parsePerformanceFee in src/lib/euler.ts
      // handles WAD/BPS/decimal/percent variants and returns 0-100). Guard against
      // any future regression with a reasonable-range assertion.
      const clampedEulerFee = assertReasonablePercent(ed.avgPerformanceFee, `Euler fee for ${ed.curatorName}`, { max: 100 });

      if (existing) {
        // Merge: take the higher performance fee (curators typically set same fee across protocols)
        // and sum fee revenue from both protocols
        feeDataMap.set(key, {
          avgPerformanceFee: Math.max(existing.avgPerformanceFee, clampedEulerFee),
          avgManagementFee: existing.avgManagementFee, // Euler doesn't have management fees
          estimatedAnnualFeeRevenue: existing.estimatedAnnualFeeRevenue, // Morpho revenue is more reliable
          avgGrossApy: existing.avgGrossApy || 0,
          avgNetApy: existing.avgNetApy || 0,
        });
      } else {
        feeDataMap.set(key, {
          avgPerformanceFee: clampedEulerFee,
          avgManagementFee: 0,
          estimatedAnnualFeeRevenue: 0,
          avgGrossApy: 0,
          avgNetApy: 0,
        });
      }
    }

    // Filter for risk curators from DeFiLlama
    const curatorProtocols = filterRiskCurators(allProtocols);

    // Prepare DeFiLlama data for cross-referencing
    const defillamaData = curatorProtocols
      .filter(p => p.tvl > 0)
      .map(p => ({ name: p.name, slug: p.slug, tvl: p.tvl }));

    // Cross-reference with Dune data
    const crossReferenced = crossReferenceCuratorData(defillamaData, duneCuratorData);

    // Create a map of cross-referenced data for lookup
    const crossRefMap = new Map(crossReferenced.map(c => [c.slug, c]));

    // Calculate real vault metrics for each curator (using pre-fetched pools - no more N+1 queries)
    const curatorSlugs = curatorProtocols.filter(p => p.tvl > 0).map(p => p.slug);
    const realMetricsMap = new Map(
      curatorSlugs.map(slug => [slug, getCuratorRealMetrics(slug, allYieldPools)])
    );

    // Fetch real 30d changes from historical TVL data
    // (change_1m is often missing from DeFiLlama's /protocols list endpoint)
    const change30dResults = await Promise.all(
      curatorSlugs.map(async (slug) => {
        try {
          const change = await getProtocol30dChange(slug);
          return { slug, change30d: change };
        } catch {
          return { slug, change30d: undefined };
        }
      })
    );
    const change30dMap = new Map(change30dResults.map(r => [r.slug, r.change30d]));

    // Transform to our Curator type with real metrics when available
    const curators: Curator[] = curatorProtocols
      .filter(p => p.tvl > 0)
      .map(p => {
        const metadata = CURATOR_METADATA[p.slug] || { protocols: ['Morpho'] };
        const defillamaChains = extractChains(p);
        const crossRef = crossRefMap.get(p.slug);
        const realMetrics = realMetricsMap.get(p.slug);

        // Look up fee data using multiple strategies (name matching is tricky)
        const feeData = lookupFeeData(p.name, p.slug, feeDataMap);

        // Apply fee overrides for curators with known but not on-chain fees.
        // Match against any known name variant for this slug (DeFiLlama's
        // p.name often differs from the override key — e.g. "Mellow Core" vs
        // "Mellow" — so single-string match would silently miss).
        const overrideCandidateNames = new Set<string>([
          p.name.toLowerCase(),
          formatCuratorName(p.name).toLowerCase(),
          ...(CURATOR_NAME_VARIANTS[p.slug] || []).map(v => v.toLowerCase()),
        ]);
        const feeOverride = Object.entries(CURATOR_FEE_OVERRIDES).find(
          ([key]) => overrideCandidateNames.has(key.toLowerCase()),
        )?.[1];
        // CURATOR_FEE_OVERRIDES stores fees as decimals (0.01 = 1%) per the
        // file's header comment. Convert to Percent at this consumption
        // boundary. An override only applies when the on-chain value is 0/null —
        // real on-chain fees always win.
        const overriddenMgmtFee = (feeData?.avgManagementFee && feeData.avgManagementFee > 0)
          ? feeData.avgManagementFee
          : feeOverride?.managementFee != null
            ? decimalToPercent(feeOverride.managementFee)
            : feeData?.avgManagementFee;
        const overriddenPerfFee = (feeData?.avgPerformanceFee && feeData.avgPerformanceFee > 0)
          ? feeData.avgPerformanceFee
          : feeOverride?.performanceFee != null
            ? decimalToPercent(feeOverride.performanceFee)
            : feeData?.avgPerformanceFee;

        // Look up Morpho on-chain TVL (try multiple name formats)
        const morphoData = morphoTvlMap.get(normalizeName(p.name))
          || morphoTvlMap.get(normalizeName(formatCuratorName(p.name)))
          || (CURATOR_NAME_VARIANTS[p.slug]
              ? CURATOR_NAME_VARIANTS[p.slug].map(v => morphoTvlMap.get(normalizeName(v))).find(Boolean)
              : undefined);

        // Look up risk data (try multiple name formats)
        const risk = riskMap.get(normalizeName(p.name))
          || riskMap.get(normalizeName(formatCuratorName(p.name)))
          || (CURATOR_NAME_VARIANTS[p.slug]
              ? CURATOR_NAME_VARIANTS[p.slug].map(v => riskMap.get(normalizeName(v))).find(Boolean)
              : undefined);

        // Look up Kamino data (Solana vaults - NOW with actual on-chain TVL)
        const kaminoData = kaminoMap.get(normalizeName(p.name))
          || kaminoMap.get(normalizeName(formatCuratorName(p.name)))
          || (CURATOR_NAME_VARIANTS[p.slug]
              ? CURATOR_NAME_VARIANTS[p.slug].map(v => kaminoMap.get(normalizeName(v))).find(Boolean)
              : undefined);

        // Look up Euler data (for Euler curators)
        const eulerData = eulerTvlMap.get(normalizeName(p.name))
          || eulerTvlMap.get(normalizeName(formatCuratorName(p.name)))
          || (CURATOR_NAME_VARIANTS[p.slug]
              ? CURATOR_NAME_VARIANTS[p.slug].map(v => eulerTvlMap.get(normalizeName(v))).find(Boolean)
              : undefined);

        // ---------------------------------------------------------------
        // TVL Hierarchy (refactored Phase 2 — 2026-04-16)
        // ---------------------------------------------------------------
        // Each on-chain source is authoritative for its own protocol's TVL:
        //   - morphoTvl: queried directly from Morpho GraphQL
        //   - kaminoTvl: read directly from Solana on-chain accounts
        //   - eulerTvl:  queried from per-chain Euler subgraphs
        // Therefore SUMMING them is correct — they cover disjoint protocols.
        // DeFiLlama is a fallback aggregator; we use it only when on-chain
        // sources sum to ~zero (i.e. we don't have on-chain coverage of this
        // curator's vaults yet).
        //
        // The `tvlSources` array exposes per-source contributions in the API
        // response so discrepancies are debuggable from the client.
        const defillamaTvl = p.tvl ?? 0;
        const morphoTvl = morphoData?.totalTvl ?? 0;
        const kaminoTvl = kaminoData?.totalTvlUsd ?? 0;
        const eulerTvl = eulerData?.totalTvlUsd ?? 0;
        const onChainSum = morphoTvl + kaminoTvl + eulerTvl;

        // Threshold for "we have meaningful on-chain coverage": at least $10k
        // AND on-chain sum is ≥ 10% of DeFiLlama's number (or DeFiLlama is 0).
        const hasOnChainCoverage = onChainSum > 10_000
          && (defillamaTvl === 0 || onChainSum >= defillamaTvl * 0.1);

        // Pick the HIGHER of on-chain sum vs DeFiLlama.
        //
        // Why max, not sum: on-chain sources (Morpho, Kamino, Euler) each
        // cover their own protocol, while DeFiLlama aggregates across ALL
        // protocols the curator operates on. The on-chain sum may be LESS
        // than DeFiLlama when the curator also operates on protocols we
        // don't have on-chain coverage for (e.g. Sentora on EtherFi/Aave).
        // Using max ensures we never under-report a curator's TVL.
        let tvlSource: 'morpho' | 'kamino' | 'euler' | 'defillama';
        let totalTvl: number;
        if (hasOnChainCoverage && onChainSum >= defillamaTvl) {
          // On-chain data is more complete — use it
          totalTvl = onChainSum;
          if (morphoTvl >= kaminoTvl && morphoTvl >= eulerTvl) tvlSource = 'morpho';
          else if (kaminoTvl >= eulerTvl) tvlSource = 'kamino';
          else tvlSource = 'euler';
        } else {
          // DeFiLlama captures more protocols than our on-chain sources — use it
          totalTvl = defillamaTvl;
          tvlSource = 'defillama';
        }

        // Per-source contribution array (only includes sources that contributed).
        // Surfaces in the API response for debugging cross-source discrepancies.
        const tvlSources: Array<{ source: 'morpho' | 'kamino' | 'euler' | 'defillama'; tvl: number; authoritative: boolean }> = [];
        if (morphoTvl > 0) tvlSources.push({ source: 'morpho', tvl: morphoTvl, authoritative: true });
        if (kaminoTvl > 0) tvlSources.push({ source: 'kamino', tvl: kaminoTvl, authoritative: true });
        if (eulerTvl > 0) tvlSources.push({ source: 'euler', tvl: eulerTvl, authoritative: true });
        if (defillamaTvl > 0) tvlSources.push({ source: 'defillama', tvl: defillamaTvl, authoritative: false });

        // Log any large discrepancy (>20%) between on-chain sum and DeFiLlama.
        // Helps catch staleness, missing curator-vault attribution, or
        // protocol-side data bugs without spamming logs for normal variance.
        if (defillamaTvl > 1_000_000 && onChainSum > 0) {
          const ratio = onChainSum / defillamaTvl;
          if (ratio < 0.8 || ratio > 1.25) {
            console.warn(
              `[Curators] TVL discrepancy for ${p.slug}: ` +
              `on-chain=$${(onChainSum / 1e6).toFixed(1)}M vs DeFiLlama=$${(defillamaTvl / 1e6).toFixed(1)}M ` +
              `(ratio=${ratio.toFixed(2)}, using=${tvlSource})`,
            );
          }
        }

        // Use real vault data when available, fallback to estimates
        // Include Kamino and Euler vault counts if available
        const morphoVaultCount = morphoData?.vaultCount || 0;
        const kaminoVaultCount = kaminoData?.vaultCount || 0;
        const eulerVaultCount = eulerData?.vaultCount || 0;
        const hasRealVaultCount = (morphoVaultCount + kaminoVaultCount + eulerVaultCount) > 0 || (realMetrics?.vaultCount ?? 0) > 0;
        const vaultCount = (morphoVaultCount + kaminoVaultCount + eulerVaultCount) || realMetrics?.vaultCount || estimateVaultCount(totalTvl);
        const vaultCountEstimated = !hasRealVaultCount;

        // APY Priority: 1) Fee data grossApy (from Morpho), 2) Morpho on-chain, 3) DefiLlama, 4) 0
        // APY sanity cap: token-price-driven "yields" (KHYPE 34000%, Clearstar
        // 13000%) should not inflate curator-level averages or blow out chart axes.
        const rawApy = feeData?.avgGrossApy || feeData?.avgNetApy || morphoData?.avgApy || realMetrics?.avgApy || 0;
        const avgApy = Math.min(rawApy, 500);

        // Build protocols list - include Kamino/Euler if curator has those vaults
        let protocols = realMetrics?.protocols?.length
          ? [...realMetrics.protocols]
          : [...metadata.protocols];
        if (kaminoData && !protocols.includes('Kamino')) {
          protocols.push('Kamino');
        }
        if (eulerData && !protocols.includes('Euler')) {
          protocols.push('Euler');
        }

        // Build chains list - include Solana if curator has Kamino vaults, add Euler chains
        let chains = realMetrics?.chains?.length
          ? [...realMetrics.chains]
          : (defillamaChains.length > 0 ? [...defillamaChains] : ['Ethereum']);
        if (kaminoData && !chains.includes('Solana')) {
          chains.push('Solana');
        }
        if (eulerData?.chains) {
          for (const chain of eulerData.chains) {
            if (!chains.includes(chain)) {
              chains.push(chain);
            }
          }
        }

        // Data confidence based on data completeness:
        // - High: Has on-chain data (Morpho, Kamino, or Euler) AND has APY data
        // - Medium: Has some data but incomplete
        // - Low: Missing critical data
        const hasOnChainData = morphoTvl > 0 || kaminoTvl > 0 || eulerTvl > 0;
        const hasApyData = avgApy > 0;
        const hasFeeData = feeData !== undefined;

        let dataConfidence: 'high' | 'medium' | 'low';
        if (hasOnChainData && hasApyData) {
          dataConfidence = 'high';
        } else if (hasOnChainData || hasApyData || hasFeeData) {
          dataConfidence = 'medium';
        } else {
          dataConfidence = 'low';
        }

        return {
          name: formatCuratorName(p.name),
          slug: p.slug,
          totalTvl,
          vaultCount,
          vaultCountEstimated,
          chains,
          protocols,
          avgApy,
          // Calculate net flow from change percentages
          netFlow7d: p.change_7d ? (totalTvl * p.change_7d) / 100 : 0,
          // Use DeFiLlama change_1m if available, otherwise fall back to computed 30d change from historical TVL
          netFlow30d: p.change_1m
            ? (totalTvl * p.change_1m) / 100
            : change30dMap.get(p.slug) != null
              ? (totalTvl * change30dMap.get(p.slug)!) / 100
              : 0,
          // TVL source tracking (use authoritative sources when available)
          tvlSource,
          tvlSources,
          morphoTvl: morphoTvl > 0 ? morphoTvl : undefined,
          defillamaTvl,
          // Kamino (Solana) data - now with actual on-chain TVL
          kaminoTvl: kaminoTvl > 0 ? kaminoTvl : undefined,
          kaminoVaultCount: kaminoVaultCount > 0 ? kaminoVaultCount : undefined,
          // Euler data
          eulerTvl: eulerTvl > 0 ? eulerTvl : undefined,
          eulerVaultCount: eulerVaultCount > 0 ? eulerVaultCount : undefined,
          // Data confidence
          dataConfidence,
          duneTvl: crossRef?.duneTvl,
          // Fee economics from Morpho + Euler (with manual overrides as fallback)
          avgPerformanceFee: overriddenPerfFee,
          avgManagementFee: overriddenMgmtFee,
          estimatedAnnualRevenue: feeData?.estimatedAnnualFeeRevenue,
          grossApy: feeData?.avgGrossApy,
          netApy: feeData?.avgNetApy,
          // Risk metrics
          riskScore: risk?.riskScore,
          riskLevel: risk?.riskLevel,
          liquidationVolume24h: risk?.totalLiquidationVolume24h,
          liquidationVolume7d: risk?.totalLiquidationVolume7d,
          hasBadDebt: risk?.hasBadDebt,
          redWarningCount: risk?.redWarningCount,
          yellowWarningCount: risk?.yellowWarningCount,
          criticalWarnings: risk?.criticalWarnings,
          avgUtilization: risk?.avgUtilization,
        };
      })
      .sort((a, b) => b.totalTvl - a.totalTvl);

    // Attach hand-curated platform relationships (e.g. "Coinbase Earn",
    // "Kraken Earn") from src/lib/curator-platforms.ts. Skip when the curator
    // has no known consumer platforms — UI just won't render badges.
    for (const curator of curators) {
      const platforms = getCuratorPlatforms(curator.slug);
      if (platforms.length > 0) {
        curator.platforms = platforms.map(p => ({ name: p.platform, source: p.source }));
      }
    }

    // Compute strategy tags for each curator
    for (const curator of curators) {
      const tags: string[] = [];
      if (curator.avgApy > 8) tags.push('High Yield');
      if ((curator.riskScore !== undefined && curator.riskScore < 30) && !curator.hasBadDebt) tags.push('Conservative');
      if (curator.chains.length > 3) tags.push('Multi-Chain');
      if (curator.protocols.length > 2) tags.push('Multi-Protocol');
      if (curator.totalTvl > 500_000_000) tags.push('Large Cap');
      // Check stablecoin focus from vault data
      const curatorVaults = allYieldPools.filter(
        v => v.project?.toLowerCase().includes(curator.slug) || v.project?.toLowerCase().includes(curator.name.toLowerCase())
      );
      if (curatorVaults.length > 0) {
        const stableTvl = curatorVaults.filter(v => v.stablecoin).reduce((s, v) => s + (v.tvlUsd || 0), 0);
        const totalVaultTvl = curatorVaults.reduce((s, v) => s + (v.tvlUsd || 0), 0);
        if (totalVaultTvl > 0 && stableTvl / totalVaultTvl > 0.7) tags.push('Stablecoin Focus');
      }
      if (tags.length > 0) curator.strategies = tags;
    }

    // Compute curator-level credit ratings (three-pillar system)
    //
    // LLTV / liquidity inputs:
    //   When real per-curator market data is available from `risk.ts` (it builds
    //   each curator's market list from Morpho's vault-allocation data), we use
    //   the TVL-weighted average LLTV and aggregated liquidity directly.
    //   When unavailable, we fall back to conservative defaults and tag the
    //   curator's `dataConfidence` as no-better-than 'medium' so the UI can
    //   surface "estimated rating" messaging.
    //
    // Default fallbacks (used only when riskMap has no data for the curator):
    //   - avgLltv: 0.86  (typical Morpho stablecoin market)
    //   - maxUtilization: 0.85, avgUtilization: 0.75
    //   - availableLiquidityUsd: 20% of TVL
    const DEFAULT_AVG_LLTV = 0.86;
    const DEFAULT_MAX_UTIL = 0.85;
    const DEFAULT_AVG_UTIL = 0.75;
    const DEFAULT_LIQUIDITY_PCT = 0.20;

    for (const curator of curators) {
      // Re-look up the curator's risk metrics — this is where real avgLltv lives.
      const riskMetrics = riskMap.get(normalizeName(curator.name))
        || riskMap.get(normalizeName(formatCuratorName(curator.name)))
        || (CURATOR_NAME_VARIANTS[curator.slug]
            ? CURATOR_NAME_VARIANTS[curator.slug].map(v => riskMap.get(normalizeName(v))).find(Boolean)
            : undefined);

      const hasRealMarketData = !!(riskMetrics && riskMetrics.marketsCount > 0 && riskMetrics.totalSupplyUsd > 0);

      const avgLltv = hasRealMarketData ? riskMetrics.avgLltv : DEFAULT_AVG_LLTV;
      const maxUtilization = hasRealMarketData ? riskMetrics.maxUtilization : DEFAULT_MAX_UTIL;
      const avgUtilization = hasRealMarketData
        ? riskMetrics.avgUtilization
        : (curator.avgUtilization ?? DEFAULT_AVG_UTIL);
      const availableLiquidityUsd = hasRealMarketData
        ? riskMetrics.availableLiquidityUsd
        : (curator.totalTvl || 0) * DEFAULT_LIQUIDITY_PCT;

      // Pillar 1: Capital Safety
      const capitalSafety = assessCapitalSafety({
        hasBadDebt: curator.hasBadDebt || false,
        badDebtUsd: 0, // Not available at curator level
        tvlUsd: curator.totalTvl || 0,
        hasOracleWarning: (curator.redWarningCount || 0) > 0,
        avgLltv,
        markets: [], // Market-level data not available at curator aggregate level
      });

      // Pillar 2: Liquidity Health
      const liquidityHealth = assessLiquidityHealth({
        tvlUsd: curator.totalTvl || 0,
        availableLiquidityUsd,
        maxUtilization,
        avgUtilization,
        avgLltv,
        markets: [], // Market-level data not available at curator aggregate level
      });

      // Pillar 3: Curator Quality
      const curatorQuality = assessCuratorQuality({
        curatorName: curator.name,
        hasHistoricalBadDebt: curator.hasBadDebt || false,
        incidentCount: (curator.redWarningCount || 0) + (curator.criticalWarnings?.length || 0),
        ageMonths: 12, // Assume established curators (conservative default)
        totalTvlManaged: curator.totalTvl || 0,
        exoticAssetPct: 0.2, // Conservative default — detailed data not available
        avgLltv,
        vaultCount: curator.vaultCount || 1,
        avgMarketsPerVault: 3, // Default estimate
        chainCount: curator.chains?.length || 1,
        performanceFee: (curator.avgPerformanceFee || 0) / 100, // Convert percentage to decimal
      });

      // Downgrade confidence when rating uses fallback data — UI can show "estimated"
      if (!hasRealMarketData && curator.dataConfidence === 'high') {
        curator.dataConfidence = 'medium';
      }
      curator.ratingEstimated = !hasRealMarketData;

      curator.capitalSafetyRating = capitalSafety.rating;
      curator.liquidityHealthRating = liquidityHealth.rating;
      curator.curatorQualityRating = curatorQuality.rating;

      // Composite: weighted average of pillar scores (Capital 50%, Liquidity 30%, Curator 20%)
      const compositeScore =
        capitalSafety.score * 0.50 +
        liquidityHealth.score * 0.30 +
        curatorQuality.score * 0.20;
      curator.creditRating = scoreToRating(compositeScore);
      curator.investmentGrade = isInvestmentGrade(curator.creditRating);
    }

    // Add comprehensive validation info
    const sources = [];
    const morphoTvlCount = curators.filter(c => c.tvlSource === 'morpho').length;
    const kaminoTvlCount = curators.filter(c => c.tvlSource === 'kamino').length;
    const eulerTvlCount = curators.filter(c => c.tvlSource === 'euler').length;
    const kaminoCuratorCount = curators.filter(c => c.kaminoTvl).length;
    const eulerCuratorCount = curators.filter(c => c.eulerTvl).length;

    if (morphoTvlCount > 0) sources.push(`Morpho On-chain (${morphoTvlCount})`);
    if (kaminoTvlCount > 0) sources.push(`Kamino On-chain (${kaminoTvlCount})`);
    if (eulerTvlCount > 0) sources.push(`Euler On-chain (${eulerTvlCount})`);
    sources.push('DeFiLlama');
    if (duneCuratorData.length > 0) sources.push('Dune');
    if (morphoFeeData.length > 0) sources.push('Morpho Fees');
    if (eulerFeeData.length > 0) sources.push('Euler V2');
    if (riskData) sources.push('Risk API');

    const validation = {
      source: sources.join(' + '),
      timestamp: new Date().toISOString(),
      curatorCount: curators.length,
      totalTvl: curators.reduce((sum, c) => sum + c.totalTvl, 0),
      // TVL source breakdown (authoritative sources)
      morphoTvlCount,
      kaminoTvlCount,
      eulerTvlCount,
      defillamaTvlCount: curators.filter(c => c.tvlSource === 'defillama').length,
      // Data availability
      duneDataAvailable: duneCuratorData.length > 0,
      morphoFeeDataAvailable: morphoFeeData.length > 0,
      eulerFeeDataAvailable: eulerFeeData.length > 0,
      kaminoDataAvailable: kaminoCuratorData.length > 0,
      kaminoDataStale: isKaminoDataStale(),
      eulerTvlDataAvailable: eulerCuratorTvl.length > 0,
      riskDataAvailable: riskData !== null,
      // Quality metrics
      crossReferencedCount: crossReferenced.filter(c => c.dataSource === 'both').length,
      highConfidenceCount: curators.filter(c => c.dataConfidence === 'high').length,
      curatorsWithFeeData: curators.filter(c => c.avgPerformanceFee !== undefined).length,
      curatorsWithRiskData: curators.filter(c => c.riskLevel !== undefined).length,
      curatorsWithKaminoData: kaminoCuratorCount,
      curatorsWithEulerData: eulerCuratorCount,
    };

    return NextResponse.json({ curators, validation, _meta: { dataSources: tracker.getSummary() } });
  } catch (error) {
    console.error('Error fetching curators:', error);
    return NextResponse.json(
      { error: 'Failed to fetch curator data', curators: [], validation: { source: 'error' } },
      { status: 500 }
    );
  }
}

// formatCuratorName imported from @/lib/curator-names

// Estimate vault count based on TVL (rough heuristic)
function estimateVaultCount(tvl: number): number {
  if (tvl > 1_000_000_000) return Math.floor(40 + (tvl / 100_000_000));
  if (tvl > 500_000_000) return Math.floor(25 + (tvl / 50_000_000));
  if (tvl > 100_000_000) return Math.floor(10 + (tvl / 20_000_000));
  return Math.floor(5 + (tvl / 10_000_000));
}
