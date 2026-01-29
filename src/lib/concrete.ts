// Concrete Protocol Integration
// Fetches real vault data from Concrete's public API

export interface ConcreteVault {
  address: string;
  name: string;
  symbol: string;
  chainId: number;
  chain: string;
  tvl: number;
  apy: number;
  version: number;
}

export interface ConcreteFeeData {
  curatorName: string;
  vaults: {
    name: string;
    symbol: string;
    chain: string;
    tvl: number;
    apy: number;
    address: string;
  }[];
  totalTvl: number;
  avgApy: number;
  vaultCount: number;
  performanceFeePct: number;
  managementFeePct: number;
  feeNote: string;
}

// Chain ID to name mapping
const CHAIN_ID_TO_NAME: Record<number, string> = {
  1: 'Ethereum',
  42161: 'Arbitrum',
  80094: 'Berachain',
  988: 'Stable',
  7001: 'Katana',
};

// Concrete API endpoint (discovered from DefiLlama adapter)
const CONCRETE_API_URL = 'https://apy.api.concrete.xyz/v1/vault:tvl/all';

interface ConcreteApiVault {
  address: string;
  chain_id: number;
  symbol: string;
  name: string;
  version: number;
  implementation: number;
  tvl: string;
  timestamp: string;
  peak_tvl: string;
  peak_apy: string;
}

interface ConcreteApiResponse {
  [chainId: string]: {
    [address: string]: ConcreteApiVault;
  };
}

export async function fetchConcreteVaults(): Promise<ConcreteVault[]> {
  try {
    const response = await fetch(CONCRETE_API_URL, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'DeFiVaultDashboard/1.0',
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      throw new Error(`Concrete API error: ${response.status}`);
    }

    const data: ConcreteApiResponse = await response.json();

    const vaults: ConcreteVault[] = [];

    // Iterate through chains and vaults
    for (const [, chainVaults] of Object.entries(data)) {
      for (const [, vault] of Object.entries(chainVaults)) {
        const tvl = parseFloat(vault.tvl) || 0;

        // Skip vaults with zero or very low TVL
        if (tvl < 1000) continue;

        const apy = parseFloat(vault.peak_apy) || 0;

        vaults.push({
          address: vault.address,
          name: vault.name,
          symbol: vault.symbol,
          chainId: vault.chain_id,
          chain: CHAIN_ID_TO_NAME[vault.chain_id] || `Chain ${vault.chain_id}`,
          tvl,
          apy: apy * 100, // Convert to percentage
          version: vault.version,
        });
      }
    }

    // Sort by TVL descending
    return vaults.sort((a, b) => b.tvl - a.tvl);
  } catch (error) {
    console.error('Error fetching Concrete vaults:', error);
    return [];
  }
}

export async function getConcreteData(): Promise<ConcreteFeeData | null> {
  try {
    const vaults = await fetchConcreteVaults();

    if (vaults.length === 0) return null;

    const totalTvl = vaults.reduce((sum, v) => sum + v.tvl, 0);

    // Calculate TVL-weighted average APY
    let weightedApy = 0;
    for (const vault of vaults) {
      if (totalTvl > 0) {
        const weight = vault.tvl / totalTvl;
        weightedApy += vault.apy * weight;
      }
    }

    return {
      curatorName: 'Concrete',
      vaults: vaults.map(v => ({
        name: v.name,
        symbol: v.symbol,
        chain: v.chain,
        tvl: v.tvl,
        apy: v.apy,
        address: v.address,
      })),
      totalTvl,
      avgApy: weightedApy,
      vaultCount: vaults.length,
      // Concrete fee structure - based on their documentation
      // Performance fee varies by vault, typically 10-20%
      performanceFeePct: 10,
      managementFeePct: 0,
      feeNote: 'Fees vary by vault strategy. Data from Concrete API.',
    };
  } catch (error) {
    console.error('Error getting Concrete data:', error);
    return null;
  }
}

// Get vault statistics by chain
export function aggregateByChain(vaults: ConcreteVault[]): Map<string, {
  chain: string;
  vaultCount: number;
  totalTvl: number;
  avgApy: number;
}> {
  const chainMap = new Map<string, {
    chain: string;
    vaultCount: number;
    totalTvl: number;
    avgApy: number;
    vaults: ConcreteVault[];
  }>();

  for (const vault of vaults) {
    if (!chainMap.has(vault.chain)) {
      chainMap.set(vault.chain, {
        chain: vault.chain,
        vaultCount: 0,
        totalTvl: 0,
        avgApy: 0,
        vaults: [],
      });
    }

    const entry = chainMap.get(vault.chain)!;
    entry.vaultCount++;
    entry.totalTvl += vault.tvl;
    entry.vaults.push(vault);
  }

  // Calculate weighted APY per chain
  for (const entry of chainMap.values()) {
    if (entry.totalTvl > 0) {
      let weightedApy = 0;
      for (const vault of entry.vaults) {
        weightedApy += vault.apy * (vault.tvl / entry.totalTvl);
      }
      entry.avgApy = weightedApy;
    }
  }

  return chainMap;
}
