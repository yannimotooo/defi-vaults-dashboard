// Multi-Protocol Liquidation Data Module
// Aggregates liquidation events from Morpho, Aave V3, Euler V2, Spark, and Kamino
// Uses free APIs only: Morpho GraphQL (paginated), The Graph, Euler Goldsky, CoinGecko for prices

// ============================================
// Types
// ============================================

export interface LiquidationEvent {
  id: string;
  hash: string;
  timestamp: number;
  protocol: 'Morpho' | 'Aave' | 'Euler' | 'Spark' | 'Kamino';
  chain: string;
  chainId: number;
  // Market/position info
  loanAsset: string;
  collateralAsset: string;
  marketKey?: string;
  // Amounts
  repaidUsd: number;
  seizedUsd: number;
  badDebtUsd: number;
  // Addresses
  liquidator: string;
  borrower?: string;
  // Computed
  hasSignificantBadDebt: boolean;
}

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

export interface DailyLiquidationVolume {
  date: string;
  volume: number;
  count: number;
  badDebt: number;
  byProtocol: Record<string, number>;
}

export interface MultiProtocolLiquidationData {
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
  dailyVolume: DailyLiquidationVolume[]; // Pre-computed from ALL events
  timestamp: string;
}

// ============================================
// API Endpoints
// ============================================

const MORPHO_GRAPHQL_API = 'https://blue-api.morpho.org/graphql';

// Aave V3 Subgraphs (The Graph Decentralized Network - free tier 5000 queries/month)
// Note: These are the official Aave subgraphs migrated to decentralized network
const AAVE_V3_SUBGRAPHS: Record<string, string> = {
  ethereum: 'https://gateway.thegraph.com/api/subgraphs/id/HB1Z2EAw4rtPRYVb2Nz8QGFLHCpym6ByBX6vbCViuE9F',
  base: 'https://gateway.thegraph.com/api/subgraphs/id/GQFbb95cE6d8mV989mL5figjaGaKCQB3xqYrr1bRyXqF',
  arbitrum: 'https://gateway.thegraph.com/api/subgraphs/id/8mxYLSwDrKccQmVhQwizMjwCtfXdpxqTsKbopqVnqUaE',
  polygon: 'https://gateway.thegraph.com/api/subgraphs/id/Co2URyXjM1mXfGM6GbQv6S6pioS1E1BHXyzJXwGVeNND',
  optimism: 'https://gateway.thegraph.com/api/subgraphs/id/DSfLz8oQBUeU5atALgUFQKMTSYV9mZAVYp4noLSXAfvb',
  avalanche: 'https://gateway.thegraph.com/api/subgraphs/id/EZvK18pMhwiCjxwesRLTg81fP33WnR6BnZe5Cvma3H1C',
};

// Euler V2 Subgraphs (Goldsky hosted)
const EULER_V2_SUBGRAPHS: Record<string, string> = {
  ethereum: 'https://api.goldsky.com/api/public/project_cm4iagnemt1wp01xn4gh1agft/subgraphs/euler-v2-mainnet/latest/gn',
  base: 'https://api.goldsky.com/api/public/project_cm4iagnemt1wp01xn4gh1agft/subgraphs/euler-v2-base/latest/gn',
  arbitrum: 'https://api.goldsky.com/api/public/project_cm4iagnemt1wp01xn4gh1agft/subgraphs/euler-v2-arbitrum/latest/gn',
};

// Spark uses Aave V3 fork - same subgraph pattern
const SPARK_SUBGRAPH = 'https://api.thegraph.com/subgraphs/name/messari/spark-lend-ethereum';

// Chain ID mapping
const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  polygon: 137,
  arbitrum: 42161,
  optimism: 10,
  avalanche: 43114,
  base: 8453,
  solana: 0, // Custom ID for Solana
};

// ============================================
// CoinGecko Price Conversion (Free API)
// ============================================

// Token symbol to CoinGecko ID mapping
const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
  'WETH': 'ethereum',
  'ETH': 'ethereum',
  'USDC': 'usd-coin',
  'USDT': 'tether',
  'DAI': 'dai',
  'WBTC': 'wrapped-bitcoin',
  'BTC': 'bitcoin',
  'CBBTC': 'coinbase-wrapped-btc',
  'STETH': 'staked-ether',
  'WSTETH': 'wrapped-steth',
  'RETH': 'rocket-pool-eth',
  'CBETH': 'coinbase-wrapped-staked-eth',
  'WEETH': 'wrapped-eeth',
  'EZETH': 'renzo-restaked-eth',
  'RSETH': 'kelp-dao-restaked-eth',
  'OSETH': 'stakewise-staked-eth',
  'METH': 'mantle-staked-ether',
  'SFRXETH': 'staked-frax-ether',
  'FRXETH': 'frax-ether',
  'LINK': 'chainlink',
  'UNI': 'uniswap',
  'AAVE': 'aave',
  'CRV': 'curve-dao-token',
  'MKR': 'maker',
  'SNX': 'havven',
  'COMP': 'compound-governance-token',
  'SUSHI': 'sushi',
  'YFI': 'yearn-finance',
  'GRT': 'the-graph',
  'BAL': 'balancer',
  'LDO': 'lido-dao',
  'RPL': 'rocket-pool',
  'APE': 'apecoin',
  'SHIB': 'shiba-inu',
  'PEPE': 'pepe',
  'ARB': 'arbitrum',
  'OP': 'optimism',
  'MATIC': 'matic-network',
  'SOL': 'solana',
  'AVAX': 'avalanche-2',
};

