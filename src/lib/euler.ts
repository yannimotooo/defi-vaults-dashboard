// Euler V2 Subgraph client for fee and vault data
// Uses Goldsky-hosted subgraphs
// Documentation: https://docs.euler.finance/developers/data-querying/subgraphs/

// ============================================
// Token Decimals Lookup
// ============================================
// The Euler subgraph returns `asset` as a flat address string (no nested decimals).
// We maintain a static map of well-known EVM token addresses → decimals.
// Tokens not in this map default to 18 decimals.
const EVM_TOKEN_DECIMALS: Record<string, number> = {
  // --- USDC (6 decimals) ---
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 6, // USDC Ethereum
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 6, // USDC Base
  '0xaf88d065e77c8cc2239327c5edb3a432268e5831': 6, // USDC Arbitrum
  '0x0b2c639c533813f4aa9d7837caf62653d097ff85': 6, // USDC Optimism
  '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e': 6, // USDC Avalanche
  '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d': 18, // USDC BSC (Binance-Peg USDC is 18 decimals)
  '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83': 6, // USDC Gnosis
  // --- USDT (6 decimals) ---
  '0xdac17f958d2ee523a2206206994597c13d831ec7': 6, // USDT Ethereum
  '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9': 6, // USDT Arbitrum
  '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58': 6, // USDT Optimism
  '0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7': 6, // USDT Avalanche
  '0x55d398326f99059ff775485246999027b3197955': 18, // USDT BSC (18 on BSC)
  '0x4ecaba5870353805a9f068101a40e0f32ed605c6': 6, // USDT Gnosis
  // --- WBTC (8 decimals) ---
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 8, // WBTC Ethereum
  '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f': 8, // WBTC Arbitrum
  '0x68f180fcce6836688e9084f035309e29bf0a2095': 8, // WBTC Optimism
  '0x50b7545627a5162f82a992c33b87adc75187b218': 8, // WBTC Avalanche
  // --- DAI (18 decimals — included for completeness) ---
  '0x6b175474e89094c44da98b954eedeac495271d0f': 18, // DAI Ethereum
  // --- WETH (18 decimals) ---
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 18, // WETH Ethereum
  '0x4200000000000000000000000000000000000006': 18, // WETH Base/Optimism
  '0x82af49447d8a07e3bd95bd0d56f35241523fbab1': 18, // WETH Arbitrum
  '0x49d5c2bdffac6ce2bfdb6fd9b3c0e2f5b5e21a31': 18, // WETH Avalanche
};

// Known non-stablecoin symbols (TVL = token amount, NOT USD)
const NON_STABLECOIN_SYMBOLS = ['ETH', 'WETH', 'BTC', 'WBTC', 'SOL', 'WSOL', 'AVAX', 'WAVAX', 'MATIC', 'WMATIC', 'BNB', 'WBNB'];

function getTokenDecimals(assetAddress: string): number {
  return EVM_TOKEN_DECIMALS[assetAddress.toLowerCase()] ?? 18;
}

// Subgraph endpoints by network
const EULER_SUBGRAPH_ENDPOINTS: Record<string, string> = {
  mainnet: 'https://api.goldsky.com/api/public/project_cm4iagnemt1wp01xn4gh1agft/subgraphs/euler-v2-mainnet/latest/gn',
  base: 'https://api.goldsky.com/api/public/project_cm4iagnemt1wp01xn4gh1agft/subgraphs/euler-v2-base/latest/gn',
  arbitrum: 'https://api.goldsky.com/api/public/project_cm4iagnemt1wp01xn4gh1agft/subgraphs/euler-v2-arbitrum/latest/gn',
  optimism: 'https://api.goldsky.com/api/public/project_cm4iagnemt1wp01xn4gh1agft/subgraphs/euler-v2-optimism/latest/gn',
  avalanche: 'https://api.goldsky.com/api/public/project_cm4iagnemt1wp01xn4gh1agft/subgraphs/euler-v2-avalanche/latest/gn',
  bsc: 'https://api.goldsky.com/api/public/project_cm4iagnemt1wp01xn4gh1agft/subgraphs/euler-v2-bsc/latest/gn',
  sonic: 'https://api.goldsky.com/api/public/project_cm4iagnemt1wp01xn4gh1agft/subgraphs/euler-v2-sonic/latest/gn',
  gnosis: 'https://api.goldsky.com/api/public/project_cm4iagnemt1wp01xn4gh1agft/subgraphs/euler-v2-gnosis/latest/gn',
};

export interface EulerVault {
  id: string;
  name: string;
  symbol: string;
  asset: string;
  curator?: string | null;
  owner?: string;
  feeReceiver?: string | null;
  performanceFee?: string; // Stored as basis points or percentage
  totalAssets: string;
  totalAllocated: string;
  chain: string;
}

