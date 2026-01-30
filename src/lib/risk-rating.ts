// Risk Rating Module
// Three-pillar credit rating system inspired by Moody's, S&P, and Fitch methodologies
// Adapted for DeFi vault risk assessment

// =============================================================================
// RATING SCALE (S&P-inspired)
// =============================================================================
// Investment Grade:
//   AAA - Exceptional: Highest safety, minimal risk of capital loss
//   AA  - Excellent: Very strong, negligible vulnerability
//   A   - Good: Strong position, low vulnerability to adverse conditions
//   BBB - Adequate: Satisfactory but more susceptible to adverse conditions
//
// Speculative Grade:
//   BB  - Speculative: Elevated risk, notable vulnerabilities
//   B   - Highly Speculative: Material risks present
//   CCC - Substantial Risk: Currently vulnerable, dependent on favorable conditions
//   CC  - Extremely Speculative: Highly vulnerable
//   C   - Near Default: Imminent risk of loss
// =============================================================================

export type CreditRating = 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC' | 'CC' | 'C' | 'NR';

export type RatingOutlook = 'POSITIVE' | 'STABLE' | 'NEGATIVE' | 'WATCH';

export interface PillarRating {
  rating: CreditRating;
  score: number; // 0-100 internal score
  outlook: RatingOutlook;
  factors: RatingFactor[];
}

export interface RatingFactor {
  name: string;
  score: number; // Contribution to pillar score (can be negative for good factors)
  weight: number; // 0-1, how much this factor matters
  assessment: 'STRONG' | 'ADEQUATE' | 'WEAK' | 'CRITICAL';
  detail: string;
}

export interface VaultCreditRating {
  // Overall composite rating
  compositeRating: CreditRating;
  compositeScore: number;
  investmentGrade: boolean;

  // Three pillars
  capitalSafety: PillarRating;
  liquidityHealth: PillarRating;
  curatorQuality: PillarRating;

  // Summary
  keyRisks: string[];
  keyStrengths: string[];
  ratingRationale: string;
}

// =============================================================================
// RATING SCALE MAPPING
// =============================================================================

// Score thresholds for ratings (lower score = better rating)
const RATING_THRESHOLDS: { rating: CreditRating; maxScore: number }[] = [
  { rating: 'AAA', maxScore: 5 },
  { rating: 'AA', maxScore: 12 },
  { rating: 'A', maxScore: 20 },
  { rating: 'BBB', maxScore: 30 },
  { rating: 'BB', maxScore: 45 },
  { rating: 'B', maxScore: 60 },
  { rating: 'CCC', maxScore: 75 },
  { rating: 'CC', maxScore: 90 },
  { rating: 'C', maxScore: 100 },
];

export function scoreToRating(score: number): CreditRating {
  for (const threshold of RATING_THRESHOLDS) {
    if (score <= threshold.maxScore) {
      return threshold.rating;
    }
  }
  return 'C';
}

export function isInvestmentGrade(rating: CreditRating): boolean {
  return ['AAA', 'AA', 'A', 'BBB'].includes(rating);
}

// =============================================================================
// PILLAR 1: CAPITAL SAFETY
// "What's the likelihood of losing my deposit?"
// =============================================================================
// Factors:
// - Bad debt exposure (realized or unrealized)
// - Collateral quality (blue-chip vs exotic)
// - Oracle reliability
// - LLTV conservatism (lower = more buffer)
// - Concentration risk

const BLUECHIP_ASSETS = [
  'WETH', 'ETH', 'WBTC', 'BTC', 'USDC', 'USDT', 'DAI', 'FRAX',
  'stETH', 'wstETH', 'cbETH', 'rETH', 'sfrxETH', 'WSTETH',
  'USDS', 'sUSDS', 'PYUSD', 'USDM', 'USDe', 'sUSDe'
];

const STABLECOIN_ASSETS = [
  'USDC', 'USDT', 'DAI', 'FRAX', 'USDS', 'sUSDS', 'PYUSD', 'USDM', 'USDe', 'sUSDe', 'LUSD', 'crvUSD'
];

