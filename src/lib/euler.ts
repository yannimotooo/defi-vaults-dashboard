// Euler V2 Subgraph client for fee and vault data
// Uses Goldsky-hosted subgraphs
// Documentation: https://docs.euler.finance/developers/data-querying/subgraphs/

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
  curator: string | null;
  owner: string;
  feeReceiver: string | null;
  performanceFee: string; // Stored as basis points or percentage
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
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: EULER_EARN_VAULTS_QUERY,
          variables: { first: pageSize, skip },
        }),
        next: { revalidate: 300 },
      });

      if (!response.ok) {
        console.error(`Euler subgraph error (${network}):`, response.status);
        break;
      }

      const data = await response.json();

      if (data.errors) {
        console.error(`Euler GraphQL errors (${network}):`, data.errors);
        break;
      }

      const vaults = data.data?.eulerEarnVaults || [];

      // Add chain info to each vault
      const vaultsWithChain = vaults.map((v: Omit<EulerVault, 'chain'>) => ({
        ...v,
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
    networks.map(network => fetchEulerEarnVaults(network).catch(() => []))
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

// Parse performance fee from subgraph (may be basis points or percentage)
function parsePerformanceFee(fee: string): number {
  const feeNum = parseFloat(fee);
  if (isNaN(feeNum)) return 0;

  // If fee > 100, it's likely in basis points (e.g., 1000 = 10%)
  if (feeNum > 100) {
    return feeNum / 100;
  }

  // If fee > 1 but <= 100, it's a percentage
  if (feeNum > 1) {
    return feeNum;
  }

  // If fee <= 1, it's a decimal (e.g., 0.1 = 10%)
  return feeNum * 100;
}

// Parse total assets (BigInt string to USD estimate)
// Note: This is approximate - proper conversion requires token decimals and prices
function parseTotalAssets(assets: string, decimals: number = 18): number {
  try {
    const bigAssets = BigInt(assets);
    const divisor = BigInt(10 ** decimals);
    // Return as number (loses precision for very large values)
    return Number(bigAssets / divisor);
  } catch {
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

    // Calculate total TVL (approximation)
    const totalTvl = vaults.reduce((sum, v) => {
      // Assuming 18 decimals for most assets - this is an approximation
      return sum + parseTotalAssets(v.totalAssets);
    }, 0);

    // Skip very small curators
    if (totalTvl < 10000) continue;

    // Calculate TVL-weighted average performance fee
    let weightedFee = 0;
    const vaultDetails = vaults.map(vault => {
      const tvl = parseTotalAssets(vault.totalAssets);
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