export interface EulerCuratorFeeData {
  curatorName: string;
  vaultCount: number;
  totalTvl: number;
  avgPerformanceFee: number;
  vaults: Array<{
    vaultName: string;
    vaultSymbol: string;
    tvl: number;
    performanceFee: number;
    chain: string;
  }>;
}

// GraphQL query for EulerEarn vaults (curator-managed)
const EULER_EARN_VAULTS_QUERY = `
  query EulerEarnVaults($first: Int!, $skip: Int!) {
    eulerEarnVaults(
      first: $first
      skip: $skip
      orderBy: totalAssets
      orderDirection: desc
    ) {
      id
      name
      symbol
      asset
      owner
      creator
      curator
      feeReceiver
      performanceFee
      totalAssets
      totalAllocated
    }
  }
`;

// Some Euler subgraphs lag the latest schema and do not expose curator/fee
// fields. Use this narrower query as a TVL-preserving fallback instead of
// dropping the whole network on GraphQL validation errors.
const EULER_EARN_VAULTS_BASIC_QUERY = `
  query EulerEarnVaultsBasic($first: Int!, $skip: Int!) {
    eulerEarnVaults(
      first: $first
      skip: $skip
      orderBy: totalAssets
      orderDirection: desc
    ) {
      id
      name
      symbol
      asset
      owner
      totalAssets
      totalAllocated
    }
  }
`;

// Fetch Euler Earn vaults from a specific network
async function fetchEulerEarnVaults(network: string): Promise<EulerVault[]> {
  const endpoint = EULER_SUBGRAPH_ENDPOINTS[network];
  if (!endpoint) return [];

  try {
    const allVaults: EulerVault[] = [];
    let skip = 0;
    const pageSize = 100;
    let hasMore = true;

    while (hasMore) {
      const runQuery = async (query: string) => fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: { first: pageSize, skip },
        }),
        next: { revalidate: 300 },
      });

      let response = await runQuery(EULER_EARN_VAULTS_QUERY);

      if (!response.ok) {
        console.error(`Euler subgraph error (${network}):`, response.status);
        break;
      }

      let data = await response.json();

      if (data.errors) {
        const missingOptionalField = data.errors.some((error: { message?: string }) =>
          ['creator', 'curator', 'feeReceiver', 'performanceFee'].some(field =>
            error.message?.includes(`field \`${field}\``) || error.message?.includes(`field "${field}"`),
          ),
        );

        if (!missingOptionalField) {
          console.error(`Euler GraphQL errors (${network}):`, data.errors);
          break;
        }

        console.warn(`[Euler] ${network} subgraph missing fee/curator fields; using basic TVL query`);
        response = await runQuery(EULER_EARN_VAULTS_BASIC_QUERY);
        if (!response.ok) {
          console.error(`Euler fallback subgraph error (${network}):`, response.status);
          break;
        }
        data = await response.json();
        if (data.errors) {
          console.error(`Euler fallback GraphQL errors (${network}):`, data.errors);
          break;
        }
      }

      const vaults = data.data?.eulerEarnVaults || [];

      // Add chain info to each vault
      const vaultsWithChain = vaults.map((v: Omit<EulerVault, 'chain'>) => ({
        ...v,
        curator: v.curator ?? null,
        feeReceiver: v.feeReceiver ?? null,
        performanceFee: v.performanceFee ?? '0',
        chain: formatChainName(network),
      }));

      allVaults.push(...vaultsWithChain);

      hasMore = vaults.length === pageSize;
      skip += pageSize;
    }

    return allVaults;
  } catch (error) {
    console.error(`Error fetching Euler vaults from ${network}:`, error);
    return [];
  }
}

function formatChainName(network: string): string {
  const nameMap: Record<string, string> = {
    mainnet: 'Ethereum',
    base: 'Base',
    arbitrum: 'Arbitrum',
    optimism: 'Optimism',
    avalanche: 'Avalanche',
    bsc: 'BSC',
    sonic: 'Sonic',
    gnosis: 'Gnosis',
  };
  return nameMap[network] || network;
}

// Fetch all Euler vaults across all networks
export async function getAllEulerVaults(): Promise<EulerVault[]> {
  const networks = Object.keys(EULER_SUBGRAPH_ENDPOINTS);

  const results = await Promise.all(
    networks.map(network => fetchEulerEarnVaults(network).catch(e => {
      console.warn(`[Euler] Failed to fetch ${network}:`, e instanceof Error ? e.message : e);
      return [];
    }))
  );

  const allVaults = results.flat();
  console.log(`Euler: Fetched ${allVaults.length} vaults across ${networks.length} networks`);

  return allVaults;
}

