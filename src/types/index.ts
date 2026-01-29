// Data types for DeFi Vault Dashboard

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
  chains: string[];
  category: string;
}

export interface Curator {
  name: string;
  slug: string;
  totalTvl: number;
  vaultCount: number;
  chains: string[];
  protocols: string[];
  avgApy: number;
  netFlow7d: number;
  netFlow30d: number;
  // Cross-reference validation (DeFiLlama + Dune)
  dataConfidence?: 'high' | 'medium' | 'low';
  duneTvl?: number | null;
  // Fee economics (from Morpho)
  avgPerformanceFee?: number;  // Percentage of yield taken as fee
  avgManagementFee?: number;   // Annual percentage fee on TVL
  estimatedAnnualRevenue?: number;  // Estimated fee revenue at current TVL/APY
  grossApy?: number;  // APY before fees
  netApy?: number;    // APY after fees
  // Risk metrics (Phase 3)
  riskRating?: 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D';
  maxDrawdown?: number;
  badDebtHistory?: number;
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
