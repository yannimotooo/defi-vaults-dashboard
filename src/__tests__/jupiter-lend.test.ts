import { describe, expect, it } from 'vitest';
import {
  BITWISE_JUPITER_ETHENA_CURATOR_NAME,
  JUPITER_ETHENA_REPORTED_MARKET_TVL_USD,
  parseJupiterEthenaEarnMarket,
} from '@/lib/jupiter-lend';

const SAMPLE_ETHENA_EARN_TOKENS = [
  {
    id: 1,
    address: 'Bd2wJsmaF3YKC6fKLo4AFQDYaFEzWR6SNvoxvTnA6dXc',
    name: 'jupiter ethena lend USDG',
    symbol: 'jleUSDG',
    uiSymbol: 'jleUSDG',
    decimals: 6,
    assetAddress: '2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH',
    asset: {
      address: '2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH',
      name: 'Global Dollar',
      symbol: 'USDG',
      uiSymbol: 'USDG',
      decimals: 6,
      price: '1.000104960992',
      updatedAt: '2026-05-22T12:42:13.000+00:00',
    },
    totalAssets: '251104348620527',
    totalSupply: '250930606202966',
    supplyRate: '224',
    rewardsRate: '0',
    totalRate: '224',
  },
];

describe('parseJupiterEthenaEarnMarket', () => {
  it('returns null for missing or empty payloads', () => {
    expect(parseJupiterEthenaEarnMarket(null)).toBeNull();
    expect(parseJupiterEthenaEarnMarket({})).toBeNull();
    expect(parseJupiterEthenaEarnMarket([])).toBeNull();
  });

  it('normalizes Jupiter Ethena Earn-side TVL and APY', () => {
    const result = parseJupiterEthenaEarnMarket(
      SAMPLE_ETHENA_EARN_TOKENS,
      'https://example.com/ethena',
    );

    expect(result).not.toBeNull();
    expect(result?.curatorName).toBe(BITWISE_JUPITER_ETHENA_CURATOR_NAME);
    expect(result?.sourceUrl).toBe('https://example.com/ethena');
    expect(result?.liveEarnTvlUsd).toBeCloseTo(251_130_704.78, 2);
    expect(result?.avgSupplyApy).toBe(2.24);
    expect(result?.avgTotalApy).toBe(2.24);
    expect(result?.updatedAt).toBe('2026-05-22T12:42:13.000+00:00');
  });

  it('keeps reported full-market TVL distinct from live Earn-side TVL', () => {
    const result = parseJupiterEthenaEarnMarket(SAMPLE_ETHENA_EARN_TOKENS);

    expect(result?.reportedMarketTvlUsd).toBe(JUPITER_ETHENA_REPORTED_MARKET_TVL_USD);
    expect(result?.reportedMarketTvlSource).toBe('Blockworks, 2026-05-18');
    expect(result?.reportedMarketTvlAsOf).toBe('2026-05-18');
    expect(result?.totalTvlUsd).toBe(JUPITER_ETHENA_REPORTED_MARKET_TVL_USD);
    expect(result?.liveEarnTvlUsd).toBeLessThan(result!.reportedMarketTvlUsd);
  });
});