// Known Euler curator addresses (lowercase)
const EULER_CURATOR_ADDRESSES: Record<string, string> = {
  // Add known curator addresses here as we discover them
  // Format: 'address': 'Curator Name'
};

// Get curator name from address or vault metadata
function getCuratorName(vault: EulerVault): string {
  if (vault.curator) {
    const known = EULER_CURATOR_ADDRESSES[vault.curator.toLowerCase()];
    if (known) return known;
  }

  // Try to extract from vault name
  // Common patterns: "RE7 ETH Vault", "Gauntlet USDC", etc.
  const vaultName = vault.name || '';
  const knownCurators = ['RE7', 'Gauntlet', 'Steakhouse', 'MEV Capital', 'K3', 'Block Analitica'];

  for (const curator of knownCurators) {
    if (vaultName.toLowerCase().includes(curator.toLowerCase())) {
      return curator;
    }
  }

  return 'Euler DAO'; // Default to Euler DAO for ungoverned vaults
}

/**
 * Parse a performance fee value from the Euler V2 subgraph.
 *
 * The subgraph occasionally returns fees in inconsistent formats across
 * versions: WAD (1e18 = 100%), basis points (1000 = 10%), percentage (10 = 10%),
 * or decimal (0.1 = 10%). This helper detects the format heuristically and
 * always returns a Percent value (0-100). See src/lib/fees.ts for the
 * canonical Percent / Decimal conventions.
 */
export function parsePerformanceFee(fee: string | null | undefined): number {
  const feeNum = parseFloat(fee ?? '0');
  if (isNaN(feeNum)) return 0;

  // WAD format: 1e18 = 100% — Euler V2 subgraph uses this
  if (feeNum > 1e14) {
    return Math.min((feeNum / 1e18) * 100, 100);
  }

  // Basis points: e.g., 1000 = 10%
  if (feeNum > 100) {
    return Math.min(feeNum / 100, 100);
  }

  // Already a percentage (0-100)
  if (feeNum > 1 && feeNum <= 100) return Math.min(feeNum, 100);

  // Decimal (0-1)
  if (feeNum >= 0 && feeNum <= 1) return Math.min(feeNum * 100, 100);

  return 0;
}

// Parse total assets (BigInt string to human-readable token amount)
// Uses EVM_TOKEN_DECIMALS lookup for correct decimals per token.
// NOTE: Still treats token amount as USD — only accurate for stablecoins.
// Non-stablecoin vaults (ETH, WBTC) need a price feed for true USD value.
function parseTotalAssets(assets: string, decimals: number = 18): number {
  try {
    const bigAssets = BigInt(assets);
    if (bigAssets === BigInt(0)) return 0;
    const divisor = BigInt(10 ** decimals);
    const result = Number(bigAssets / divisor);
    // Sanity check: if result is suspiciously small for what should be a vault, log it
    if (result > 0 && result < 1 && bigAssets > BigInt(1000000)) {
      console.warn(`[Euler] parseTotalAssets may have wrong decimals: raw=${assets}, decimals=${decimals}, result=${result}`);
    }
    return result;
  } catch {
    console.warn(`[Euler] Failed to parse totalAssets: ${assets}`);
    return 0;
  }
}

// Get fee data aggregated by curator
export async function getEulerCuratorFeeData(): Promise<EulerCuratorFeeData[]> {
  const allVaults = await getAllEulerVaults();

  // Group vaults by curator
  const curatorVaultsMap = new Map<string, EulerVault[]>();

  for (const vault of allVaults) {
    const curatorName = getCuratorName(vault);

    if (!curatorVaultsMap.has(curatorName)) {
      curatorVaultsMap.set(curatorName, []);
    }
    curatorVaultsMap.get(curatorName)!.push(vault);
  }

  // Calculate metrics for each curator
  const curatorFeeData: EulerCuratorFeeData[] = [];

  for (const [curatorName, vaults] of curatorVaultsMap) {
    if (vaults.length === 0) continue;

    // Calculate total TVL using correct decimals per token
    const totalTvl = vaults.reduce((sum, v) => {
      return sum + parseTotalAssets(v.totalAssets, getTokenDecimals(v.asset));
    }, 0);

    // Skip very small curators
    if (totalTvl < 10000) continue;

    // Calculate TVL-weighted average performance fee
    let weightedFee = 0;
    const vaultDetails = vaults.map(vault => {
      const tvl = parseTotalAssets(vault.totalAssets, getTokenDecimals(vault.asset));
      const weight = totalTvl > 0 ? tvl / totalTvl : 0;
      const performanceFee = parsePerformanceFee(vault.performanceFee);

      weightedFee += performanceFee * weight;

      return {
        vaultName: vault.name || vault.id,
        vaultSymbol: vault.symbol || '',
        tvl,
        performanceFee,
        chain: vault.chain,
      };
    });

    // Sort by TVL
    vaultDetails.sort((a, b) => b.tvl - a.tvl);

    curatorFeeData.push({
      curatorName,
      vaultCount: vaults.length,
      totalTvl,
      avgPerformanceFee: weightedFee,
      vaults: vaultDetails,
    });
  }

  // Sort by TVL
  curatorFeeData.sort((a, b) => b.totalTvl - a.totalTvl);

  return curatorFeeData;
}

