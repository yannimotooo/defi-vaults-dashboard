// Risk Metrics Module
// Fetches and aggregates risk data from Morpho, Euler, and other protocols

import { decimalToPercent } from './fees';

const MORPHO_GRAPHQL_API = 'https://blue-api.morpho.org/graphql';

// Risk warning levels
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// Risk scoring thresholds
const BAD_DEBT_CRITICAL = 0.01;     // >1% of supply = max bad debt score
const BAD_DEBT_HIGH = 0.001;        // >0.1%
const BAD_DEBT_MEDIUM = 0.0001;     // >0.01%
const UTILIZATION_CRITICAL = 0.95;
const UTILIZATION_HIGH = 0.9;
const UTILIZATION_ELEVATED = 0.8;
const UTILIZATION_MODERATE = 0.7;
const LIQ_RATIO_CRITICAL = 0.05;    // >5% of supply liquidated in 7d
const LIQ_RATIO_HIGH = 0.02;
const LIQ_RATIO_MEDIUM = 0.01;
const RISK_LEVEL_CRITICAL = 70;
const RISK_LEVEL_HIGH = 40;
const RISK_LEVEL_MEDIUM = 20;

// Morpho warning types that indicate risk
export const CRITICAL_WARNING_TYPES = [
  'bad_debt_unrealized',
  'bad_debt_realized',
  'incorrect_oracle_configuration',
];

export const HIGH_WARNING_TYPES = [
  'unrecognized_loan_asset',
  'unrecognized_collateral_asset',
];

// Risk data interfaces
export interface LiquidationEvent {
  hash: string;
  timestamp: number;
  seizedAssetsUsd: number | null;
  repaidAssetsUsd: number;
  badDebtAssetsUsd: number;
  liquidator: string;
  marketKey: string;
  chain: string;
}

export interface MarketWarning {
  type: string;
  level: 'RED' | 'YELLOW';
}

export interface MarketRiskData {
  uniqueKey: string;
  loanAsset: string;
  collateralAsset: string;
  lltv: number; // Liquidation LTV (0-1)
  supplyUsd: number;
  borrowUsd: number;
  utilization: number;
  liquidityUsd: number;
  warnings: MarketWarning[];
  hasRedWarning: boolean;
  hasBadDebt: boolean;
}

export interface CuratorRiskMetrics {
  curatorName: string;
  curatorSlug: string;
  // Liquidation metrics
  totalLiquidationVolume24h: number;
  totalLiquidationVolume7d: number;
  liquidationCount24h: number;
  liquidationCount7d: number;
  // Bad debt metrics
  totalBadDebtUsd: number;
  unrealizedBadDebtUsd: number;
  realizedBadDebtUsd: number;
  hasBadDebt: boolean;
  // Market health (decimal 0-1)
  avgUtilization: number;
  /** Highest utilization across all markets the curator allocates to (decimal 0-1). */
  maxUtilization: number;
  /**
   * TVL-weighted average liquidation LTV across the curator's markets (decimal 0-1).
   * Sourced from real Morpho market data — NOT estimated from utilization.
   * 0 means no markets / no data available.
   */
  avgLltv: number;
  /** Sum of `liquidityUsd` across all markets the curator allocates to. */
  availableLiquidityUsd: number;
  /** Total supplied USD across all markets the curator allocates to. */
  totalSupplyUsd: number;
  /** Total borrowed USD across all markets the curator allocates to. */
  totalBorrowUsd: number;
  highUtilizationMarkets: number; // Markets with >90% utilization
  // Risk warnings
  redWarningCount: number;
  yellowWarningCount: number;
  criticalWarnings: string[];
  // Overall risk score (0-100, higher = more risky)
  riskScore: number;
  riskLevel: RiskLevel;
  // Markets data
  marketsCount: number;
  marketsWithWarnings: number;
}

export interface ProtocolRiskSummary {
  protocol: string;
  totalSupplyUsd: number;
  totalBorrowUsd: number;
  totalLiquidationVolume7d: number;
  totalBadDebtUsd: number;
  avgUtilization: number;
  marketsCount: number;
  marketsWithRedWarnings: number;
  riskScore: number;
  riskLevel: RiskLevel;
}

