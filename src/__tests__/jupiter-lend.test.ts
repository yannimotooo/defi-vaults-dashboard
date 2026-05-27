import { afterEach, describe, expect, it } from 'vitest';
import {
  BITWISE_JUPITER_ETHENA_CURATOR_NAME,
  DEFAULT_JUPITER_ETHENA_REPORTED_MARKET_SNAPSHOT,
  getConfiguredJupiterEthenaMarketSnapshot,
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
    expect(result?.totalTvlSource).toBe('reported-market-snapshot');
    expect(result?.liveEarnTvlUsd).toBeLessThan(result!.reportedMarketTvlUsd);
  });

  it('accepts an explicit reported full-market TVL snapshot', () => {
    const result = parseJupiterEthenaEarnMarket(
      SAMPLE_ETHENA_EARN_TOKENS,
      undefined,
      {
        tvlUsd: 600_000_000,
        source: 'Bitwise dashboard, 2026-05-27',
        asOf: '2026-05-27',
      },
    );

    expect(result?.reportedMarketTvlUsd).toBe(600_000_000);
    expect(result?.reportedMarketTvlSource).toBe('Bitwise dashboard, 2026-05-27');
    expect(result?.reportedMarketTvlAsOf).toBe('2026-05-27');
    expect(result?.totalTvlUsd).toBe(600_000_000);
    expect(result?.totalTvlSource).toBe('reported-market-snapshot');
  });

  it('uses live Jupiter Earn-side TVL when it exceeds the reported market snapshot', () => {
    const highTvlPayload = [
      {
        ...SAMPLE_ETHENA_EARN_TOKENS[0],
        totalAssets: '700000000000000',
        asset: {
          ...SAMPLE_ETHENA_EARN_TOKENS[0].asset,
          price: '1',
        },
      },
    ];

    const result = parseJupiterEthenaEarnMarket(highTvlPayload);

    expect(result?.liveEarnTvlUsd).toBe(700_000_000);
    expect(result?.totalTvlUsd).toBe(700_000_000);
    expect(result?.totalTvlSource).toBe('jupiter-earn-live');
  });
});

describe('getConfiguredJupiterEthenaMarketSnapshot', () => {
  const env = process.env;

  afterEach(() => {
    process.env = env;
  });

  it('falls back to the researched default snapshot', () => {
    process.env = { ...env };
    delete process.env.JUPITER_ETHENA_MARKET_TVL_USD;
    delete process.env.JUPITER_ETHENA_MARKET_TVL_SOURCE;
    delete process.env.JUPITER_ETHENA_MARKET_TVL_AS_OF;

    expect(getConfiguredJupiterEthenaMarketSnapshot()).toEqual(
      DEFAULT_JUPITER_ETHENA_REPORTED_MARKET_SNAPSHOT,
    );
  });

  it('reads a positive configured market TVL snapshot from env', () => {
    process.env = {
      ...env,
      JUPITER_ETHENA_MARKET_TVL_USD: '615000000',
      JUPITER_ETHENA_MARKET_TVL_SOURCE: 'Internal snapshot',
      JUPITER_ETHENA_MARKET_TVL_AS_OF: '2026-05-27',
    };

    expect(getConfiguredJupiterEthenaMarketSnapshot()).toEqual({
      tvlUsd: 615_000_000,
      source: 'Internal snapshot',
      asOf: '2026-05-27',
    });
  });
});