// Get fee data for a specific curator
export async function getEulerCuratorFeeDataByName(curatorName: string): Promise<EulerCuratorFeeData | null> {
  const allCuratorData = await getEulerCuratorFeeData();

  // Fuzzy match curator name
  const normalizedSearch = curatorName.toLowerCase().replace(/[\s-]/g, '');

  for (const data of allCuratorData) {
    const normalizedName = data.curatorName.toLowerCase().replace(/[\s-]/g, '');
    if (normalizedName.includes(normalizedSearch) || normalizedSearch.includes(normalizedName)) {
      return data;
    }
  }

  return null;
}

// ============================================
// Euler Curator TVL Data (Authoritative On-Chain Source)
// ============================================

export interface EulerCuratorTvlData {
  curatorName: string;
  totalTvlUsd: number;
  vaultCount: number;
  chains: string[];
  vaults: Array<{
    vaultName: string;
    vaultSymbol: string;
    tvlUsd: number;
    chain: string;
  }>;
  avgPerformanceFee: number;
}

// Get TVL data aggregated by curator from Euler subgraph
// This is the AUTHORITATIVE source for Euler vault TVL
export async function getEulerCuratorsTvl(): Promise<EulerCuratorTvlData[]> {
  const allVaults = await getAllEulerVaults();

  // Group vaults by curator
  const curatorVaultsMap = new Map<string, EulerVault[]>();

  for (const vault of allVaults) {
    const curatorName = getCuratorName(vault);

    if (!curatorVaultsMap.has(curatorName)) {
      curatorVaultsMap.set(curatorName, []);
    }
    curatorVaultsMap.get(curatorName)!.push(vault);
  }

  // Calculate metrics for each curator
  const curatorTvlData: EulerCuratorTvlData[] = [];

  for (const [curatorName, vaults] of curatorVaultsMap) {
    if (vaults.length === 0) continue;

    // Get unique chains
    const chains = [...new Set(vaults.map(v => v.chain))];

    // Calculate total TVL and collect vault details
    let totalTvlUsd = 0;
    const vaultDetails: EulerCuratorTvlData['vaults'] = [];

    // Track TVL-weighted fee
    let weightedFee = 0;

    for (const vault of vaults) {
      const decimals = getTokenDecimals(vault.asset);
      const tvl = parseTotalAssets(vault.totalAssets, decimals);
      if (tvl < 1000) continue; // Skip dust vaults

      // Warn for non-stablecoin vaults where TVL = token amount, not USD
      const sym = (vault.symbol || '').toUpperCase();
      if (NON_STABLECOIN_SYMBOLS.some(s => sym.includes(s)) && tvl > 1) {
        console.warn(`[Euler] Non-stablecoin vault "${vault.name}" (${vault.symbol}): TVL=${tvl.toFixed(2)} tokens treated as USD — needs price feed`);
      }

      totalTvlUsd += tvl;

      vaultDetails.push({
        vaultName: vault.name || vault.id,
        vaultSymbol: vault.symbol || '',
        tvlUsd: tvl,
        chain: vault.chain,
      });
    }

    // Skip very small curators
    if (totalTvlUsd < 10000) continue;

    // Calculate TVL-weighted average performance fee
    for (const vault of vaults) {
      const tvl = parseTotalAssets(vault.totalAssets, getTokenDecimals(vault.asset));
      const weight = totalTvlUsd > 0 ? tvl / totalTvlUsd : 0;
      const performanceFee = parsePerformanceFee(vault.performanceFee);
      weightedFee += performanceFee * weight;
    }

    // Sort vault details by TVL
    vaultDetails.sort((a, b) => b.tvlUsd - a.tvlUsd);

    curatorTvlData.push({
      curatorName,
      totalTvlUsd,
      vaultCount: vaultDetails.length,
      chains,
      vaults: vaultDetails,
      avgPerformanceFee: weightedFee,
    });
  }

  // Sort by TVL
  curatorTvlData.sort((a, b) => b.totalTvlUsd - a.totalTvlUsd);

  console.log(`[Euler] Aggregated TVL for ${curatorTvlData.length} curators, total: $${(curatorTvlData.reduce((s, c) => s + c.totalTvlUsd, 0) / 1e6).toFixed(2)}M`);

  return curatorTvlData;
}
