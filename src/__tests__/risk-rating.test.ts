import { describe, it, expect } from 'vitest';
import { scoreToRating, isInvestmentGrade, assessCapitalSafety, assessLiquidityHealth, calculateVaultCreditRating } from '@/lib/risk-rating';

describe('scoreToRating', () => {
  it('maps score 0 to AAA', () => {
    expect(scoreToRating(0)).toBe('AAA');
  });

  it('maps low scores to investment grade ratings', () => {
    expect(scoreToRating(3)).toBe('AAA');
    expect(scoreToRating(8)).toBe('AA');
    expect(scoreToRating(15)).toBe('A');
    expect(scoreToRating(25)).toBe('BBB');
  });

  it('maps mid scores to speculative grade', () => {
    expect(scoreToRating(35)).toBe('BB');
    expect(scoreToRating(50)).toBe('B');
    expect(scoreToRating(65)).toBe('CCC');
  });

  it('maps high scores to near-default', () => {
    expect(scoreToRating(80)).toBe('CC');
    expect(scoreToRating(95)).toBe('C');
  });

  it('maps 100+ to C', () => {
    expect(scoreToRating(150)).toBe('C');
  });
});

describe('isInvestmentGrade', () => {
  it('returns true for AAA through BBB', () => {
    expect(isInvestmentGrade('AAA')).toBe(true);
    expect(isInvestmentGrade('AA')).toBe(true);
    expect(isInvestmentGrade('A')).toBe(true);
    expect(isInvestmentGrade('BBB')).toBe(true);
  });

  it('returns false for BB and below', () => {
    expect(isInvestmentGrade('BB')).toBe(false);
    expect(isInvestmentGrade('B')).toBe(false);
    expect(isInvestmentGrade('CCC')).toBe(false);
    expect(isInvestmentGrade('C')).toBe(false);
  });

  it('returns false for NR', () => {
    expect(isInvestmentGrade('NR')).toBe(false);
  });
});

// Helper: create well-diversified blue-chip markets
function makeConservativeMarkets() {
  return [
    { collateralAsset: 'wstETH', loanAsset: 'USDC', allocationPct: 0.25, lltv: 0.77, hasBadDebt: false, hasRedWarning: false },
    { collateralAsset: 'WBTC', loanAsset: 'USDC', allocationPct: 0.25, lltv: 0.75, hasBadDebt: false, hasRedWarning: false },
    { collateralAsset: 'WETH', loanAsset: 'USDT', allocationPct: 0.20, lltv: 0.77, hasBadDebt: false, hasRedWarning: false },
    { collateralAsset: 'cbETH', loanAsset: 'USDC', allocationPct: 0.15, lltv: 0.76, hasBadDebt: false, hasRedWarning: false },
    { collateralAsset: 'rETH', loanAsset: 'DAI', allocationPct: 0.15, lltv: 0.75, hasBadDebt: false, hasRedWarning: false },
  ];
}

function makeRiskyMarkets() {
  return [
    { collateralAsset: 'SHIB', loanAsset: 'USDC', allocationPct: 0.90, lltv: 0.95, hasBadDebt: true, hasRedWarning: true },
    { collateralAsset: 'DOGE', loanAsset: 'USDT', allocationPct: 0.10, lltv: 0.93, hasBadDebt: false, hasRedWarning: false },
  ];
}

describe('assessCapitalSafety', () => {
  it('rates conservative vault highly', () => {
    const result = assessCapitalSafety({
      hasBadDebt: false,
      badDebtUsd: 0,
      tvlUsd: 100_000_000,
      hasOracleWarning: false,
      avgLltv: 0.76,
      markets: makeConservativeMarkets(),
    });

    expect(result.score).toBeLessThan(20);
    expect(['AAA', 'AA', 'A']).toContain(result.rating);
  });

  it('penalizes bad debt history', () => {
    const result = assessCapitalSafety({
      hasBadDebt: true,
      badDebtUsd: 500_000,
      tvlUsd: 50_000_000,
      hasOracleWarning: false,
      avgLltv: 0.77,
      markets: makeConservativeMarkets(),
    });

    // Bad debt should significantly increase score
    expect(result.score).toBeGreaterThan(10);
  });

  it('penalizes concentrated risky markets', () => {
    const result = assessCapitalSafety({
      hasBadDebt: false,
      badDebtUsd: 0,
      tvlUsd: 10_000_000,
      hasOracleWarning: true,
      avgLltv: 0.94,
      markets: makeRiskyMarkets(),
    });

    // Risky, concentrated, high-LLTV = poor score
    expect(result.score).toBeGreaterThan(30);
  });
});