export interface CapitalSafetyInput {
  hasBadDebt: boolean;
  badDebtUsd: number;
  tvlUsd: number;
  hasOracleWarning: boolean;
  avgLltv: number;
  markets: Array<{
    collateralAsset: string;
    loanAsset: string;
    allocationPct: number;
    lltv: number;
    hasBadDebt: boolean;
    hasRedWarning: boolean;
  }>;
}

export function assessCapitalSafety(input: CapitalSafetyInput): PillarRating {
  const factors: RatingFactor[] = [];
  let totalScore = 0;

  // Factor 1: Bad Debt Exposure (Weight: 35%)
  // Historical bad debt is a strong signal of realized capital loss
  const badDebtFactor = assessBadDebt(input);
  factors.push(badDebtFactor);
  totalScore += badDebtFactor.score * badDebtFactor.weight;

  // Factor 2: Collateral Quality (Weight: 25%)
  // Blue-chip collateral is less likely to experience flash crashes
  const collateralFactor = assessCollateralQuality(input.markets);
  factors.push(collateralFactor);
  totalScore += collateralFactor.score * collateralFactor.weight;

  // Factor 3: Oracle Reliability (Weight: 20%)
  // Oracle failures can cause bad liquidations
  const oracleFactor = assessOracleReliability(input);
  factors.push(oracleFactor);
  totalScore += oracleFactor.score * oracleFactor.weight;

  // Factor 4: LLTV Conservatism (Weight: 15%)
  // Lower LLTV = more buffer before losses hit lenders
  const lltvFactor = assessLltvConservatism(input.avgLltv, input.markets);
  factors.push(lltvFactor);
  totalScore += lltvFactor.score * lltvFactor.weight;

  // Factor 5: Concentration Risk (Weight: 5%)
  // Single market failure shouldn't tank entire vault
  const concentrationFactor = assessConcentrationRisk(input.markets);
  factors.push(concentrationFactor);
  totalScore += concentrationFactor.score * concentrationFactor.weight;

  const rating = scoreToRating(totalScore);
  const outlook = determineOutlook(factors);

  return {
    rating,
    score: totalScore,
    outlook,
    factors,
  };
}

function assessBadDebt(input: CapitalSafetyInput): RatingFactor {
  const weight = 0.35;
  let score = 0;
  let assessment: RatingFactor['assessment'] = 'STRONG';
  let detail = 'No bad debt detected';

  if (input.hasBadDebt) {
    const badDebtRatio = input.tvlUsd > 0 ? input.badDebtUsd / input.tvlUsd : 0;

    if (badDebtRatio > 0.01) {
      score = 100; // >1% bad debt = max penalty
      assessment = 'CRITICAL';
      detail = `Significant bad debt: ${(badDebtRatio * 100).toFixed(2)}% of TVL`;
    } else if (badDebtRatio > 0.001) {
      score = 70;
      assessment = 'WEAK';
      detail = `Bad debt present: ${(badDebtRatio * 100).toFixed(3)}% of TVL`;
    } else if (badDebtRatio > 0) {
      score = 40;
      assessment = 'WEAK';
      detail = 'Minor bad debt detected';
    } else {
      // hasBadDebt flag but no USD value (unrealized)
      score = 50;
      assessment = 'WEAK';
      detail = 'Unrealized bad debt warning on underlying markets';
    }
  } else {
    // Check if any markets have bad debt warnings
    const marketsWithBadDebt = input.markets.filter(m => m.hasBadDebt);
    if (marketsWithBadDebt.length > 0) {
      score = 30;
      assessment = 'ADEQUATE';
      detail = `${marketsWithBadDebt.length} market(s) have bad debt warnings`;
    }
  }

  return { name: 'Bad Debt Exposure', score, weight, assessment, detail };
}

