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
  // TVL source tracking
  tvlSource?: 'morpho' | 'defillama' | 'euler';
  morphoTvl?: number;      // On-chain Morpho TVL (authoritative)
  defillamaTvl?: number;   // DeFiLlama aggregated TVL
  // Kamino (Solana) data
  kaminoTvl?: number;      // Estimated Kamino TVL on Solana
  kaminoVaultCount?: number;  // Number of Kamino vaults managed
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
