// DeFiLlama API client (free tier)
// Used for TVL data and cross-referencing

const DEFILLAMA_API_BASE = 'https://api.llama.fi';
const YIELDS_API_BASE = 'https://yields.llama.fi';

export interface DefiLlamaProtocol {
  id: string;
  name: string;
  slug: string;
  tvl: number;
  chainTvls: Record<string, number>;
  change_1d: number;
  change_7d: number;
  change_1m?: number;
  category: string;
  chains: string[];
  parentProtocol?: string;
}

export interface DefiLlamaChain {
  name: string;
  tvl: number;
}

export interface DefiLlamaYield {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number;
  apyBase: number;
  apyReward: number;
}

// Vault protocols with curator model (our focus)
export const VAULT_PROTOCOL_SLUGS = [
  // EVM - Curator-based vault protocols
  'morpho',
  'morpho-blue',
  'euler',
  'euler-v2',
  'yearn-finance',
  'mellow-protocol',
  'gearbox',
  'symbiotic',

  // Solana - Vault protocols
  'kamino',
  'kamino-lend',
  'meteora',
  'drift-protocol',

  // Other vault aggregators
  'sommelier',
  'enzyme-finance',
];

// Risk curator slugs - these are the actual curator entities
export const RISK_CURATOR_SLUGS = [
  'steakhouse-financial',
  'gauntlet',
  'sentora',
  'mev-capital',
  'k3-capital',
  're7-labs',
  'block-analitica',
  'euler-dao',
  'yearn-curating',
  'vault-bridge',
  'ultrayield-by-edge',
  'hyperithm',
  'b-protocol',
  'summer-fi',
  'clearstar',
  'telos-consilium',
  '9summits',
  'alphaping',
];

// Get TVL for all protocols
export async function getAllProtocols(): Promise<DefiLlamaProtocol[]> {
  const response = await fetch(`${DEFILLAMA_API_BASE}/protocols`, {
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`DeFiLlama API error: ${response.status}`);
  }

  return response.json();
}

// Get TVL by chain
export async function getChainsTvl(): Promise<DefiLlamaChain[]> {
  const response = await fetch(`${DEFILLAMA_API_BASE}/v2/chains`, {
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`DeFiLlama API error: ${response.status}`);
  }

  return response.json();
}

// Get protocol details with historical data
export async function getProtocol(slug: string): Promise<DefiLlamaProtocol & { tvl: Array<{ date: number; totalLiquidityUSD: number }> }> {
  const response = await fetch(`${DEFILLAMA_API_BASE}/protocol/${slug}`, {
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`DeFiLlama API error: ${response.status}`);
  }

  return response.json();
}

// Historical TVL data point
export interface HistoricalTvlPoint {
  date: number; // Unix timestamp
  tvl: number;
}