function assessCollateralQuality(markets: CapitalSafetyInput['markets']): RatingFactor {
  const weight = 0.25;

  let bluechipAllocation = 0;
  let exoticAllocation = 0;

  for (const market of markets) {
    const isBluechip = BLUECHIP_ASSETS.some(
      a => market.collateralAsset.toUpperCase().includes(a) ||
           market.loanAsset.toUpperCase().includes(a)
    );

    if (isBluechip) {
      bluechipAllocation += market.allocationPct;
    } else {
      exoticAllocation += market.allocationPct;
    }
  }

  let score = 0;
  let assessment: RatingFactor['assessment'] = 'STRONG';
  let detail = '';

  if (bluechipAllocation >= 0.9) {
    score = 0;
    assessment = 'STRONG';
    detail = 'Portfolio dominated by blue-chip assets (ETH, BTC, major stablecoins)';
  } else if (bluechipAllocation >= 0.7) {
    score = 15;
    assessment = 'ADEQUATE';
    detail = `${(bluechipAllocation * 100).toFixed(0)}% blue-chip allocation`;
  } else if (bluechipAllocation >= 0.5) {
    score = 35;
    assessment = 'ADEQUATE';
    detail = `Mixed portfolio: ${(bluechipAllocation * 100).toFixed(0)}% blue-chip`;
  } else {
    score = 60;
    assessment = 'WEAK';
    detail = `High exotic asset exposure: ${(exoticAllocation * 100).toFixed(0)}% non-blue-chip`;
  }

  return { name: 'Collateral Quality', score, weight, assessment, detail };
}

function assessOracleReliability(input: CapitalSafetyInput): RatingFactor {
  const weight = 0.20;

  const marketsWithWarnings = input.markets.filter(m => m.hasRedWarning);
  const warningPct = input.markets.length > 0
    ? marketsWithWarnings.length / input.markets.length
    : 0;

  let score = 0;
  let assessment: RatingFactor['assessment'] = 'STRONG';
  let detail = '';

  if (input.hasOracleWarning) {
    score = 80;
    assessment = 'CRITICAL';
    detail = 'Oracle configuration warning detected';
  } else if (warningPct > 0.3) {
    score = 50;
    assessment = 'WEAK';
    detail = `${marketsWithWarnings.length} markets have red warnings`;
  } else if (marketsWithWarnings.length > 0) {
    score = 25;
    assessment = 'ADEQUATE';
    detail = `${marketsWithWarnings.length} market(s) with warnings`;
  } else {
    score = 0;
    assessment = 'STRONG';
    detail = 'No oracle or protocol warnings';
  }

  return { name: 'Oracle Reliability', score, weight, assessment, detail };
}

function assessLltvConservatism(avgLltv: number, markets: CapitalSafetyInput['markets']): RatingFactor {
  const weight = 0.15;

  // Find max LLTV across markets (weighted by allocation)
  const maxLltv = Math.max(...markets.map(m => m.lltv), avgLltv);

  let score = 0;
  let assessment: RatingFactor['assessment'] = 'STRONG';
  let detail = '';

  // Lower LLTV = more conservative = better
  if (maxLltv <= 0.77) {
    score = 0;
    assessment = 'STRONG';
    detail = `Conservative LLTV (${(maxLltv * 100).toFixed(0)}%) provides strong liquidation buffer`;
  } else if (maxLltv <= 0.85) {
    score = 15;
    assessment = 'ADEQUATE';
    detail = `Moderate LLTV (${(maxLltv * 100).toFixed(0)}%) with reasonable buffer`;
  } else if (maxLltv <= 0.90) {
    score = 35;
    assessment = 'ADEQUATE';
    detail = `Elevated LLTV (${(maxLltv * 100).toFixed(0)}%) reduces liquidation buffer`;
  } else if (maxLltv <= 0.945) {
    score = 55;
    assessment = 'WEAK';
    detail = `High LLTV (${(maxLltv * 100).toFixed(0)}%) - narrow margin before liquidation`;
  } else {
    score = 80;
    assessment = 'CRITICAL';
    detail = `Very high LLTV (${(maxLltv * 100).toFixed(0)}%) - minimal liquidation buffer`;
  }

  return { name: 'LLTV Conservatism', score, weight, assessment, detail };
}