// CoinGecko price cache (5 min TTL)
let priceCache: { prices: Record<string, number>; timestamp: number } | null = null;
const PRICE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getTokenPrices(symbols: string[]): Promise<Record<string, number>> {
  // Return cached if fresh
  if (priceCache && Date.now() - priceCache.timestamp < PRICE_CACHE_TTL) {
    return priceCache.prices;
  }

  try {
    // Get unique CoinGecko IDs
    const ids = [...new Set(
      symbols
        .map(s => SYMBOL_TO_COINGECKO_ID[s.toUpperCase()])
        .filter(Boolean)
    )].join(',');

    if (!ids) {
      console.log('[CoinGecko] No matching token IDs found');
      return {};
    }

    // CoinGecko free API (no key required, 10-30 calls/min)
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      { next: { revalidate: 300 } }
    );

    if (!response.ok) {
      console.error('[CoinGecko] API error:', response.status);
      return priceCache?.prices || {};
    }

    const data = await response.json();
    const prices: Record<string, number> = {};

    // Map back from CoinGecko IDs to symbols
    for (const [symbol, cgId] of Object.entries(SYMBOL_TO_COINGECKO_ID)) {
      if (data[cgId]?.usd) {
        prices[symbol] = data[cgId].usd;
      }
    }

    priceCache = { prices, timestamp: Date.now() };
    console.log(`[CoinGecko] Fetched prices for ${Object.keys(prices).length} tokens`);

    return prices;
  } catch (error) {
    console.error('[CoinGecko] Error fetching prices:', error);
    return priceCache?.prices || {};
  }
}

// ============================================
// Morpho Liquidations (Paginated for full data)
// ============================================

