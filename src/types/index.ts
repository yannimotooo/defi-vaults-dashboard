// Data types for DeFi Vault Dashboard

import type { VaultCreditRating, CreditRating, PillarRating } from '@/lib/risk-rating';

export type { VaultCreditRating, CreditRating, PillarRating };

export interface ChainTVL {
  chain: string;
  tvl: number;
  change24h: number;
  change7d: number;
}

export interface ProtocolTVL {
  name: string;
  slug: string;
  tvl: number;
  change24h: number;
  change7d: number;
  change30d?: number;  // Calculated from historical TVL data
  chains: string[];
  category: string;
}

export interface Curator {
  name: string;
  slug: string;
  totalTvl: number;
  vaultCount: number;
  vaultCountEstimated?: boolean;  // True if vault count is estimated from TVL
  chains: string[];
  protocols: string[];
  avgApy: number;
  netFlow7d: number;
  netFlow30d: number;
  // TVL source tracking (authoritative on-chain sources when available)
  tvlSource?: 'morpho' | 'kamino' | 'euler' | 'defillama';
  morphoTvl?: number;      // On-chain Morpho TVL (authoritative)
  defillamaTvl?: number;   // DeFiLlama aggregated TVL (fallback)
  // Kamino (Solana) data - now with actual on-chain TVL
  kaminoTvl?: number;      // On-chain Kamino TVL on Solana (authoritative)
  kaminoVaultCount?: number;  // Number of Kamino vaults managed
  // Euler data
  eulerTvl?: number;       // On-chain Euler TVL (authoritative)
  eulerVaultCount?: number;  // Number of Euler vaults managed
  // Cross-reference validation
  dataConfidence?: 'high' | 'medium' | 'low';
  duneTvl?: number | null;
  // Fee economics (from Morpho)
  avgPerformanceFee?: number;  // Percentage of yield taken as fee
  avgManagementFee?: number;   // Annual percentage fee on TVL
  estimatedAnnualRevenue?: number;  // Estimated fee revenue at current TVL/APY
  grossApy?: number;  // APY before fees
  netApy?: number;    // APY after fees
  // Risk metrics (from Morpho GraphQL)
  riskScore?: number;  // 0-100, higher = more risky (legacy)
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';  // Legacy
  liquidationVolume24h?: number;
  liquidationVolume7d?: number;
  hasBadDebt?: boolean;
  redWarningCount?: number;
  yellowWarningCount?: number;
  criticalWarnings?: string[];
  avgUtilization?: number;
  // Strategy tags (computed server-side)
  strategies?: string[];
  // New three-pillar credit rating
  creditRating?: CreditRating;  // Composite credit rating (AAA-C)
  capitalSafetyRating?: CreditRating;
  liquidityHealthRating?: CreditRating;
  curatorQualityRating?: CreditRating;
  investmentGrade?: boolean;
}

export interface Vault {
  name: string;
  curator: string;
  protocol: string;
  chain: string;
  asset: string;
  tvl: number;
  apy: number;
  apyBase: number;
  apyReward: number;
  utilization: number;
  riskRating: 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D';
}

export interface MarketOverview {
  totalTvl: number;
  totalTvlChange24h: number;
  totalTvlChange7d: number;
  evmTvl: number;
  solanaTvl: number;
  totalVaults: number;
  totalCurators: number;
  tvlByChain: ChainTVL[];
  tvlByProtocol: ProtocolTVL[];
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
}

export interface CuratorTimeSeries {
  curator: string;
  data: TimeSeriesPoint[];
}

// Data validation types
export interface DataValidation {
  source: string;
  timestamp: string;
  curatorCount?: number;
  totalTvl?: number;
  verified?: boolean;
  // Dune integration status
  duneDataAvailable?: boolean;
  crossReferencedCount?: number;
  highConfidenceCount?: number;
}

export interface CuratorApiResponse {
  curators: Curator[];
  validation: DataValidation;
}

// Historical curator data for TVL-over-time charts
export interface HistoricalCuratorData {
  name: string;
  slug: string;
  color: string;
  data: { date: number; tvl: number }[];
}

// Vault data from DeFiLlama yield pools
export interface VaultData {
  id: string;
  name: string;
  chain: string;
  project: string;
  symbol: string;
  tvl: number;
  apy: number;
  apyBase: number;
  apyReward: number;
  apyChange7d: number;
  stablecoin: boolean;
  exposure: string;
  poolMeta: string | null;
  // Curator attribution (from Morpho on-chain data)
  curator?: string | null;
  isRawMarket?: boolean;
  // Risk metrics
  riskScore?: number;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  maxUtilization?: number;
  avgLltv?: number;
  hasBadDebt?: boolean;
  redWarningCount?: number;
  criticalWarnings?: string[];
  markets?: Array<{
    uniqueKey: string;
    loanAsset: string;
    collateralAsset: string;
    allocationUsd: number;
    allocationPct: number;
    lltv: number;
    utilization: number;
    hasRedWarning: boolean;
    hasBadDebt: boolean;
  }>;
  // Credit rating
  creditRating?: VaultCreditRating;
}

// Liquidation event from multi-protocol aggregation
export interface LiquidationEvent {
  id: string;
  hash: string;
  timestamp: number;
  protocol: string;
  chain: string;
  loanAsset: string;
  collateralAsset: string;
  repaidUsd: number;
  seizedUsd: number;
  badDebtUsd: number;
  liquidator: string;
  borrower?: string;
  hasSignificantBadDebt: boolean;
}

// Protocol liquidation summary
export interface ProtocolLiquidationSummary {
  protocol: string;
  volume24h: number;
  volume7d: number;
  count24h: number;
  count7d: number;
  badDebt24h: number;
  badDebt7d: number;
  topMarkets: Array<{
    loanAsset: string;
    collateralAsset: string;
    volume7d: number;
  }>;
}

// Aggregated liquidation data
export interface LiquidationData {
  recentEvents: LiquidationEvent[];
  protocolSummaries: ProtocolLiquidationSummary[];
  totals: {
    volume24h: number;
    volume7d: number;
    count24h: number;
    count7d: number;
    badDebt24h: number;
    badDebt7d: number;
  };
  dailyVolume: Array<{
    date: string;
    volume: number;
    count: number;
    badDebt: number;
    byProtocol: Record<string, number>;
  }>;
}

// Tab type for navigation
export type Tab = 'overview' | 'curators' | 'protocols' | 'vaults' | 'liquidations' | 'flows';

// Flow analysis types (derived from existing data, no new API calls)
export interface FlowDataPoint {
  name: string;
  flow7d: number;
  flow30d: number;
  tvl: number;
  flowPercent7d: number;
  flowPercent30d: number;
}

export interface YieldFlowCorrelation {
  name: string;
  slug: string;
  apy: number;
  flow7d: number;
  tvl: number;
  stablecoin: boolean;
}