function assessConcentrationRisk(markets: CapitalSafetyInput['markets']): RatingFactor {
  const weight = 0.05;

  const maxAllocation = Math.max(...markets.map(m => m.allocationPct), 0);
  const marketCount = markets.length;

  let score = 0;
  let assessment: RatingFactor['assessment'] = 'STRONG';
  let detail = '';

  if (marketCount >= 5 && maxAllocation < 0.4) {
    score = 0;
    assessment = 'STRONG';
    detail = `Well diversified across ${marketCount} markets`;
  } else if (marketCount >= 3 && maxAllocation < 0.6) {
    score = 15;
    assessment = 'ADEQUATE';
    detail = `Moderate diversification (${marketCount} markets)`;
  } else if (maxAllocation < 0.8) {
    score = 30;
    assessment = 'ADEQUATE';
    detail = `Limited diversification, largest market: ${(maxAllocation * 100).toFixed(0)}%`;
  } else {
    score = 50;
    assessment = 'WEAK';
    detail = `Concentrated: ${(maxAllocation * 100).toFixed(0)}% in single market`;
  }

  return { name: 'Concentration Risk', score, weight, assessment, detail };
}

// =============================================================================
// PILLAR 2: LIQUIDITY HEALTH
// "Can I withdraw when I need to?"
// =============================================================================
// Factors:
// - Available liquidity (immediate withdrawability)
// - Stress buffer (utilization + LLTV headroom combined)
// - Market depth (underlying market liquidity)
// - Withdrawal pressure (recent large withdrawals)

export interface LiquidityHealthInput {
  tvlUsd: number;
  availableLiquidityUsd: number;
  maxUtilization: number;
  avgUtilization: number;
  avgLltv: number;
  markets: Array<{
    utilization: number;
    lltv: number;
    liquidityUsd: number;
    allocationPct: number;
    supplyUsd: number;
  }>;
}

export function assessLiquidityHealth(input: LiquidityHealthInput): PillarRating {
  const factors: RatingFactor[] = [];
  let totalScore = 0;

  // Factor 1: Available Liquidity (Weight: 40%)
  const liquidityFactor = assessAvailableLiquidity(input);
  factors.push(liquidityFactor);
  totalScore += liquidityFactor.score * liquidityFactor.weight;

  // Factor 2: Stress Buffer (Weight: 35%)
  // This is the key insight: combine utilization + LLTV for true stress assessment
  const stressBufferFactor = assessStressBuffer(input);
  factors.push(stressBufferFactor);
  totalScore += stressBufferFactor.score * stressBufferFactor.weight;

  // Factor 3: Market Depth (Weight: 25%)
  const depthFactor = assessMarketDepth(input);
  factors.push(depthFactor);
  totalScore += depthFactor.score * depthFactor.weight;

  const rating = scoreToRating(totalScore);
  const outlook = determineOutlook(factors);

  return {
    rating,
    score: totalScore,
    outlook,
    factors,
  };
}

function assessAvailableLiquidity(input: LiquidityHealthInput): RatingFactor {
  const weight = 0.40;

  const liquidityRatio = input.tvlUsd > 0
    ? input.availableLiquidityUsd / input.tvlUsd
    : 0;

  let score = 0;
  let assessment: RatingFactor['assessment'] = 'STRONG';
  let detail = '';

  if (liquidityRatio >= 0.25) {
    score = 0;
    assessment = 'STRONG';
    detail = `${(liquidityRatio * 100).toFixed(0)}% immediately withdrawable`;
  } else if (liquidityRatio >= 0.15) {
    score = 20;
    assessment = 'ADEQUATE';
    detail = `${(liquidityRatio * 100).toFixed(0)}% available liquidity`;
  } else if (liquidityRatio >= 0.08) {
    score = 45;
    assessment = 'WEAK';
    detail = `Limited liquidity: ${(liquidityRatio * 100).toFixed(0)}% available`;
  } else if (liquidityRatio >= 0.03) {
    score = 70;
    assessment = 'WEAK';
    detail = `Low liquidity: only ${(liquidityRatio * 100).toFixed(1)}% available`;
  } else {
    score = 90;
    assessment = 'CRITICAL';
    detail = `Severely constrained: ${(liquidityRatio * 100).toFixed(2)}% available`;
  }

  return { name: 'Available Liquidity', score, weight, assessment, detail };
}