async function fetchMorphoLiquidations(hours: number = 168): Promise<LiquidationEvent[]> {
  const cutoffTimestamp = Math.floor(Date.now() / 1000) - (hours * 3600);
  const allEvents: LiquidationEvent[] = [];
  let hasMore = true;
  let skip = 0;
  const batchSize = 1000;
  const maxEvents = 10000; // Safety limit

  console.log(`[Liquidations] Fetching Morpho liquidations (paginated) since ${new Date(cutoffTimestamp * 1000).toISOString()}`);

  while (hasMore && allEvents.length < maxEvents) {
    const query = `
      query GetLiquidations($timestamp: Int!, $skip: Int!) {
        transactions(
          first: ${batchSize}
          skip: $skip
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
                  loanAsset { symbol }
                  collateralAsset { symbol }
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
          variables: { timestamp: cutoffTimestamp, skip }
        }),
        next: { revalidate: 300 },
      });

      if (!response.ok) {
        console.error('[Liquidations] Morpho API error:', response.status);
        break;
      }

      const data = await response.json();
      const transactions = data?.data?.transactions?.items || [];

      if (transactions.length === 0) {
        hasMore = false;
        break;
      }

      const events = transactions.map((tx: {
        hash: string;
        timestamp: number;
        data: {
          seizedAssetsUsd: number | null;
          repaidAssetsUsd: number;
          badDebtAssetsUsd: number;
          liquidator: string;
          market: {
            uniqueKey: string;
            loanAsset?: { symbol?: string };
            collateralAsset?: { symbol?: string };
            morphoBlue?: { chain?: { id?: number } };
          };
        };
      }) => {
        const chainId = tx.data?.market?.morphoBlue?.chain?.id || 1;
        const badDebt = tx.data?.badDebtAssetsUsd || 0;

        return {
          id: `morpho-${tx.hash}`,
          hash: tx.hash,
          timestamp: tx.timestamp,
          protocol: 'Morpho' as const,
          chain: chainId === 1 ? 'Ethereum' : chainId === 8453 ? 'Base' : `Chain ${chainId}`,
          chainId,
          loanAsset: tx.data?.market?.loanAsset?.symbol || 'Unknown',
          collateralAsset: tx.data?.market?.collateralAsset?.symbol || 'Unknown',
          marketKey: tx.data?.market?.uniqueKey,
          repaidUsd: tx.data?.repaidAssetsUsd || 0,
          seizedUsd: tx.data?.seizedAssetsUsd || 0,
          badDebtUsd: badDebt,
          liquidator: tx.data?.liquidator || '',
          hasSignificantBadDebt: badDebt > 1000,
        };
      });

      allEvents.push(...events);
      skip += batchSize;
      hasMore = transactions.length === batchSize;

      console.log(`[Liquidations] Morpho: fetched ${transactions.length} events (total: ${allEvents.length})`);
    } catch (error) {
      console.error('[Liquidations] Error fetching Morpho page:', error);
      break;
    }
  }

  const totalVolume = allEvents.reduce((sum, e) => sum + e.repaidUsd, 0);
  console.log(`[Liquidations] Morpho total: ${allEvents.length} events, $${(totalVolume / 1e6).toFixed(2)}M volume`);

  return allEvents;
}

// ============================================
// Aave V3 Liquidations (The Graph Decentralized Network)
// Requires GRAPH_API_KEY env variable for authentication
// ============================================

async function fetchAaveLiquidations(
  network: string,
  hours: number = 168
): Promise<LiquidationEvent[]> {
  const baseEndpoint = AAVE_V3_SUBGRAPHS[network];
  if (!baseEndpoint) return [];

  // The Graph Decentralized Network requires an API key
  const apiKey = process.env.GRAPH_API_KEY;
  if (!apiKey) {
    // Only log once per session, not for every network
    if (network === 'ethereum') {
      console.log('[Liquidations] Aave: GRAPH_API_KEY not set, skipping Aave liquidations');
    }
    return [];
  }

  // Add API key to endpoint
  const endpoint = baseEndpoint.includes('?')
    ? `${baseEndpoint}&api_key=${apiKey}`
    : `${baseEndpoint}?api_key=${apiKey}`;

  const cutoffTimestamp = Math.floor(Date.now() / 1000) - (hours * 3600);

  const query = `
    query GetLiquidations($timestamp: Int!) {
      liquidationCalls(
        first: 500
        where: { timestamp_gte: $timestamp }
        orderBy: timestamp
        orderDirection: desc
      ) {
        id
        hash
        timestamp
        collateralAsset {
          symbol
        }
        principalAsset {
          symbol
        }
        collateralAmount
        principalAmount
        liquidator
        user
      }
    }
  `;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        variables: { timestamp: cutoffTimestamp }
      }),
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[Liquidations] Aave ${network} error:`, response.status, text.slice(0, 200));
      return [];
    }

    const data = await response.json();

    if (data.errors) {
      console.error(`[Liquidations] Aave ${network} GraphQL errors:`, data.errors);
      return [];
    }

    const liquidations = data?.data?.liquidationCalls || [];
    console.log(`[Liquidations] Aave ${network}: fetched ${liquidations.length} events`);

    // Get token prices for USD conversion
    const symbols = liquidations
      .map((liq: { collateralAsset?: { symbol?: string }; principalAsset?: { symbol?: string } }) => [
        liq.principalAsset?.symbol,
        liq.collateralAsset?.symbol,
      ])
      .flat()
      .filter(Boolean);
    const prices = await getTokenPrices(symbols);

    return liquidations.map((liq: {
      id: string;
      hash: string;
      timestamp: string;
      collateralAsset?: { symbol?: string };
      principalAsset?: { symbol?: string };
      collateralAmount: string;
      principalAmount: string;
      liquidator: string;
      user: string;
    }) => {
      const loanSymbol = liq.principalAsset?.symbol?.toUpperCase() || 'Unknown';
      const collateralSymbol = liq.collateralAsset?.symbol?.toUpperCase() || 'Unknown';

      // Convert raw amounts to USD using CoinGecko prices
      const rawPrincipal = parseFloat(liq.principalAmount) || 0;
      const rawCollateral = parseFloat(liq.collateralAmount) || 0;

      const loanPrice = prices[loanSymbol] || 0;
      const collateralPrice = prices[collateralSymbol] || 0;

      // Assume 18 decimals for most tokens
      const repaidUsd = (rawPrincipal / 1e18) * loanPrice;
      const seizedUsd = (rawCollateral / 1e18) * collateralPrice;

      return {
        id: `aave-${network}-${liq.id}`,
        hash: liq.hash,
        timestamp: parseInt(liq.timestamp),
        protocol: 'Aave' as const,
        chain: network.charAt(0).toUpperCase() + network.slice(1),
        chainId: CHAIN_IDS[network] || 1,
        loanAsset: loanSymbol,
        collateralAsset: collateralSymbol,
        repaidUsd,
        seizedUsd,
        badDebtUsd: 0,
        liquidator: liq.liquidator,
        borrower: liq.user,
        hasSignificantBadDebt: false,
      };
    });
  } catch (error) {
    console.error(`[Liquidations] Error fetching Aave ${network}:`, error);
    return [];
  }
}