// Helper: market data for liquidity tests
function makeHealthyLiquidityMarkets() {
  return [
    { utilization: 0.60, lltv: 0.77, liquidityUsd: 15_000_000, allocationPct: 0.50, supplyUsd: 50_000_000 },
    { utilization: 0.65, lltv: 0.75, liquidityUsd: 10_000_000, allocationPct: 0.50, supplyUsd: 50_000_000 },
  ];
}

function makeStressedLiquidityMarkets() {
  return [
    { utilization: 0.97, lltv: 0.94, liquidityUsd: 100_000, allocationPct: 0.80, supplyUsd: 50_000_000 },
    { utilization: 0.95, lltv: 0.90, liquidityUsd: 200_000, allocationPct: 0.20, supplyUsd: 10_000_000 },
  ];
}

describe('assessLiquidityHealth', () => {
  it('rates ample liquidity well', () => {
    const result = assessLiquidityHealth({
      tvlUsd: 100_000_000,
      availableLiquidityUsd: 25_000_000,
      maxUtilization: 0.70,
      avgUtilization: 0.62,
      avgLltv: 0.76,
      markets: makeHealthyLiquidityMarkets(),
    });

    expect(result.score).toBeLessThan(30);
    expect(['AAA', 'AA', 'A', 'BBB']).toContain(result.rating);
  });

  it('penalizes near-full utilization', () => {
    const result = assessLiquidityHealth({
      tvlUsd: 60_000_000,
      availableLiquidityUsd: 300_000,
      maxUtilization: 0.97,
      avgUtilization: 0.96,
      avgLltv: 0.92,
      markets: makeStressedLiquidityMarkets(),
    });

    // Stressed liquidity = high score
    expect(result.score).toBeGreaterThan(40);
  });
});

describe('calculateVaultCreditRating', () => {
  it('produces a valid composite rating structure', () => {
    const result = calculateVaultCreditRating({
      capitalSafety: {
        hasBadDebt: false,
        badDebtUsd: 0,
        tvlUsd: 100_000_000,
        hasOracleWarning: false,
        avgLltv: 0.76,
        markets: makeConservativeMarkets(),
      },
      liquidityHealth: {
        tvlUsd: 100_000_000,
        availableLiquidityUsd: 25_000_000,
        maxUtilization: 0.70,
        avgUtilization: 0.62,
        avgLltv: 0.76,
        markets: makeHealthyLiquidityMarkets(),
      },
      curatorQuality: {
        curatorName: 'Steakhouse Financial',
        hasHistoricalBadDebt: false,
        incidentCount: 0,
        ageMonths: 24,
        totalTvlManaged: 500_000_000,
        exoticAssetPct: 0.05,
        avgLltv: 0.76,
        vaultCount: 8,
        avgMarketsPerVault: 5,
        chainCount: 3,
        performanceFee: 0.05,
      },
    });

    expect(result.compositeRating).toBeDefined();
    expect(typeof result.compositeScore).toBe('number');
    expect(result.compositeScore).toBeGreaterThanOrEqual(0);
    expect(result.capitalSafety).toBeDefined();
    expect(result.capitalSafety.factors.length).toBeGreaterThan(0);
    expect(result.liquidityHealth).toBeDefined();
    expect(result.curatorQuality).toBeDefined();
    expect(result.keyRisks).toBeInstanceOf(Array);
    expect(result.keyStrengths).toBeInstanceOf(Array);
    expect(typeof result.ratingRationale).toBe('string');
  });

  it('rates safe vault as investment grade', () => {
    const result = calculateVaultCreditRating({
      capitalSafety: {
        hasBadDebt: false,
        badDebtUsd: 0,
        tvlUsd: 100_000_000,
        hasOracleWarning: false,
        avgLltv: 0.76,
        markets: makeConservativeMarkets(),
      },
      liquidityHealth: {
        tvlUsd: 100_000_000,
        availableLiquidityUsd: 25_000_000,
        maxUtilization: 0.70,
        avgUtilization: 0.62,
        avgLltv: 0.76,
        markets: makeHealthyLiquidityMarkets(),
      },
      curatorQuality: {
        curatorName: 'Steakhouse Financial',
        hasHistoricalBadDebt: false,
        incidentCount: 0,
        ageMonths: 24,
        totalTvlManaged: 500_000_000,
        exoticAssetPct: 0.05,
        avgLltv: 0.76,
        vaultCount: 8,
        avgMarketsPerVault: 5,
        chainCount: 3,
        performanceFee: 0.05,
      },
    });

    expect(result.investmentGrade).toBe(true);
    expect(['AAA', 'AA', 'A', 'BBB']).toContain(result.compositeRating);
  });
});