function assessStressBuffer(input: LiquidityHealthInput): RatingFactor {
  const weight = 0.35;

  // Key insight: Stress buffer = (1 - LLTV) + (1 - Utilization)
  // This represents total headroom before problems occur
  // Higher utilization is MORE acceptable when LLTV is lower

  const lltvHeadroom = 1 - input.avgLltv;
  const utilizationHeadroom = 1 - input.maxUtilization;
  const combinedBuffer = lltvHeadroom + utilizationHeadroom;

  // Also calculate the "danger zone" metric
  // If utilization > (1 - LLTV), we're in stress territory
  const stressRatio = input.maxUtilization / (1 - input.avgLltv + 0.01);

  let score = 0;
  let assessment: RatingFactor['assessment'] = 'STRONG';
  let detail = '';

  if (combinedBuffer >= 0.40) {
    score = 0;
    assessment = 'STRONG';
    detail = `Strong buffer: ${(combinedBuffer * 100).toFixed(0)}% combined headroom`;
  } else if (combinedBuffer >= 0.25) {
    score = 20;
    assessment = 'ADEQUATE';
    detail = `Adequate buffer: ${(combinedBuffer * 100).toFixed(0)}% headroom`;
  } else if (combinedBuffer >= 0.15) {
    score = 45;
    assessment = 'ADEQUATE';
    detail = `Moderate buffer: ${(combinedBuffer * 100).toFixed(0)}% headroom`;
  } else if (combinedBuffer >= 0.08) {
    score = 65;
    assessment = 'WEAK';
    detail = `Thin buffer: only ${(combinedBuffer * 100).toFixed(0)}% headroom`;
  } else {
    score = 85;
    assessment = 'CRITICAL';
    detail = `Minimal buffer: ${(combinedBuffer * 100).toFixed(1)}% - vulnerable to stress`;
  }

  // Adjust if in stress territory (utilization approaching LLTV complement)
  if (stressRatio > 2.5) {
    score = Math.min(score + 20, 100);
    detail += ' [STRESS WARNING]';
  }

  return { name: 'Stress Buffer', score, weight, assessment, detail };
}

function assessMarketDepth(input: LiquidityHealthInput): RatingFactor {
  const weight = 0.25;

  // Calculate weighted average liquidity relative to position size
  let totalLiquidity = 0;
  let weightedLiquidityRatio = 0;

  for (const market of input.markets) {
    const positionSize = market.supplyUsd || (input.tvlUsd * market.allocationPct);
    if (positionSize > 0) {
      const ratio = market.liquidityUsd / positionSize;
      weightedLiquidityRatio += ratio * market.allocationPct;
    }
    totalLiquidity += market.liquidityUsd;
  }

  let score = 0;
  let assessment: RatingFactor['assessment'] = 'STRONG';
  let detail = '';

  if (weightedLiquidityRatio >= 0.5 || totalLiquidity > input.tvlUsd * 2) {
    score = 0;
    assessment = 'STRONG';
    detail = 'Deep underlying market liquidity';
  } else if (weightedLiquidityRatio >= 0.2) {
    score = 20;
    assessment = 'ADEQUATE';
    detail = 'Adequate market depth for normal conditions';
  } else if (weightedLiquidityRatio >= 0.1) {
    score = 40;
    assessment = 'ADEQUATE';
    detail = 'Moderate market depth';
  } else {
    score = 60;
    assessment = 'WEAK';
    detail = 'Limited market depth - large withdrawals may face slippage';
  }

  return { name: 'Market Depth', score, weight, assessment, detail };
}

// =============================================================================
// PILLAR 3: CURATOR QUALITY
// "Is this vault well-managed?"
// =============================================================================
// Factors:
// - Track record (historical performance, incidents)
// - Asset selection quality (risk appetite)
// - Diversification strategy
// - Fee reasonableness