// ============================================
// Euler V2 Liquidations (Goldsky subgraph)
// ============================================

async function fetchEulerLiquidations(
  network: string,
  hours: number = 168
): Promise<LiquidationEvent[]> {
  const endpoint = EULER_V2_SUBGRAPHS[network];
  if (!endpoint) return [];

  const cutoffTimestamp = Math.floor(Date.now() / 1000) - (hours * 3600);

  // Euler Goldsky schema uses 'liquidates' with different field names
  const query = `
    query GetLiquidations($timestamp: BigInt!) {
      liquidates(
        first: 500
        where: { blockTimestamp_gte: $timestamp }
        orderBy: blockTimestamp
        orderDirection: desc
      ) {
        id
        transactionHash
        blockTimestamp
        liquidator
        violator
        repayAssets
        yieldBalance
        vault {
          id
          symbol
        }
        collateral {
          id
          symbol
        }
      }
    }
  `;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { timestamp: cutoffTimestamp.toString() }
      }),
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      console.error(`[Liquidations] Euler ${network} error:`, response.status);
      return [];
    }

    const data = await response.json();

    if (data.errors) {
      console.error(`[Liquidations] Euler ${network} GraphQL errors:`, data.errors);
      return [];
    }

    const liquidations = data?.data?.liquidates || [];
    console.log(`[Liquidations] Euler ${network}: fetched ${liquidations.length} events`);

    // Get token prices for USD conversion
    const symbols = liquidations
      .map((liq: { vault?: { symbol?: string }; collateral?: { symbol?: string } }) => [
        liq.vault?.symbol,
        liq.collateral?.symbol,
      ])
      .flat()
      .filter(Boolean);
    const prices = await getTokenPrices(symbols);

    return liquidations.map((liq: {
      id: string;
      transactionHash: string;
      blockTimestamp: string;
      liquidator: string;
      violator: string;
      repayAssets: string;
      yieldBalance: string;
      vault?: { id: string; symbol?: string };
      collateral?: { id: string; symbol?: string };
    }) => {
      const loanSymbol = liq.vault?.symbol?.toUpperCase() || 'Unknown';
      const collateralSymbol = liq.collateral?.symbol?.toUpperCase() || 'Unknown';

      // Convert raw amounts to USD using CoinGecko prices
      // repayAssets is in raw token units (needs decimal adjustment)
      const rawRepay = parseFloat(liq.repayAssets) || 0;
      const rawYield = parseFloat(liq.yieldBalance) || 0;

      // Assume 18 decimals for most tokens, apply price
      const loanPrice = prices[loanSymbol] || 0;
      const collateralPrice = prices[collateralSymbol] || 0;

      // Rough USD estimate (may be off due to decimal differences)
      const repaidUsd = (rawRepay / 1e18) * loanPrice;
      const seizedUsd = (rawYield / 1e18) * collateralPrice;

      return {
        id: `euler-${network}-${liq.id}`,
        hash: liq.transactionHash,
        timestamp: parseInt(liq.blockTimestamp),
        protocol: 'Euler' as const,
        chain: network.charAt(0).toUpperCase() + network.slice(1),
        chainId: CHAIN_IDS[network] || 1,
        loanAsset: loanSymbol,
        collateralAsset: collateralSymbol,
        repaidUsd,
        seizedUsd,
        badDebtUsd: 0,
        liquidator: liq.liquidator,
        borrower: liq.violator,
        hasSignificantBadDebt: false,
      };
    });
  } catch (error) {
    console.error(`[Liquidations] Error fetching Euler ${network}:`, error);
    return [];
  }
}

// ============================================
// Spark Liquidations (Aave V3 Fork)
// ============================================