// Get historical TVL for a protocol/curator
export async function getProtocolHistoricalTvl(slug: string): Promise<HistoricalTvlPoint[]> {
  try {
    const response = await fetch(`${DEFILLAMA_API_BASE}/protocol/${slug}`, {
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    // DeFiLlama returns tvl as array of {date, totalLiquidityUSD}
    if (data.tvl && Array.isArray(data.tvl)) {
      return data.tvl.map((point: { date: number; totalLiquidityUSD: number }) => ({
        date: point.date,
        tvl: point.totalLiquidityUSD,
      }));
    }

    return [];
  } catch {
    return [];
  }
}

// Get historical TVL for multiple protocols (for comparison charts)
export async function getMultipleProtocolsHistoricalTvl(
  slugs: string[]
): Promise<Record<string, HistoricalTvlPoint[]>> {
  const results: Record<string, HistoricalTvlPoint[]> = {};

  await Promise.all(
    slugs.map(async (slug) => {
      results[slug] = await getProtocolHistoricalTvl(slug);
    })
  );

  return results;
}

// Filter historical data by time period
export function filterHistoricalByPeriod(
  data: HistoricalTvlPoint[],
  period: '7d' | '30d' | '90d' | '1y' | 'all'
): HistoricalTvlPoint[] {
  if (period === 'all' || data.length === 0) return data;

  const now = Date.now() / 1000; // Current time in seconds
  const periodSeconds: Record<string, number> = {
    '7d': 7 * 24 * 60 * 60,
    '30d': 30 * 24 * 60 * 60,
    '90d': 90 * 24 * 60 * 60,
    '1y': 365 * 24 * 60 * 60,
  };

  const cutoff = now - periodSeconds[period];
  return data.filter(point => point.date >= cutoff);
}

// Get yields data
export async function getYields(): Promise<{ data: DefiLlamaYield[] }> {
  const response = await fetch(`${YIELDS_API_BASE}/pools`, {
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`DeFiLlama Yields API error: ${response.status}`);
  }

  return response.json();
}

// Filter for vault protocols
export function filterVaultProtocols(protocols: DefiLlamaProtocol[]): DefiLlamaProtocol[] {
  return protocols.filter(p =>
    VAULT_PROTOCOL_SLUGS.some(vp =>
      p.slug.toLowerCase() === vp ||
      p.slug.toLowerCase().startsWith(vp + '-') ||
      p.slug.toLowerCase().includes(vp)
    )
  );
}

// Filter for risk curators specifically
export function filterRiskCurators(protocols: DefiLlamaProtocol[]): DefiLlamaProtocol[] {
  return protocols.filter(p =>
    // Primary: Use DeFiLlama's category
    p.category === 'Risk Curators' ||
    // Fallback: Match known curator slugs
    RISK_CURATOR_SLUGS.some(rc =>
      p.slug.toLowerCase() === rc ||
      p.slug.toLowerCase().includes(rc.replace('-', ''))
    )
  );
}

// Get Solana-specific vault protocols
export function getSolanaVaultProtocols(protocols: DefiLlamaProtocol[]): DefiLlamaProtocol[] {
  const solanaVaults = ['kamino', 'meteora', 'drift'];
  return protocols.filter(p =>
    solanaVaults.some(sv => p.slug.toLowerCase().includes(sv)) ||
    (p.chains && p.chains.includes('Solana'))
  );
}

// Calculate TVL by ecosystem
export function calculateEcosystemTvl(protocols: DefiLlamaProtocol[]): { evm: number; solana: number } {
  let evmTvl = 0;
  let solanaTvl = 0;

  const evmChains = ['Ethereum', 'Base', 'Arbitrum', 'Optimism', 'Polygon', 'BSC', 'Avalanche', 'Gnosis'];

  for (const protocol of protocols) {
    if (protocol.chainTvls) {
      for (const [chain, tvl] of Object.entries(protocol.chainTvls)) {
        if (chain.includes('-') || ['staking', 'pool2', 'borrowed', 'treasury', 'vesting'].includes(chain)) {
          continue;
        }

        if (chain === 'Solana') {
          solanaTvl += tvl;
        } else if (evmChains.includes(chain)) {
          evmTvl += tvl;
        }
      }
    }
  }

  return { evm: evmTvl, solana: solanaTvl };
}

// Extract chain list from chainTvls
export function extractChains(protocol: DefiLlamaProtocol): string[] {
  if (protocol.chains && protocol.chains.length > 0) {
    return protocol.chains;
  }

  if (protocol.chainTvls) {
    return Object.keys(protocol.chainTvls).filter(chain =>
      !chain.includes('-') && !['staking', 'pool2', 'borrowed', 'treasury', 'vesting'].includes(chain)
    );
  }

  return [];
}

// Vault/Pool level data
export interface VaultPool {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number;
  apyBase: number | null;
  apyReward: number | null;
  apyPct1D: number | null;
  apyPct7D: number | null;
  apyPct30D: number | null;
  stablecoin: boolean;
  ilRisk: string;
  exposure: string;
  poolMeta: string | null;
  underlyingTokens: string[] | null;
  rewardTokens: string[] | null;
}

// Get all yield pools (vaults)
export async function getYieldPools(): Promise<VaultPool[]> {
  try {
    const response = await fetch(`${YIELDS_API_BASE}/pools`, {
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.data || [];
  } catch {
    return [];
  }
}

// Map curator names to their associated project slugs in DeFiLlama yields
const CURATOR_PROJECT_MAPPING: Record<string, string[]> = {
  'steakhouse-financial': ['morpho-steakhouse', 'steakhouse'],
  'gauntlet': ['morpho-gauntlet', 'gauntlet'],
  'sentora': ['morpho-sentora', 'sentora'],
  'mev-capital': ['morpho-mev-capital', 'mev-capital'],
  're7-labs': ['morpho-re7', 're7-labs', 're7'],
  'k3-capital': ['morpho-k3', 'k3-capital', 'k3'],
  'block-analitica': ['morpho-block-analitica', 'block-analitica'],
  'euler-dao': ['euler', 'euler-v2'],
  'b-protocol': ['b-protocol'],
  'summer-fi': ['summer.fi', 'summer-fi'],
  'ultrayield-by-edge': ['ultrayield'],
  'hyperithm': ['hyperithm'],
  'vault-bridge': ['vault-bridge'],
  'clearstar': ['clearstar'],
};

// Get vaults for a specific curator (with optional pre-fetched pools to avoid N+1 queries)
export async function getCuratorVaults(curatorSlug: string, prefetchedPools?: VaultPool[]): Promise<VaultPool[]> {
  const allPools = prefetchedPools || await getYieldPools();

  // Get the project names associated with this curator
  const projectNames = CURATOR_PROJECT_MAPPING[curatorSlug] || [curatorSlug];

  // Filter pools that match this curator's projects
  const curatorPools = allPools.filter(pool => {
    const projectLower = pool.project.toLowerCase();
    const poolLower = pool.pool.toLowerCase();
    const metaLower = (pool.poolMeta || '').toLowerCase();

    return projectNames.some(name => {
      const nameLower = name.toLowerCase();
      return projectLower.includes(nameLower) ||
             poolLower.includes(nameLower) ||
             metaLower.includes(nameLower);
    });
  });

  // Sort by TVL descending
  return curatorPools.sort((a, b) => b.tvlUsd - a.tvlUsd);
}

// Filter vaults from pre-fetched pools (for bulk operations without N+1 queries)
export function filterCuratorVaultsFromPools(curatorSlug: string, allPools: VaultPool[]): VaultPool[] {
  const projectNames = CURATOR_PROJECT_MAPPING[curatorSlug] || [curatorSlug];

  const curatorPools = allPools.filter(pool => {
    const projectLower = pool.project.toLowerCase();
    const poolLower = pool.pool.toLowerCase();
    const metaLower = (pool.poolMeta || '').toLowerCase();

    return projectNames.some(name => {
      const nameLower = name.toLowerCase();
      return projectLower.includes(nameLower) ||
             poolLower.includes(nameLower) ||
             metaLower.includes(nameLower);
    });
  });

  return curatorPools.sort((a, b) => b.tvlUsd - a.tvlUsd);
}

// Get top vaults across all curators
export async function getTopVaults(limit: number = 50): Promise<VaultPool[]> {
  const allPools = await getYieldPools();

  // Filter for curator-related projects
  const allCuratorProjects = Object.values(CURATOR_PROJECT_MAPPING).flat();

  const curatorPools = allPools.filter(pool => {
    const projectLower = pool.project.toLowerCase();
    return allCuratorProjects.some(name =>
      projectLower.includes(name.toLowerCase())
    ) || projectLower.includes('morpho') || projectLower.includes('euler');
  });

  // Sort by TVL and return top N
  return curatorPools
    .sort((a, b) => b.tvlUsd - a.tvlUsd)
    .slice(0, limit);
}