export interface CuratorQualityInput {
  curatorName: string;
  // Track record
  hasHistoricalBadDebt: boolean;
  incidentCount: number;
  ageMonths: number; // How long has curator been active
  totalTvlManaged: number;
  // Asset selection
  exoticAssetPct: number;
  avgLltv: number;
  // Diversification
  vaultCount: number;
  avgMarketsPerVault: number;
  chainCount: number;
  // Fees
  performanceFee: number;
}

export function assessCuratorQuality(input: CuratorQualityInput): PillarRating {
  const factors: RatingFactor[] = [];
  let totalScore = 0;

  // Factor 1: Track Record (Weight: 40%)
  const trackRecordFactor = assessTrackRecord(input);
  factors.push(trackRecordFactor);
  totalScore += trackRecordFactor.score * trackRecordFactor.weight;

  // Factor 2: Risk Management (Weight: 30%)
  const riskMgmtFactor = assessRiskManagement(input);
  factors.push(riskMgmtFactor);
  totalScore += riskMgmtFactor.score * riskMgmtFactor.weight;

  // Factor 3: Diversification Strategy (Weight: 20%)
  const diversificationFactor = assessDiversificationStrategy(input);
  factors.push(diversificationFactor);
  totalScore += diversificationFactor.score * diversificationFactor.weight;

  // Factor 4: Fee Structure (Weight: 10%)
  const feeFactor = assessFeeStructure(input);
  factors.push(feeFactor);
  totalScore += feeFactor.score * feeFactor.weight;

  const rating = scoreToRating(totalScore);
  const outlook = determineOutlook(factors);

  return {
    rating,
    score: totalScore,
    outlook,
    factors,
  };
}

function assessTrackRecord(input: CuratorQualityInput): RatingFactor {
  const weight = 0.40;

  let score = 0;
  let assessment: RatingFactor['assessment'] = 'ADEQUATE';
  let detail = '';

  // Start with base score based on history
  if (input.hasHistoricalBadDebt) {
    score = 60;
    assessment = 'WEAK';
    detail = 'Historical bad debt incidents';
  } else if (input.incidentCount > 0) {
    score = 40;
    assessment = 'ADEQUATE';
    detail = `${input.incidentCount} past incident(s) recorded`;
  } else {
    score = 10;
    assessment = 'STRONG';
    detail = 'Clean track record';
  }

  // Adjust for maturity (longer track record = more confidence)
  if (input.ageMonths < 3) {
    score += 20;
    assessment = score > 50 ? 'WEAK' : 'ADEQUATE';
    detail += ' (Limited history < 3 months)';
  } else if (input.ageMonths < 6) {
    score += 10;
    detail += ' (Moderate history)';
  } else if (input.ageMonths >= 12 && input.totalTvlManaged > 50_000_000) {
    score = Math.max(score - 10, 0);
    if (score < 20) assessment = 'STRONG';
    detail += ' (Established curator)';
  }

  return { name: 'Track Record', score, weight, assessment, detail };
}

function assessRiskManagement(input: CuratorQualityInput): RatingFactor {
  const weight = 0.30;

  let score = 0;
  let assessment: RatingFactor['assessment'] = 'ADEQUATE';
  let detail = '';

  // Evaluate risk appetite through asset selection
  if (input.exoticAssetPct > 0.5) {
    score = 50;
    assessment = 'WEAK';
    detail = 'Aggressive risk profile (high exotic asset allocation)';
  } else if (input.exoticAssetPct > 0.3) {
    score = 30;
    assessment = 'ADEQUATE';
    detail = 'Moderate risk profile';
  } else if (input.exoticAssetPct > 0.1) {
    score = 15;
    assessment = 'ADEQUATE';
    detail = 'Conservative-moderate risk profile';
  } else {
    score = 5;
    assessment = 'STRONG';
    detail = 'Conservative risk profile (blue-chip focus)';
  }

  // Adjust for LLTV choices
  if (input.avgLltv > 0.90) {
    score += 15;
    detail += ', high LLTV tolerance';
  } else if (input.avgLltv < 0.80) {
    score = Math.max(score - 5, 0);
  }

  return { name: 'Risk Management', score, weight, assessment, detail };
}