async function fetchSparkLiquidations(hours: number = 168): Promise<LiquidationEvent[]> {
  const cutoffTimestamp = Math.floor(Date.now() / 1000) - (hours * 3600);

  const query = `
    query GetLiquidations($timestamp: Int!) {
      liquidates(
        first: 500
        where: { timestamp_gte: $timestamp }
        orderBy: timestamp
        orderDirection: desc
      ) {
        id
        hash
        timestamp
        amountUSD
        profitUSD
        liquidator
        liquidatee
        market {
          inputToken {
            symbol
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(SPARK_SUBGRAPH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { timestamp: cutoffTimestamp }
      }),
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      console.error('[Liquidations] Spark error:', response.status);
      return [];
    }

    const data = await response.json();
    const liquidations = data?.data?.liquidates || [];

    return liquidations.map((liq: {
      id: string;
      hash: string;
      timestamp: string;
      amountUSD: string;
      profitUSD: string;
      liquidator: string;
      liquidatee: string;
      market?: { inputToken?: { symbol?: string } };
    }) => {
      const repaidUsd = parseFloat(liq.amountUSD) || 0;

      return {
        id: `spark-${liq.id}`,
        hash: liq.hash,
        timestamp: parseInt(liq.timestamp),
        protocol: 'Spark' as const,
        chain: 'Ethereum',
        chainId: 1,
        loanAsset: liq.market?.inputToken?.symbol || 'Unknown',
        collateralAsset: 'Unknown',
        repaidUsd,
        seizedUsd: repaidUsd + (parseFloat(liq.profitUSD) || 0),
        badDebtUsd: 0,
        liquidator: liq.liquidator,
        borrower: liq.liquidatee,
        hasSignificantBadDebt: false,
      };
    });
  } catch (error) {
    console.error('[Liquidations] Error fetching Spark:', error);
    return [];
  }
}

// ============================================
// Kamino Liquidations (Helius API)
// Uses Helius enhanced transaction API for reliable liquidation detection
// Requires HELIUS_API_KEY environment variable
// ============================================

// Kamino Lend program ID (from https://github.com/Kamino-Finance/klend)
const KAMINO_LEND_PROGRAM_ID = 'KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD';

// Well-known Solana token mints to symbols
const SOLANA_TOKEN_MINTS: Record<string, { symbol: string; decimals: number }> = {
  'So11111111111111111111111111111111111111112': { symbol: 'SOL', decimals: 9 },
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', decimals: 6 },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', decimals: 6 },
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': { symbol: 'mSOL', decimals: 9 },
  '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj': { symbol: 'stSOL', decimals: 9 },
  'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': { symbol: 'JitoSOL', decimals: 9 },
  'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1': { symbol: 'bSOL', decimals: 9 },
  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': { symbol: 'wETH', decimals: 8 },
  '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh': { symbol: 'wBTC', decimals: 8 },
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': { symbol: 'BONK', decimals: 5 },
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': { symbol: 'JUP', decimals: 6 },
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3': { symbol: 'PYTH', decimals: 6 },
  'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof': { symbol: 'RENDER', decimals: 8 },
};

async function fetchKaminoLiquidations(hours: number = 168): Promise<LiquidationEvent[]> {
  const heliusApiKey = process.env.HELIUS_API_KEY;

  if (!heliusApiKey) {
    console.log('[Liquidations] Kamino: HELIUS_API_KEY not set, skipping Kamino liquidations');
    return [];
  }

  const cutoffTimestamp = Math.floor(Date.now() / 1000) - (hours * 3600);
  console.log(`[Liquidations] Kamino: Fetching via Helius API (last ${hours}h)...`);

  try {
    // Use Helius RPC for getSignaturesForAddress with better history
    const heliusRpc = `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;

    // First, get transaction signatures for Kamino program
    const signaturesResponse = await fetch(heliusRpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getSignaturesForAddress',
        params: [
          KAMINO_LEND_PROGRAM_ID,
          { limit: 1000 }
        ]
      }),
    });

    const signaturesData = await signaturesResponse.json();
    const signatures = signaturesData?.result || [];

    // Filter by timestamp
    const recentSignatures = signatures.filter((sig: { blockTime?: number }) =>
      sig.blockTime && sig.blockTime >= cutoffTimestamp
    );

    console.log(`[Liquidations] Kamino: Found ${recentSignatures.length} recent transactions`);

    if (recentSignatures.length === 0) {
      return [];
    }

    // Get token prices for USD conversion
    const prices = await getTokenPrices(Object.values(SOLANA_TOKEN_MINTS).map(t => t.symbol));

    // Use Helius enhanced transactions API to get parsed transaction data
    // Process in batches of 100 (Helius limit)
    const liquidationEvents: LiquidationEvent[] = [];
    const batchSize = 100;

    for (let i = 0; i < Math.min(recentSignatures.length, 500); i += batchSize) {
      const batch = recentSignatures.slice(i, i + batchSize);
      const txSignatures = batch.map((s: { signature: string }) => s.signature);

      // Use Helius parsed transaction history API
      const parsedTxResponse = await fetch(
        `https://api.helius.xyz/v0/transactions?api-key=${heliusApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactions: txSignatures }),
        }
      );

      if (!parsedTxResponse.ok) {
        console.error(`[Liquidations] Kamino: Helius API error: ${parsedTxResponse.status}`);
        continue;
      }

      const parsedTxs = await parsedTxResponse.json();

      for (const tx of parsedTxs) {
        // Look for liquidation-related instructions or token transfers
        const event = parseKaminoTransaction(tx, prices);
        if (event) {
          liquidationEvents.push(event);
        }
      }

      // Small delay between batches
      if (i + batchSize < recentSignatures.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const totalVolume = liquidationEvents.reduce((sum, e) => sum + e.repaidUsd, 0);
    console.log(`[Liquidations] Kamino: Found ${liquidationEvents.length} liquidation events, $${(totalVolume / 1e6).toFixed(2)}M volume`);
    return liquidationEvents;
  } catch (error) {
    console.error('[Liquidations] Kamino: Error fetching via Helius:', error);
    return [];
  }
}

// Parse a Helius-enhanced transaction for liquidation data
function parseKaminoTransaction(
  tx: {
    signature: string;
    timestamp?: number;
    type?: string;
    description?: string;
    source?: string;
    tokenTransfers?: Array<{
      mint: string;
      tokenAmount: number;
      fromUserAccount?: string;
      toUserAccount?: string;
    }>;
    nativeTransfers?: Array<{
      amount: number;
      fromUserAccount?: string;
      toUserAccount?: string;
    }>;
    accountData?: Array<{
      account: string;
      nativeBalanceChange?: number;
      tokenBalanceChanges?: Array<{
        mint: string;
        rawTokenAmount: { tokenAmount: string; decimals: number };
        userAccount: string;
      }>;
    }>;
    instructions?: Array<{
      programId: string;
      data?: string;
      accounts?: string[];
      innerInstructions?: Array<unknown>;
    }>;
  },
  prices: Record<string, number>
): LiquidationEvent | null {
  // Check if this involves Kamino Lend program
  const involvesKamino = tx.instructions?.some(
    (ix: { programId: string }) => ix.programId === KAMINO_LEND_PROGRAM_ID
  );

  if (!involvesKamino) return null;

  // Look for liquidation indicators:
  // Helius types for liquidations: LIQUIDATE, LIQUIDATE_OBLIGATION_AND_REDEEM_RESERVE_COLLATERAL
  const liquidationTypes = [
    'LIQUIDATE',
    'LIQUIDATE_OBLIGATION',
    'LIQUIDATE_OBLIGATION_AND_REDEEM_RESERVE_COLLATERAL',
  ];
  const isLiquidationType = liquidationTypes.some(t => tx.type?.toUpperCase().includes(t)) ||
    tx.description?.toLowerCase().includes('liquidat');

  // Analyze token transfers
  const tokenTransfers = tx.tokenTransfers || [];
  const significantTransfers = tokenTransfers.filter(t => {
    const tokenInfo = SOLANA_TOKEN_MINTS[t.mint];
    if (!tokenInfo) return false;
    const price = prices[tokenInfo.symbol] || 0;
    const usdValue = (t.tokenAmount / Math.pow(10, tokenInfo.decimals)) * price;
    return usdValue > 100; // Filter noise
  });

  // For liquidation, we expect at least 2 significant transfers
  // (one for repaying debt, one for seizing collateral)
  if (significantTransfers.length < 2 && !isLiquidationType) {
    return null;
  }

  // Calculate repaid and seized amounts
  let repaidUsd = 0;
  let seizedUsd = 0;
  let loanAsset = 'Unknown';
  let collateralAsset = 'Unknown';

  // Sort by value to find main transfers
  const sortedTransfers = [...significantTransfers].sort((a, b) => {
    const aInfo = SOLANA_TOKEN_MINTS[a.mint];
    const bInfo = SOLANA_TOKEN_MINTS[b.mint];
    const aPrice = prices[aInfo?.symbol || ''] || 0;
    const bPrice = prices[bInfo?.symbol || ''] || 0;
    const aValue = (a.tokenAmount / Math.pow(10, aInfo?.decimals || 9)) * aPrice;
    const bValue = (b.tokenAmount / Math.pow(10, bInfo?.decimals || 9)) * bPrice;
    return Math.abs(bValue) - Math.abs(aValue);
  });

  if (sortedTransfers.length >= 1) {
    const firstTransfer = sortedTransfers[0];
    const tokenInfo = SOLANA_TOKEN_MINTS[firstTransfer.mint];
    if (tokenInfo) {
      loanAsset = tokenInfo.symbol;
      repaidUsd = (Math.abs(firstTransfer.tokenAmount) / Math.pow(10, tokenInfo.decimals)) *
        (prices[tokenInfo.symbol] || 0);
    }
  }

  if (sortedTransfers.length >= 2) {
    const secondTransfer = sortedTransfers[1];
    const tokenInfo = SOLANA_TOKEN_MINTS[secondTransfer.mint];
    if (tokenInfo) {
      collateralAsset = tokenInfo.symbol;
      seizedUsd = (Math.abs(secondTransfer.tokenAmount) / Math.pow(10, tokenInfo.decimals)) *
        (prices[tokenInfo.symbol] || 0);
    }
  }

  // If we couldn't determine significant value, check accountData
  if (repaidUsd < 100 && tx.accountData) {
    for (const account of tx.accountData) {
      if (account.tokenBalanceChanges) {
        for (const change of account.tokenBalanceChanges) {
          const tokenInfo = SOLANA_TOKEN_MINTS[change.mint];
          if (!tokenInfo) continue;

          const amount = Math.abs(parseFloat(change.rawTokenAmount.tokenAmount));
          const decimals = change.rawTokenAmount.decimals || tokenInfo.decimals;
          const usdValue = (amount / Math.pow(10, decimals)) * (prices[tokenInfo.symbol] || 0);

          if (usdValue > repaidUsd) {
            repaidUsd = usdValue;
            loanAsset = tokenInfo.symbol;
          }
        }
      }
    }
  }

  // Skip if value too low
  if (repaidUsd < 100) return null;

  return {
    id: `kamino-${tx.signature}`,
    hash: tx.signature,
    timestamp: tx.timestamp || Math.floor(Date.now() / 1000),
    protocol: 'Kamino' as const,
    chain: 'Solana',
    chainId: 0,
    loanAsset,
    collateralAsset,
    repaidUsd,
    seizedUsd: seizedUsd || repaidUsd,
    badDebtUsd: 0,
    liquidator: '',
    borrower: '',
    hasSignificantBadDebt: false,
  };
}

// ============================================
// Aggregation Functions
// ============================================

export async function getMultiProtocolLiquidations(
  hours: number = 168
): Promise<MultiProtocolLiquidationData> {
  const now = Math.floor(Date.now() / 1000);
  const oneDayAgo = now - 86400;

  console.log('[Liquidations] Fetching multi-protocol liquidations (free APIs only)...');

  // Fetch from all protocols in parallel (no Dune - free APIs only)
  const [
    morphoEvents,
    aaveEthEvents,
    aaveBaseEvents,
    aaveArbEvents,
    aavePolyEvents,
    aaveOpEvents,
    eulerEthEvents,
    eulerBaseEvents,
    eulerArbEvents,
    sparkEvents,
    kaminoEvents,
  ] = await Promise.all([
    fetchMorphoLiquidations(hours),
    fetchAaveLiquidations('ethereum', hours).catch(() => []),
    fetchAaveLiquidations('base', hours).catch(() => []),
    fetchAaveLiquidations('arbitrum', hours).catch(() => []),
    fetchAaveLiquidations('polygon', hours).catch(() => []),
    fetchAaveLiquidations('optimism', hours).catch(() => []),
    fetchEulerLiquidations('ethereum', hours).catch(() => []),
    fetchEulerLiquidations('base', hours).catch(() => []),
    fetchEulerLiquidations('arbitrum', hours).catch(() => []),
    fetchSparkLiquidations(hours).catch(() => []),
    fetchKaminoLiquidations(hours).catch(() => []),
  ]);

  // Log fetched data
  console.log('[Liquidations] Fetched from free APIs:');
  console.log(`  Morpho: ${morphoEvents.length} events`);
  const aaveTotal = aaveEthEvents.length + aaveBaseEvents.length + aaveArbEvents.length + aavePolyEvents.length + aaveOpEvents.length;
  console.log(`  Aave: ${aaveTotal} events (ETH:${aaveEthEvents.length}, Base:${aaveBaseEvents.length}, Arb:${aaveArbEvents.length}, Poly:${aavePolyEvents.length}, OP:${aaveOpEvents.length})`);
  const eulerTotal = eulerEthEvents.length + eulerBaseEvents.length + eulerArbEvents.length;
  console.log(`  Euler: ${eulerTotal} events (ETH:${eulerEthEvents.length}, Base:${eulerBaseEvents.length}, Arb:${eulerArbEvents.length})`);
  console.log(`  Spark: ${sparkEvents.length} events`);
  console.log(`  Kamino: ${kaminoEvents.length} events (via Helius API)`);

  // Combine all events
  const allEvents: LiquidationEvent[] = [
    ...morphoEvents,
    ...aaveEthEvents,
    ...aaveBaseEvents,
    ...aaveArbEvents,
    ...aavePolyEvents,
    ...aaveOpEvents,
    ...eulerEthEvents,
    ...eulerBaseEvents,
    ...eulerArbEvents,
    ...sparkEvents,
    ...kaminoEvents,
  ];

  // Sort by timestamp (most recent first)
  allEvents.sort((a, b) => b.timestamp - a.timestamp);

  // Calculate per-protocol summaries
  // Initialize all monitored protocols (even with 0 events) to show coverage
  const monitoredProtocols = ['Morpho', 'Euler', 'Kamino'] as const;
  const protocolGroups = new Map<string, LiquidationEvent[]>();

  // Initialize all monitored protocols with empty arrays
  for (const protocol of monitoredProtocols) {
    protocolGroups.set(protocol, []);
  }

  // Add events to their protocol groups
  for (const event of allEvents) {
    if (!protocolGroups.has(event.protocol)) {
      protocolGroups.set(event.protocol, []);
    }
    protocolGroups.get(event.protocol)!.push(event);
  }

  const protocolSummaries: ProtocolLiquidationSummary[] = [];

  for (const [protocol, events] of protocolGroups) {
    const events24h = events.filter(e => e.timestamp >= oneDayAgo);
    const volume24h = events24h.reduce((sum, e) => sum + e.repaidUsd, 0);
    const volume7d = events.reduce((sum, e) => sum + e.repaidUsd, 0);
    const badDebt24h = events24h.reduce((sum, e) => sum + e.badDebtUsd, 0);
    const badDebt7d = events.reduce((sum, e) => sum + e.badDebtUsd, 0);

    // Calculate top markets
    const marketVolumes = new Map<string, number>();
    for (const event of events) {
      const key = `${event.loanAsset}-${event.collateralAsset}`;
      marketVolumes.set(key, (marketVolumes.get(key) || 0) + event.repaidUsd);
    }

    const topMarkets = Array.from(marketVolumes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, volume]) => {
        const [loanAsset, collateralAsset] = key.split('-');
        return { loanAsset, collateralAsset, volume7d: volume };
      });

    protocolSummaries.push({
      protocol,
      volume24h,
      volume7d,
      count24h: events24h.length,
      count7d: events.length,
      badDebt24h,
      badDebt7d,
      topMarkets,
    });

    console.log(`[Liquidations] ${protocol}: $${(volume7d / 1e6).toFixed(2)}M (7d), ${events.length} events`);
  }

  // Sort by volume
  protocolSummaries.sort((a, b) => b.volume7d - a.volume7d);

  // Calculate totals
  const events24h = allEvents.filter(e => e.timestamp >= oneDayAgo);
  const totalVolume24h = events24h.reduce((sum, e) => sum + e.repaidUsd, 0);
  const totalVolume7d = allEvents.reduce((sum, e) => sum + e.repaidUsd, 0);

  const totals = {
    volume24h: totalVolume24h,
    volume7d: totalVolume7d,
    count24h: events24h.length,
    count7d: allEvents.length,
    badDebt24h: events24h.reduce((sum, e) => sum + e.badDebtUsd, 0),
    badDebt7d: allEvents.reduce((sum, e) => sum + e.badDebtUsd, 0),
  };

  console.log(`[Liquidations] Total: ${allEvents.length} events, $${(totalVolume7d / 1e6).toFixed(2)}M (7d) across ${protocolSummaries.length} protocols`);

  // Compute daily aggregation from ALL events before slicing
  const dailyVolume = aggregateLiquidationsByDay(allEvents, 7);

  // Get recent events (make explicit copy to avoid serialization issues)
  const recentEvents = allEvents.slice(0, 100).map(e => ({
    id: e.id,
    hash: e.hash,
    timestamp: e.timestamp,
    protocol: e.protocol,
    chain: e.chain,
    chainId: e.chainId,
    loanAsset: e.loanAsset,
    collateralAsset: e.collateralAsset,
    marketKey: e.marketKey || null,
    repaidUsd: e.repaidUsd,
    seizedUsd: e.seizedUsd,
    badDebtUsd: e.badDebtUsd,
    liquidator: e.liquidator,
    borrower: e.borrower || null,
    hasSignificantBadDebt: e.hasSignificantBadDebt,
  }));

  console.log(`[Liquidations] Returning: ${recentEvents.length} recent events, ${dailyVolume.length} daily entries`);

  return {
    recentEvents,
    protocolSummaries,
    totals,
    dailyVolume,
    timestamp: new Date().toISOString(),
  };
}

// Daily aggregation helper function
function aggregateLiquidationsByDay(
  events: LiquidationEvent[],
  days: number = 7
): DailyLiquidationVolume[] {
  // Use object instead of Map for more reliable serialization
  const dailyData: Record<string, DailyLiquidationVolume> = {};

  // Initialize days
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    dailyData[dateStr] = {
      date: dateStr,
      volume: 0,
      count: 0,
      badDebt: 0,
      byProtocol: {},
    };
  }

  // Aggregate events
  for (const event of events) {
    const date = new Date(event.timestamp * 1000).toISOString().split('T')[0];
    const day = dailyData[date];
    if (day) {
      day.volume += event.repaidUsd;
      day.count += 1;
      day.badDebt += event.badDebtUsd;
      day.byProtocol[event.protocol] = (day.byProtocol[event.protocol] || 0) + event.repaidUsd;
    }
  }

  // Convert to array sorted by date (explicit array construction)
  const result: DailyLiquidationVolume[] = [];
  for (const dateStr of Object.keys(dailyData).sort()) {
    result.push(dailyData[dateStr]);
  }

  console.log(`[Liquidations] Daily aggregation: ${result.length} days, processed ${events.length} events`);
  return result;
}
