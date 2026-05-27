import { fetchWithTimeout } from './http';

const JUPITER_LEND_API_BASE = 'https://api.jup.ag/lend/v1';
const JUPITER_LEND_TIMEOUT_MS = 10_000;

export const BITWISE_JUPITER_ETHENA_CURATOR_SLUG = 'bitwise-onchain';
export const BITWISE_JUPITER_ETHENA_CURATOR_NAME = 'Bitwise Onchain';

/**
 * Jupiter's public REST endpoint currently exposes the Ethena Earn-side token
 * supply directly (`market=ethena`). The full isolated market TVL also includes
 * the collateral/debt vault state, which Jupiter's docs route through the read
 * SDK/on-chain reads. Keep that broader figure explicit so it is not confused
 * with the live REST-reported USDG supply.
 *
 * Research snapshot:
 * - Blockworks, 2026-05-18: roughly $530M deposited into the Jupiter Lend
 *   Bitwise x Ethena market.
 * - Live REST endpoint below updates the USDG Earn-side supply and APY.
 */
export const JUPITER_ETHENA_REPORTED_MARKET_TVL_USD = 530_000_000;

export interface JupiterLendEarnToken {
  id: number;
  address: string;
  name: string;
  symbol: string;
  uiSymbol: string;
  decimals: number;
  assetAddress: string;
  asset: {
    address: string;
    name: string;
    symbol: string;
    uiSymbol?: string;
    decimals: number;
    price: string;
    updatedAt?: string;
  };
  totalAssets: string;
  totalSupply: string;
  supplyRate: string;
  rewardsRate: string;
  totalRate: string;
}

export interface JupiterEthenaEarnMarket {
  market: 'ethena';
  curatorName: typeof BITWISE_JUPITER_ETHENA_CURATOR_NAME;
  curatorSlug: typeof BITWISE_JUPITER_ETHENA_CURATOR_SLUG;
  earnTokens: Array<JupiterLendEarnToken & {
    tvlUsd: number;
    supplyApy: number;
    rewardsApy: number;
    totalApy: number;
  }>;
  liveEarnTvlUsd: number;
  reportedMarketTvlUsd: number;
  totalTvlUsd: number;
  avgSupplyApy: number;
  avgTotalApy: number;
  updatedAt?: string;
  sourceUrl: string;
}

function bpsToPercent(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed / 100 : 0;
}

function tokenAmountUsd(token: JupiterLendEarnToken): number {
  const decimals = token.asset?.decimals ?? token.decimals ?? 6;
  const amount = Number(token.totalAssets) / Math.pow(10, decimals);
  const price = Number(token.asset?.price ?? 0);
  if (!Number.isFinite(amount) || !Number.isFinite(price)) return 0;
  return amount * price;
}

function weightedAverage<T extends { tvlUsd: number }>(
  tokens: T[],
  value: (token: T) => number,
): number {
  const totalTvl = tokens.reduce((sum, token) => sum + token.tvlUsd, 0);
  if (totalTvl <= 0) return 0;
  return tokens.reduce((sum, token) => sum + value(token) * (token.tvlUsd / totalTvl), 0);
}

export async function getJupiterEthenaEarnMarket(): Promise<JupiterEthenaEarnMarket | null> {
  const sourceUrl = `${JUPITER_LEND_API_BASE}/earn/tokens?market=ethena`;
  const response = await fetchWithTimeout(sourceUrl, {
    next: { revalidate: 300 },
    timeoutMs: JUPITER_LEND_TIMEOUT_MS,
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Jupiter Lend Ethena API error: ${response.status}`);
  }

  const raw = await response.json();
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const earnTokens = raw.map((token: JupiterLendEarnToken) => ({
    ...token,
    tvlUsd: tokenAmountUsd(token),
    supplyApy: bpsToPercent(token.supplyRate),
    rewardsApy: bpsToPercent(token.rewardsRate),
    totalApy: bpsToPercent(token.totalRate),
  }));

  const liveEarnTvlUsd = earnTokens.reduce((sum, token) => sum + token.tvlUsd, 0);
  const avgSupplyApy = weightedAverage(earnTokens, token => token.supplyApy);
  const avgTotalApy = weightedAverage(earnTokens, token => token.totalApy);

  return {
    market: 'ethena',
    curatorName: BITWISE_JUPITER_ETHENA_CURATOR_NAME,
    curatorSlug: BITWISE_JUPITER_ETHENA_CURATOR_SLUG,
    earnTokens,
    liveEarnTvlUsd,
    reportedMarketTvlUsd: JUPITER_ETHENA_REPORTED_MARKET_TVL_USD,
    totalTvlUsd: Math.max(liveEarnTvlUsd, JUPITER_ETHENA_REPORTED_MARKET_TVL_USD),
    avgSupplyApy,
    avgTotalApy,
    updatedAt: earnTokens.find(token => token.asset?.updatedAt)?.asset.updatedAt,
    sourceUrl,
  };
}