function assessDiversificationStrategy(input: CuratorQualityInput): RatingFactor {
  const weight = 0.20;

  let score = 0;
  let assessment: RatingFactor['assessment'] = 'ADEQUATE';
  let detail = '';

  // Multi-vault, multi-chain, multi-market = better diversification
  const diversificationScore =
    (input.vaultCount >= 3 ? 1 : input.vaultCount / 3) * 0.3 +
    (input.chainCount >= 2 ? 1 : input.chainCount / 2) * 0.3 +
    (input.avgMarketsPerVault >= 4 ? 1 : input.avgMarketsPerVault / 4) * 0.4;

  if (diversificationScore >= 0.8) {
    score = 5;
    assessment = 'STRONG';
    detail = `Well-diversified: ${input.vaultCount} vaults, ${input.chainCount} chains`;
  } else if (diversificationScore >= 0.5) {
    score = 20;
    assessment = 'ADEQUATE';
    detail = 'Moderate diversification';
  } else if (diversificationScore >= 0.3) {
    score = 35;
    assessment = 'ADEQUATE';
    detail = 'Limited diversification';
  } else {
    score = 50;
    assessment = 'WEAK';
    detail = 'Concentrated strategy';
  }

  return { name: 'Diversification Strategy', score, weight, assessment, detail };
}

function assessFeeStructure(input: CuratorQualityInput): RatingFactor {
  const weight = 0.10;

  let score = 0;
  let assessment: RatingFactor['assessment'] = 'ADEQUATE';
  let detail = '';

  if (input.performanceFee <= 0.05) {
    score = 0;
    assessment = 'STRONG';
    detail = `Low fees (${(input.performanceFee * 100).toFixed(0)}% performance fee)`;
  } else if (input.performanceFee <= 0.10) {
    score = 10;
    assessment = 'ADEQUATE';
    detail = `Reasonable fees (${(input.performanceFee * 100).toFixed(0)}%)`;
  } else if (input.performanceFee <= 0.15) {
    score = 25;
    assessment = 'ADEQUATE';
    detail = `Moderate fees (${(input.performanceFee * 100).toFixed(0)}%)`;
  } else if (input.performanceFee <= 0.20) {
    score = 40;
    assessment = 'WEAK';
    detail = `Above-average fees (${(input.performanceFee * 100).toFixed(0)}%)`;
  } else {
    score = 60;
    assessment = 'WEAK';
    detail = `High fees (${(input.performanceFee * 100).toFixed(0)}%)`;
  }

  return { name: 'Fee Structure', score, weight, assessment, detail };
}

// =============================================================================
// COMPOSITE RATING
// =============================================================================

export interface CompositeRatingInput {
  capitalSafety: CapitalSafetyInput;
  liquidityHealth: LiquidityHealthInput;
  curatorQuality: CuratorQualityInput;
}

export function calculateVaultCreditRating(input: CompositeRatingInput): VaultCreditRating {
  // Assess each pillar
  const capitalSafety = assessCapitalSafety(input.capitalSafety);
  const liquidityHealth = assessLiquidityHealth(input.liquidityHealth);
  const curatorQuality = assessCuratorQuality(input.curatorQuality);

  // Weighted composite score
  // Capital Safety is most important (50%), then Liquidity (30%), then Curator (20%)
  const compositeScore =
    capitalSafety.score * 0.50 +
    liquidityHealth.score * 0.30 +
    curatorQuality.score * 0.20;

  const compositeRating = scoreToRating(compositeScore);
  const investmentGrade = isInvestmentGrade(compositeRating);

  // Extract key risks and strengths
  const keyRisks = extractKeyRisks(capitalSafety, liquidityHealth, curatorQuality);
  const keyStrengths = extractKeyStrengths(capitalSafety, liquidityHealth, curatorQuality);

  // Generate rationale
  const ratingRationale = generateRationale(compositeRating, capitalSafety, liquidityHealth, curatorQuality);

  return {
    compositeRating,
    compositeScore,
    investmentGrade,
    capitalSafety,
    liquidityHealth,
    curatorQuality,
    keyRisks,
    keyStrengths,
    ratingRationale,
  };
}