// GraphQL query for Morpho liquidations
async function fetchMorphoLiquidations(hours: number = 168): Promise<LiquidationEvent[]> {
  const cutoffTimestamp = Math.floor(Date.now() / 1000) - (hours * 3600);

  const query = `
    query GetLiquidations($timestamp: Int!) {
      transactions(
        first: 1000
        where: {
          type_in: [MarketLiquidation]
          timestamp_gte: $timestamp
        }
        orderBy: Timestamp
        orderDirection: Desc
      ) {
        items {
          hash
          timestamp
          data {
            ... on MarketLiquidationTransactionData {
              seizedAssetsUsd
              repaidAssetsUsd
              badDebtAssetsUsd
              liquidator
              market {
                uniqueKey
                morphoBlue { chain { id } }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(MORPHO_GRAPHQL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { timestamp: cutoffTimestamp }
      }),
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      console.error('[Risk] Morpho liquidations API error:', response.status);
      return [];
    }

    const data = await response.json();
    const transactions = data?.data?.transactions?.items || [];

    return transactions.map((tx: {
      hash: string;
      timestamp: number;
      data: {
        seizedAssetsUsd: number | null;
        repaidAssetsUsd: number;
        badDebtAssetsUsd: number;
        liquidator: string;
        market: {
          uniqueKey: string;
          morphoBlue?: { chain?: { id?: number } };
        };
      };
    }) => ({
      hash: tx.hash,
      timestamp: tx.timestamp,
      seizedAssetsUsd: tx.data?.seizedAssetsUsd,
      repaidAssetsUsd: tx.data?.repaidAssetsUsd || 0,
      badDebtAssetsUsd: tx.data?.badDebtAssetsUsd || 0,
      liquidator: tx.data?.liquidator || '',
      marketKey: tx.data?.market?.uniqueKey || '',
      chain: tx.data?.market?.morphoBlue?.chain?.id?.toString() || '1',
    }));
  } catch (error) {
    console.error('[Risk] Error fetching Morpho liquidations:', error);
    return [];
  }
}

// GraphQL query for Morpho markets with risk data
async function fetchMorphoMarketsRisk(): Promise<MarketRiskData[]> {
  const query = `
    query GetMarketsRisk {
      markets(first: 500) {
        items {
          uniqueKey
          lltv
          loanAsset { symbol }
          collateralAsset { symbol }
          warnings { type level }
          state {
            supplyAssetsUsd
            borrowAssetsUsd
            utilization
            totalLiquidityUsd
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(MORPHO_GRAPHQL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      console.error('[Risk] Morpho markets API error:', response.status);
      return [];
    }

    const data = await response.json();
    const markets = data?.data?.markets?.items || [];

    return markets.map((m: {
      uniqueKey: string;
      lltv: string;
      loanAsset?: { symbol?: string };
      collateralAsset?: { symbol?: string };
      warnings?: Array<{ type: string; level: 'RED' | 'YELLOW' }>;
      state?: {
        supplyAssetsUsd?: number;
        borrowAssetsUsd?: number;
        utilization?: number;
        totalLiquidityUsd?: number;
      };
    }) => {
      const warnings = m.warnings || [];
      const hasRedWarning = warnings.some((w) => w.level === 'RED');
      const hasBadDebt = warnings.some((w) =>
        w.type === 'bad_debt_unrealized' || w.type === 'bad_debt_realized'
      );

      return {
        uniqueKey: m.uniqueKey,
        loanAsset: m.loanAsset?.symbol || 'Unknown',
        collateralAsset: m.collateralAsset?.symbol || 'Unknown',
        lltv: parseFloat(m.lltv) / 1e18, // Convert from wei
        supplyUsd: m.state?.supplyAssetsUsd || 0,
        borrowUsd: m.state?.borrowAssetsUsd || 0,
        utilization: m.state?.utilization || 0,
        liquidityUsd: m.state?.totalLiquidityUsd || 0,
        warnings,
        hasRedWarning,
        hasBadDebt,
      };
    });
  } catch (error) {
    console.error('[Risk] Error fetching Morpho markets:', error);
    return [];
  }
}

// Fetch vault-to-curator mappings from Morpho
async function fetchMorphoVaultCurators(): Promise<{
  marketToCurator: Map<string, string>;
  curatorVaults: Map<string, { name: string; tvl: number; marketKeys: string[] }[]>;
}> {
  // Query vaults with state.curators (the correct field) and state.allocation for market keys
  const query = `
    query GetVaultCurators {
      vaults(first: 500, orderBy: TotalAssets, orderDirection: Desc) {
        items {
          address
          name
          state {
            totalAssetsUsd
            curators { name }
            allocation {
              market { uniqueKey }
              supplyAssetsUsd
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(MORPHO_GRAPHQL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      console.error('[Risk] Morpho vaults API error:', response.status);
      return { marketToCurator: new Map(), curatorVaults: new Map() };
    }

    const data = await response.json();
    const vaults = data?.data?.vaults?.items || [];

    // Map market keys to curator names AND track curator vaults
    const marketToCurator = new Map<string, string>();
    const curatorVaults = new Map<string, { name: string; tvl: number; marketKeys: string[] }[]>();

    for (const vault of vaults) {
      // Curator name is in state.curators array
      const curators = vault.state?.curators || [];
      const curatorName = curators[0]?.name || 'Unknown';
      const tvl = vault.state?.totalAssetsUsd || 0;

      // Skip small or unknown vaults
      if (curatorName === 'Unknown' || tvl < 10000) continue;

      // Get market keys from state.allocation
      const marketKeys: string[] = [];
      for (const alloc of vault.state?.allocation || []) {
        if (alloc.market?.uniqueKey) {
          marketKeys.push(alloc.market.uniqueKey);
          // Map market -> curator (first curator wins if multiple vaults use same market)
          if (!marketToCurator.has(alloc.market.uniqueKey)) {
            marketToCurator.set(alloc.market.uniqueKey, curatorName);
          }
        }
      }

      // Track vault by curator
      if (!curatorVaults.has(curatorName)) {
        curatorVaults.set(curatorName, []);
      }
      curatorVaults.get(curatorName)!.push({
        name: vault.name,
        tvl,
        marketKeys,
      });
    }

    console.log(`[Risk] Fetched ${vaults.length} vaults, mapped ${marketToCurator.size} markets to ${curatorVaults.size} curators`);
    return { marketToCurator, curatorVaults };
  } catch (error) {
    console.error('[Risk] Error fetching vault curators:', error);
    return { marketToCurator: new Map(), curatorVaults: new Map() };
  }
}

// Calculate risk score (0-100)
function calculateRiskScore(metrics: {
  badDebtUsd: number;
  supplyUsd: number;
  avgUtilization: number;
  redWarningCount: number;
  liquidationVolume7d: number;
}): number {
  let score = 0;

  // Bad debt component (0-40 points)
  if (metrics.supplyUsd > 0) {
    const badDebtRatio = metrics.badDebtUsd / metrics.supplyUsd;
    if (badDebtRatio > BAD_DEBT_CRITICAL) score += 40;
    else if (badDebtRatio > BAD_DEBT_HIGH) score += 30;
    else if (badDebtRatio > BAD_DEBT_MEDIUM) score += 20;
    else if (badDebtRatio > 0) score += 10;
  }

  // Utilization component (0-20 points)
  if (metrics.avgUtilization > UTILIZATION_CRITICAL) score += 20;
  else if (metrics.avgUtilization > UTILIZATION_HIGH) score += 15;
  else if (metrics.avgUtilization > UTILIZATION_ELEVATED) score += 10;
  else if (metrics.avgUtilization > UTILIZATION_MODERATE) score += 5;

  // Warning component (0-25 points)
  score += Math.min(metrics.redWarningCount * 5, 25);

  // Liquidation volume component (0-15 points)
  if (metrics.supplyUsd > 0) {
    const liqRatio = metrics.liquidationVolume7d / metrics.supplyUsd;
    if (liqRatio > LIQ_RATIO_CRITICAL) score += 15;
    else if (liqRatio > LIQ_RATIO_HIGH) score += 10;
    else if (liqRatio > LIQ_RATIO_MEDIUM) score += 5;
  }

  return Math.min(score, 100);
}

// Get risk level from score
function getRiskLevel(score: number): RiskLevel {
  if (score >= RISK_LEVEL_CRITICAL) return 'CRITICAL';
  if (score >= RISK_LEVEL_HIGH) return 'HIGH';
  if (score >= RISK_LEVEL_MEDIUM) return 'MEDIUM';
  return 'LOW';
}

// Main function: Get all risk metrics
export async function getRiskMetrics(): Promise<{
  curators: CuratorRiskMetrics[];
  protocolSummary: ProtocolRiskSummary;
  recentLiquidations: LiquidationEvent[];
  marketsWithBadDebt: MarketRiskData[];
  timestamp: string;
}> {
  // Fetch all data in parallel
  const [liquidations, markets, vaultData] = await Promise.all([
    fetchMorphoLiquidations(168), // 7 days
    fetchMorphoMarketsRisk(),
    fetchMorphoVaultCurators(),
  ]);

  const { marketToCurator } = vaultData;

  const now = Math.floor(Date.now() / 1000);
  const oneDayAgo = now - 86400;

  // Aggregate by curator
  const curatorMetrics = new Map<string, {
    liquidationVolume24h: number;
    liquidationVolume7d: number;
    liquidationCount24h: number;
    liquidationCount7d: number;
    badDebtUsd: number;
    markets: MarketRiskData[];
  }>();

  // Process liquidations
  for (const liq of liquidations) {
    const curator = marketToCurator.get(liq.marketKey) || 'Unattributed';

    if (!curatorMetrics.has(curator)) {
      curatorMetrics.set(curator, {
        liquidationVolume24h: 0,
        liquidationVolume7d: 0,
        liquidationCount24h: 0,
        liquidationCount7d: 0,
        badDebtUsd: 0,
        markets: [],
      });
    }

    const metrics = curatorMetrics.get(curator)!;
    const volume = liq.repaidAssetsUsd || 0;

    metrics.liquidationVolume7d += volume;
    metrics.liquidationCount7d += 1;
    metrics.badDebtUsd += liq.badDebtAssetsUsd || 0;

    if (liq.timestamp >= oneDayAgo) {
      metrics.liquidationVolume24h += volume;
      metrics.liquidationCount24h += 1;
    }
  }

  // Process markets
  for (const market of markets) {
    const curator = marketToCurator.get(market.uniqueKey) || 'Unattributed';

    if (!curatorMetrics.has(curator)) {
      curatorMetrics.set(curator, {
        liquidationVolume24h: 0,
        liquidationVolume7d: 0,
        liquidationCount24h: 0,
        liquidationCount7d: 0,
        badDebtUsd: 0,
        markets: [],
      });
    }

    curatorMetrics.get(curator)!.markets.push(market);
  }

  // Build curator risk metrics
  const curators: CuratorRiskMetrics[] = [];

  for (const [curatorName, data] of curatorMetrics.entries()) {
    if (curatorName === 'Unattributed') continue;

    const totalSupply = data.markets.reduce((sum, m) => sum + m.supplyUsd, 0);
    const totalBorrow = data.markets.reduce((sum, m) => sum + m.borrowUsd, 0);
    const totalLiquidity = data.markets.reduce((sum, m) => sum + m.liquidityUsd, 0);
    const avgUtilization = totalSupply > 0 ? totalBorrow / totalSupply : 0;
    const maxUtilization = data.markets.length > 0
      ? Math.max(...data.markets.map(m => m.utilization))
      : 0;
    // TVL-weighted average LLTV across the curator's markets (real on-chain data).
    // Falls back to 0 (no markets) — consumer should treat 0 as "unknown" and use defaults.
    const avgLltv = totalSupply > 0
      ? data.markets.reduce((sum, m) => sum + m.lltv * m.supplyUsd, 0) / totalSupply
      : 0;
    const highUtilizationMarkets = data.markets.filter(m => m.utilization > 0.9).length;

    const redWarnings = data.markets.flatMap(m => m.warnings.filter(w => w.level === 'RED'));
    const yellowWarnings = data.markets.flatMap(m => m.warnings.filter(w => w.level === 'YELLOW'));
    const criticalWarnings = redWarnings
      .filter(w => CRITICAL_WARNING_TYPES.includes(w.type))
      .map(w => w.type);

    const riskScore = calculateRiskScore({
      badDebtUsd: data.badDebtUsd,
      supplyUsd: totalSupply,
      avgUtilization,
      redWarningCount: redWarnings.length,
      liquidationVolume7d: data.liquidationVolume7d,
    });

    curators.push({
      curatorName,
      curatorSlug: curatorName.toLowerCase().replace(/\s+/g, '-'),
      totalLiquidationVolume24h: data.liquidationVolume24h,
      totalLiquidationVolume7d: data.liquidationVolume7d,
      liquidationCount24h: data.liquidationCount24h,
      liquidationCount7d: data.liquidationCount7d,
      totalBadDebtUsd: data.badDebtUsd,
      unrealizedBadDebtUsd: 0, // Not available from Morpho API — only realized bad debt is tracked on-chain
      realizedBadDebtUsd: data.badDebtUsd,
      hasBadDebt: data.badDebtUsd > 0 || data.markets.some(m => m.hasBadDebt),
      avgUtilization,
      maxUtilization,
      avgLltv,
      availableLiquidityUsd: totalLiquidity,
      totalSupplyUsd: totalSupply,
      totalBorrowUsd: totalBorrow,
      highUtilizationMarkets,
      redWarningCount: redWarnings.length,
      yellowWarningCount: yellowWarnings.length,
      criticalWarnings: [...new Set(criticalWarnings)],
      riskScore,
      riskLevel: getRiskLevel(riskScore),
      marketsCount: data.markets.length,
      marketsWithWarnings: data.markets.filter(m => m.warnings.length > 0).length,
    });
  }

  // Sort by risk score descending
  curators.sort((a, b) => b.riskScore - a.riskScore);

  // Protocol summary
  const allMarkets = markets.filter(m => m.supplyUsd > 1000); // Filter dust
  const totalSupply = allMarkets.reduce((sum, m) => sum + m.supplyUsd, 0);
  const totalBorrow = allMarkets.reduce((sum, m) => sum + m.borrowUsd, 0);
  const totalLiqVolume = liquidations.reduce((sum, l) => sum + (l.repaidAssetsUsd || 0), 0);
  const totalBadDebt = liquidations.reduce((sum, l) => sum + (l.badDebtAssetsUsd || 0), 0);

  const protocolRiskScore = calculateRiskScore({
    badDebtUsd: totalBadDebt,
    supplyUsd: totalSupply,
    avgUtilization: totalSupply > 0 ? totalBorrow / totalSupply : 0,
    redWarningCount: allMarkets.filter(m => m.hasRedWarning).length,
    liquidationVolume7d: totalLiqVolume,
  });

  const protocolSummary: ProtocolRiskSummary = {
    protocol: 'Morpho',
    totalSupplyUsd: totalSupply,
    totalBorrowUsd: totalBorrow,
    totalLiquidationVolume7d: totalLiqVolume,
    totalBadDebtUsd: totalBadDebt,
    avgUtilization: totalSupply > 0 ? totalBorrow / totalSupply : 0,
    marketsCount: allMarkets.length,
    marketsWithRedWarnings: allMarkets.filter(m => m.hasRedWarning).length,
    riskScore: protocolRiskScore,
    riskLevel: getRiskLevel(protocolRiskScore),
  };

  // Markets with bad debt
  const marketsWithBadDebt = markets.filter(m => m.hasBadDebt);

  // Recent liquidations (last 24h, top 20)
  const recentLiquidations = liquidations
    .filter(l => l.timestamp >= oneDayAgo)
    .sort((a, b) => (b.repaidAssetsUsd || 0) - (a.repaidAssetsUsd || 0))
    .slice(0, 20);

  return {
    curators,
    protocolSummary,
    recentLiquidations,
    marketsWithBadDebt,
    timestamp: new Date().toISOString(),
  };
}

// Get risk metrics for a specific curator
export async function getCuratorRiskMetrics(curatorSlug: string): Promise<CuratorRiskMetrics | null> {
  const { curators } = await getRiskMetrics();
  return curators.find(c =>
    c.curatorSlug === curatorSlug ||
    c.curatorName.toLowerCase().replace(/\s+/g, '-') === curatorSlug
  ) || null;
}

// ============================================
// Vault-Level Risk Metrics
// ============================================

export interface VaultRiskMetrics {
  address: string;
  name: string;
  symbol: string;
  curator: string;
  chain: number;
  tvlUsd: number;
  apy: number;
  // Risk metrics
  riskScore: number;  // 0-100
  riskLevel: RiskLevel;
  // Market allocation details
  markets: Array<{
    uniqueKey: string;
    loanAsset: string;
    collateralAsset: string;
    allocationUsd: number;
    allocationPct: number;
    lltv: number;  // Liquidation LTV (e.g., 0.86 = 86%)
    utilization: number;  // Current utilization (e.g., 0.85 = 85%)
    warnings: MarketWarning[];
    hasRedWarning: boolean;
    hasBadDebt: boolean;
  }>;
  // Aggregated risk indicators
  maxUtilization: number;
  avgLltv: number;
  totalWarnings: number;
  redWarningCount: number;
  hasBadDebt: boolean;
  criticalWarnings: string[];
}

// Fetch vault-level risk data from Morpho
export async function getVaultRiskMetrics(): Promise<VaultRiskMetrics[]> {
  const query = `
    query GetVaultRisk {
      vaults(first: 500) {
        items {
          address
          name
          symbol
          chain { id }
          state {
            totalAssetsUsd
            apy
            curators { name }
            allocation {
              market {
                uniqueKey
                lltv
                loanAsset { symbol }
                collateralAsset { symbol }
                warnings { type level }
                state {
                  utilization
                  supplyAssetsUsd
                  borrowAssetsUsd
                }
              }
              supplyAssetsUsd
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(MORPHO_GRAPHQL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      console.error('[Risk] Vault risk API error:', response.status);
      return [];
    }

    const data = await response.json();
    const vaults = data?.data?.vaults?.items || [];

    const result: VaultRiskMetrics[] = [];

    for (const vault of vaults) {
      const tvlUsd = vault.state?.totalAssetsUsd || 0;
      if (tvlUsd < 10000) continue; // Skip dust vaults

      const curators = vault.state?.curators || [];
      const curator = curators[0]?.name || 'Unknown';
      const allocations = vault.state?.allocation || [];

      // Process market allocations
      const markets: VaultRiskMetrics['markets'] = [];
      let maxUtilization = 0;
      let weightedLltv = 0;
      let totalAllocation = 0;
      let totalWarnings = 0;
      let redWarningCount = 0;
      let hasBadDebt = false;
      const criticalWarnings: string[] = [];

      for (const alloc of allocations) {
        const market = alloc.market;
        if (!market) continue;

        const allocationUsd = alloc.supplyAssetsUsd || 0;
        if (allocationUsd < 100) continue; // Skip dust allocations

        const lltv = parseFloat(market.lltv || '0') / 1e18;
        const utilization = market.state?.utilization || 0;
        const warnings = market.warnings || [];

        const hasRedWarning = warnings.some((w: MarketWarning) => w.level === 'RED');
        const marketHasBadDebt = warnings.some((w: MarketWarning) =>
          w.type === 'bad_debt_unrealized' || w.type === 'bad_debt_realized'
        );

        markets.push({
          uniqueKey: market.uniqueKey,
          loanAsset: market.loanAsset?.symbol || 'Unknown',
          collateralAsset: market.collateralAsset?.symbol || 'Unknown',
          allocationUsd,
          allocationPct: tvlUsd > 0 ? allocationUsd / tvlUsd : 0,
          lltv,
          utilization,
          warnings,
          hasRedWarning,
          hasBadDebt: marketHasBadDebt,
        });

        // Track aggregated metrics
        if (utilization > maxUtilization) maxUtilization = utilization;
        weightedLltv += lltv * allocationUsd;
        totalAllocation += allocationUsd;
        totalWarnings += warnings.length;
        if (hasRedWarning) redWarningCount++;
        if (marketHasBadDebt) hasBadDebt = true;

        // Track critical warnings
        for (const w of warnings) {
          if (CRITICAL_WARNING_TYPES.includes(w.type) && !criticalWarnings.includes(w.type)) {
            criticalWarnings.push(w.type);
          }
        }
      }

      const avgLltv = totalAllocation > 0 ? weightedLltv / totalAllocation : 0;

      // Calculate vault risk score
      const riskScore = calculateVaultRiskScore({
        maxUtilization,
        avgLltv,
        redWarningCount,
        hasBadDebt,
        marketsCount: markets.length,
      });

      result.push({
        address: vault.address,
        name: vault.name,
        symbol: vault.symbol,
        curator,
        chain: vault.chain?.id || 1,
        tvlUsd,
        apy: decimalToPercent(vault.state?.apy || 0),
        riskScore,
        riskLevel: getRiskLevel(riskScore),
        markets,
        maxUtilization,
        avgLltv,
        totalWarnings,
        redWarningCount,
        hasBadDebt,
        criticalWarnings,
      });
    }

    // Sort by TVL
    result.sort((a, b) => b.tvlUsd - a.tvlUsd);

    console.log(`[Risk] Fetched risk metrics for ${result.length} vaults`);
    return result;
  } catch (error) {
    console.error('[Risk] Error fetching vault risk:', error);
    return [];
  }
}

// Calculate vault-level risk score (legacy - kept for backwards compatibility)
function calculateVaultRiskScore(metrics: {
  maxUtilization: number;
  avgLltv: number;
  redWarningCount: number;
  hasBadDebt: boolean;
  marketsCount: number;
}): number {
  let score = 0;

  // Utilization risk (0-35 points)
  // Higher utilization = higher risk of liquidation cascade
  if (metrics.maxUtilization > 0.98) score += 35;
  else if (metrics.maxUtilization > 0.95) score += 25;
  else if (metrics.maxUtilization > 0.90) score += 15;
  else if (metrics.maxUtilization > 0.80) score += 8;
  else if (metrics.maxUtilization > 0.70) score += 4;

  // LLTV risk (0-25 points)
  // Higher LLTV = less margin before liquidation
  if (metrics.avgLltv > 0.95) score += 25;
  else if (metrics.avgLltv > 0.90) score += 18;
  else if (metrics.avgLltv > 0.85) score += 12;
  else if (metrics.avgLltv > 0.80) score += 6;

  // Warning risk (0-25 points)
  score += Math.min(metrics.redWarningCount * 8, 25);

  // Bad debt risk (0-15 points)
  if (metrics.hasBadDebt) score += 15;

  return Math.min(score, 100);
}

// =============================================================================
// THREE-PILLAR CREDIT RATING SYSTEM
// =============================================================================

import {
  type VaultCreditRating,
  type CapitalSafetyInput,
  type LiquidityHealthInput,
  type CuratorQualityInput,
  calculateVaultCreditRating,
} from './risk-rating';

export type { VaultCreditRating };

// Extended vault metrics with credit rating
export interface VaultWithCreditRating extends VaultRiskMetrics {
  creditRating: VaultCreditRating;
}

// Calculate credit rating for a single vault
export function calculateVaultCredit(vault: VaultRiskMetrics, curatorData?: {
  ageMonths?: number;
  totalTvlManaged?: number;
  vaultCount?: number;
  chainCount?: number;
  performanceFee?: number;
  hasHistoricalBadDebt?: boolean;
}): VaultCreditRating {
  // Build Capital Safety input
  const capitalSafetyInput: CapitalSafetyInput = {
    hasBadDebt: vault.hasBadDebt,
    badDebtUsd: 0, // Would need to aggregate from markets
    tvlUsd: vault.tvlUsd,
    hasOracleWarning: vault.criticalWarnings.some(w =>
      w.includes('oracle') || w.includes('ORACLE')
    ),
    avgLltv: vault.avgLltv,
    markets: vault.markets.map(m => ({
      collateralAsset: m.collateralAsset,
      loanAsset: m.loanAsset,
      allocationPct: m.allocationPct,
      lltv: m.lltv,
      hasBadDebt: m.hasBadDebt,
      hasRedWarning: m.hasRedWarning,
    })),
  };

  // Build Liquidity Health input
  const totalLiquidity = vault.markets.reduce((sum, m) => {
    // Liquidity = supply * (1 - utilization)
    const marketLiquidity = m.allocationUsd * (1 - m.utilization);
    return sum + marketLiquidity;
  }, 0);

  const liquidityHealthInput: LiquidityHealthInput = {
    tvlUsd: vault.tvlUsd,
    availableLiquidityUsd: totalLiquidity,
    maxUtilization: vault.maxUtilization,
    avgUtilization: vault.markets.length > 0
      ? vault.markets.reduce((sum, m) => sum + m.utilization * m.allocationPct, 0)
      : vault.maxUtilization,
    avgLltv: vault.avgLltv,
    markets: vault.markets.map(m => ({
      utilization: m.utilization,
      lltv: m.lltv,
      liquidityUsd: m.allocationUsd * (1 - m.utilization),
      allocationPct: m.allocationPct,
      supplyUsd: m.allocationUsd,
    })),
  };

  // Build Curator Quality input (with defaults if no curator data)
  const curatorQualityInput: CuratorQualityInput = {
    curatorName: vault.curator,
    hasHistoricalBadDebt: curatorData?.hasHistoricalBadDebt ?? vault.hasBadDebt,
    incidentCount: vault.hasBadDebt ? 1 : 0,
    ageMonths: curatorData?.ageMonths ?? 6, // Default to 6 months if unknown
    totalTvlManaged: curatorData?.totalTvlManaged ?? vault.tvlUsd,
    exoticAssetPct: calculateExoticAssetPct(vault.markets),
    avgLltv: vault.avgLltv,
    vaultCount: curatorData?.vaultCount ?? 1,
    avgMarketsPerVault: vault.markets.length,
    chainCount: curatorData?.chainCount ?? 1,
    performanceFee: curatorData?.performanceFee ?? 0.10, // Default 10%
  };

  return calculateVaultCreditRating({
    capitalSafety: capitalSafetyInput,
    liquidityHealth: liquidityHealthInput,
    curatorQuality: curatorQualityInput,
  });
}

// Helper to calculate exotic asset percentage
const BLUECHIP_ASSETS = [
  'WETH', 'ETH', 'WBTC', 'BTC', 'USDC', 'USDT', 'DAI', 'FRAX',
  'stETH', 'wstETH', 'cbETH', 'rETH', 'sfrxETH', 'WSTETH',
  'USDS', 'sUSDS', 'PYUSD', 'USDM', 'USDe', 'sUSDe'
];

function calculateExoticAssetPct(markets: VaultRiskMetrics['markets']): number {
  let exoticAllocation = 0;
  let totalAllocation = 0;

  for (const market of markets) {
    const isBluechip = BLUECHIP_ASSETS.some(
      a => market.collateralAsset.toUpperCase().includes(a) ||
           market.loanAsset.toUpperCase().includes(a)
    );

    totalAllocation += market.allocationPct;
    if (!isBluechip) {
      exoticAllocation += market.allocationPct;
    }
  }

  return totalAllocation > 0 ? exoticAllocation / totalAllocation : 0;
}

// Get vault risk metrics with credit ratings
export async function getVaultRiskWithCreditRatings(): Promise<VaultWithCreditRating[]> {
  const vaults = await getVaultRiskMetrics();

  // Group vaults by curator to get curator-level stats
  const curatorStats = new Map<string, {
    vaultCount: number;
    totalTvl: number;
    chains: Set<number>;
    hasHistoricalBadDebt: boolean;
  }>();

  for (const vault of vaults) {
    const stats = curatorStats.get(vault.curator) || {
      vaultCount: 0,
      totalTvl: 0,
      chains: new Set<number>(),
      hasHistoricalBadDebt: false,
    };

    stats.vaultCount++;
    stats.totalTvl += vault.tvlUsd;
    stats.chains.add(vault.chain);
    if (vault.hasBadDebt) stats.hasHistoricalBadDebt = true;

    curatorStats.set(vault.curator, stats);
  }

  // Calculate credit ratings for each vault
  return vaults.map(vault => {
    const stats = curatorStats.get(vault.curator);

    const creditRating = calculateVaultCredit(vault, {
      vaultCount: stats?.vaultCount,
      totalTvlManaged: stats?.totalTvl,
      chainCount: stats?.chains.size,
      hasHistoricalBadDebt: stats?.hasHistoricalBadDebt,
    });

    return {
      ...vault,
      creditRating,
    };
  });
}