function determineOutlook(factors: RatingFactor[]): RatingOutlook {
  const criticalCount = factors.filter(f => f.assessment === 'CRITICAL').length;
  const weakCount = factors.filter(f => f.assessment === 'WEAK').length;
  const strongCount = factors.filter(f => f.assessment === 'STRONG').length;

  if (criticalCount > 0) return 'NEGATIVE';
  if (weakCount >= 2) return 'NEGATIVE';
  if (strongCount >= 3) return 'POSITIVE';
  return 'STABLE';
}

function extractKeyRisks(
  capital: PillarRating,
  liquidity: PillarRating,
  curator: PillarRating
): string[] {
  const risks: string[] = [];

  const allFactors = [...capital.factors, ...liquidity.factors, ...curator.factors];

  for (const factor of allFactors) {
    if (factor.assessment === 'CRITICAL') {
      risks.push(`${factor.name}: ${factor.detail}`);
    } else if (factor.assessment === 'WEAK' && factor.score > 40) {
      risks.push(`${factor.name}: ${factor.detail}`);
    }
  }

  return risks.slice(0, 4); // Top 4 risks
}

function extractKeyStrengths(
  capital: PillarRating,
  liquidity: PillarRating,
  curator: PillarRating
): string[] {
  const strengths: string[] = [];

  const allFactors = [...capital.factors, ...liquidity.factors, ...curator.factors];

  for (const factor of allFactors) {
    if (factor.assessment === 'STRONG' && factor.weight >= 0.15) {
      strengths.push(`${factor.name}: ${factor.detail}`);
    }
  }

  return strengths.slice(0, 3); // Top 3 strengths
}

function generateRationale(
  rating: CreditRating,
  capital: PillarRating,
  liquidity: PillarRating,
  curator: PillarRating
): string {
  const isIG = isInvestmentGrade(rating);

  if (rating === 'AAA') {
    return 'Exceptional credit quality with minimal risk of capital loss. Strong across all assessment pillars.';
  }

  if (rating === 'AA') {
    return 'Very strong credit quality. Minor vulnerabilities do not detract from overall strong position.';
  }

  if (rating === 'A') {
    return 'Strong credit quality with adequate protection. Somewhat susceptible to adverse conditions.';
  }

  if (rating === 'BBB') {
    return 'Adequate credit quality. Satisfactory protection but more vulnerable to changing conditions.';
  }

  if (rating === 'BB') {
    return 'Speculative with elevated risk. Notable vulnerabilities that could impact capital preservation.';
  }

  if (rating === 'B') {
    return 'Highly speculative. Material risks present that warrant careful consideration.';
  }

  return 'Substantial risk. Currently vulnerable and dependent on favorable conditions to avoid losses.';
}

// =============================================================================
// UTILITY EXPORTS
// =============================================================================

export const RATING_COLORS: Record<CreditRating, { bg: string; text: string; border: string }> = {
  'AAA': { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  'AA': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  'A': { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' },
  'BBB': { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' },
  'BB': { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  'B': { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
  'CCC': { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  'CC': { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' },
  'C': { bg: 'bg-red-500/20', text: 'text-red-500', border: 'border-red-500/40' },
  'NR': { bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-500/20' },
};

export const RATING_LABELS: Record<CreditRating, string> = {
  'AAA': 'Exceptional',
  'AA': 'Excellent',
  'A': 'Good',
  'BBB': 'Adequate',
  'BB': 'Speculative',
  'B': 'Highly Speculative',
  'CCC': 'Substantial Risk',
  'CC': 'Extremely Speculative',
  'C': 'Near Default',
  'NR': 'Not Rated',
};
