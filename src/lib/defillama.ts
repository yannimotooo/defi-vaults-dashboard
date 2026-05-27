// DeFiLlama API client (free tier)
// Used for TVL data and cross-referencing

import { fetchWithTimeout } from './http';

const DEFILLAMA_API_BASE = 'https://api.llama.fi';
const YIELDS_API_BASE = 'https://yields.llama.fi';
const DEFILLAMA_TIMEOUT_MS = 12_000; // protocols/yields endpoints can be 5-10s under load
const DEFILLAMA_PROTOCOLS_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFILLAMA_PROTOCOL_DETAIL_CACHE_TTL_MS = 10 * 60 * 1000;

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

let protocolsCache: { data: DefiLlamaProtocol[]; fetchedAt: number } | null = null;
let protocolsPendingFetch: Promise<DefiLlamaProtocol[]> | null = null;

type ProtocolDetail = DefiLlamaProtocol & { tvl: Array<{ date: number; totalLiquidityUSD: number }> };
const protocolDetailCache = new Map<string, { data: ProtocolDetail; fetchedAt: number }>();
const protocolDetailPendingFetch = new Map<string, Promise<ProtocolDetail>>();

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

// Risk curator slugs — fallback list for when DeFiLlama category matching
// misses an entity. Also serves as the INCLUSION list for self-curating
// platforms that DeFiLlama categorizes as "Onchain Capital Allocator"
// instead of "Risk Curators" (Veda, Mellow).
//
// IMPORTANT: The `Onchain Capital Allocator` category was REMOVED from
// CURATOR_CATEGORIES after user feedback that vault platforms ≠ risk
// curators. OCA entities like Grove ($3.3B), Spark Liquidity Layer ($2B),
// Concrete ($1B) are protocols/allocators, not curators. They belong in a
// separate Allocators view (future feature), not mixed into the curator
// leaderboard. See the Phase 2 → revert discussion in the plan log.
//
// Veda and Mellow ARE included here because they self-curate some vaults.
// Their TVL may still include third-party-curated vaults (e.g., Sentora on
// Veda) — this is a known imprecision we accept until deeper vault-level
// curator attribution is available.
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
  'rockawayx',
  // Self-curating platforms (DeFiLlama categorizes these as OCA, not Risk Curators)
  'veda',
  'mellow-core',
];

/**
 * DeFiLlama protocol categories that represent curator-managed vaults.
 *
 * Only `Risk Curators` is included. The `Onchain Capital Allocator` category
 * was previously included (Phase 2) but removed because it conflates vault
 * platforms (Grove, Spark, Concrete) with actual risk curators (Steakhouse,
 * Gauntlet). Platforms that self-curate (Veda, Mellow) are added to
 * RISK_CURATOR_SLUGS instead, so they get included via the fallback path.
 */
export const CURATOR_CATEGORIES = ['Risk Curators'] as const;

/**
 * Minimum TVL (USD) for a protocol to surface in the curator list.
 * Filters out micro/inactive entries.
 */
export const MIN_CURATOR_TVL_USD = 10_000_000;

// Get TVL for all protocols
export async function getAllProtocols(): Promise<DefiLlamaProtocol[]> {
  const now = Date.now();
  if (protocolsCache && now - protocolsCache.fetchedAt < DEFILLAMA_PROTOCOLS_CACHE_TTL_MS) {
    return protocolsCache.data;
  }
  if (protocolsPendingFetch) {
    return protocolsPendingFetch;
  }

  protocolsPendingFetch = fetchAllProtocolsFresh();
  try {
    const data = await protocolsPendingFetch;
    protocolsCache = { data, fetchedAt: now };
    return data;
  } finally {
    protocolsPendingFetch = null;
  }
}

async function fetchAllProtocolsFresh(): Promise<DefiLlamaProtocol[]> {
  const response = await fetchWithTimeout(`${DEFILLAMA_API_BASE}/protocols`, {
    cache: 'no-store',
    timeoutMs: DEFILLAMA_TIMEOUT_MS,
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
export async function getProtocol(slug: string): Promise<ProtocolDetail> {
  const now = Date.now();
  const cached = protocolDetailCache.get(slug);
  if (cached && now - cached.fetchedAt < DEFILLAMA_PROTOCOL_DETAIL_CACHE_TTL_MS) {
    return cached.data;
  }
  const pending = protocolDetailPendingFetch.get(slug);
  if (pending) {
    return pending;
  }

  const fetchPromise = fetchProtocolFresh(slug);
  protocolDetailPendingFetch.set(slug, fetchPromise);
  try {
    const data = await fetchPromise;
    protocolDetailCache.set(slug, { data, fetchedAt: now });
    return data;
  } finally {
    protocolDetailPendingFetch.delete(slug);
  }
}

async function fetchProtocolFresh(slug: string): Promise<ProtocolDetail> {
  const response = await fetchWithTimeout(`${DEFILLAMA_API_BASE}/protocol/${slug}`, {
    cache: 'no-store',
    timeoutMs: DEFILLAMA_TIMEOUT_MS,
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

// Get historical TVL for a protocol/curator.
// Returns [] on any failure but always logs the underlying cause so callers
// can distinguish "API down" from "no data for this slug" via server logs.
export async function getProtocolHistoricalTvl(slug: string): Promise<HistoricalTvlPoint[]> {
  try {
    const data = await getProtocol(slug);

    // DeFiLlama returns tvl as array of {date, totalLiquidityUSD}
    if (data.tvl && Array.isArray(data.tvl)) {
      return data.tvl.map((point: { date: number; totalLiquidityUSD: number }) => ({
        date: point.date,
        tvl: point.totalLiquidityUSD,
      }));
    }

    return [];
  } catch (error) {
    console.warn(
      `[DeFiLlama] historical TVL fetch failed for slug=${slug}:`,
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

// Calculate 30d change from historical TVL data
export function calculate30dChange(historicalTvl: HistoricalTvlPoint[]): number | undefined {
  if (!historicalTvl || historicalTvl.length < 2) return undefined;

  const now = Date.now() / 1000;
  const day30Ago = now - (30 * 24 * 3600);

  // Get current TVL (most recent point)
  const current = historicalTvl[historicalTvl.length - 1];
  if (!current || current.tvl <= 0) return undefined;

  // Find point closest to 30 days ago
  const closest = historicalTvl.reduce((prev, curr) => {
    return Math.abs(curr.date - day30Ago) < Math.abs(prev.date - day30Ago) ? curr : prev;
  });

  if (!closest || closest.tvl <= 0) return undefined;

  // Calculate percentage change
  return ((current.tvl - closest.tvl) / closest.tvl) * 100;
}

// Get 30d change for a protocol (fetches historical data and calculates)
export async function getProtocol30dChange(slug: string): Promise<number | undefined> {
  const historicalTvl = await getProtocolHistoricalTvl(slug);
  return calculate30dChange(historicalTvl);
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

/**
 * Filter all DeFiLlama protocols down to curator-managed vault entities.
 *
 * Inclusion rules (any one matches):
 *   1. category in CURATOR_CATEGORIES (Risk Curators OR Onchain Capital Allocator)
 *   2. slug in RISK_CURATOR_SLUGS fallback list
 *
 * Then applies MIN_CURATOR_TVL_USD floor to drop micro entries (mostly inactive).
 *
 * Pre-Phase-2 this only matched `Risk Curators`, missing ~$9B of TVL across the
 * Onchain Capital Allocator category (Veda, Mellow, Grove, Spark Liquidity
 * Layer, Concrete, Aera, Lagoon, Upshift, ether.fi-liquid, etc.).
 */
export function filterRiskCurators(protocols: DefiLlamaProtocol[]): DefiLlamaProtocol[] {
  const categorySet = new Set<string>(CURATOR_CATEGORIES);
  return protocols.filter(p => {
    const matchesCategory = categorySet.has(p.category);
    const matchesSlug = RISK_CURATOR_SLUGS.some(rc =>
      p.slug.toLowerCase() === rc ||
      p.slug.toLowerCase().includes(rc.replace('-', ''))
    );
    if (!matchesCategory && !matchesSlug) return false;
    // TVL floor — keeps the long tail of micro/inactive OCA entries out
    return (p.tvl ?? 0) >= MIN_CURATOR_TVL_USD;
  });
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

// In-process cache for /pools. The endpoint returns ~16MB, which exceeds
// Next.js data cache's 2MB ceiling — without this, every cold request
// re-downloads the full payload. We also dedup concurrent callers via the
// pending promise so one request doesn't trigger N parallel upstream fetches.
const POOLS_CACHE_TTL_MS = 5 * 60 * 1000;
let poolsCache: { data: VaultPool[]; fetchedAt: number } | null = null;
let poolsPendingFetch: Promise<VaultPool[]> | null = null;

// Get all yield pools (vaults). Cached in-process for POOLS_CACHE_TTL_MS.
// Serves stale data on transient upstream failure if a prior cache entry exists.
export async function getYieldPools(): Promise<VaultPool[]> {
  const now = Date.now();
  if (poolsCache && now - poolsCache.fetchedAt < POOLS_CACHE_TTL_MS) {
    return poolsCache.data;
  }
  if (poolsPendingFetch) {
    return poolsPendingFetch;
  }
  poolsPendingFetch = fetchYieldPoolsFresh();
  try {
    const data = await poolsPendingFetch;
    poolsCache = { data, fetchedAt: now };
    return data;
  } finally {
    poolsPendingFetch = null;
  }
}

async function fetchYieldPoolsFresh(): Promise<VaultPool[]> {
  try {
    // cache: 'no-store' so Next.js doesn't attempt to cache 16MB and log
    // a failure every request. The in-process cache above handles reuse.
    const response = await fetchWithTimeout(`${YIELDS_API_BASE}/pools`, {
      cache: 'no-store',
      timeoutMs: DEFILLAMA_TIMEOUT_MS,
    });

    if (!response.ok) {
      console.warn(`[DeFiLlama] yields/pools HTTP ${response.status}`);
      return poolsCache?.data ?? [];
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.warn(
      `[DeFiLlama] yields/pools fetch failed:`,
      error instanceof Error ? error.message : error,
    );
    return poolsCache?.data ?? [];
  }
}

// Helper: pools filtered to matching projects (case-insensitive substring).
// Uses the shared pools cache so callers don't re-download 16MB per fetch.
export async function getPoolsByProjects(projects: string[]): Promise<VaultPool[]> {
  const needles = projects.map(p => p.toLowerCase());
  const all = await getYieldPools();
  return all.filter(pool => {
    const project = (pool.project || '').toLowerCase();
    return needles.some(p => project.includes(p));
  });
}

// Curator configuration: defines what to search for in DeFiLlama pools
// For Morpho curators: we match symbol prefixes since DeFiLlama encodes curator in symbol
interface CuratorConfig {
  symbolPrefixes: string[];        // Symbol prefixes to match (e.g., "GT" for Gauntlet)
  symbolContains?: string[];       // Alternative: symbol contains these strings
  requiredProjects?: string[];     // If set, pool.project must match one of these
  directProjects?: string[];       // If set, pool.project directly matches (non-Morpho curators)
}

// Morpho projects in DeFiLlama
const MORPHO_PROJECTS = ['morpho', 'morpho-blue', 'morpho-v1'];

const CURATOR_CONFIG: Record<string, CuratorConfig> = {
  // Morpho curators - match by symbol prefix on morpho projects
  'steakhouse-financial': {
    symbolPrefixes: ['STEAK'],
    requiredProjects: MORPHO_PROJECTS
  },
  'gauntlet': {
    symbolPrefixes: ['GT'],
    requiredProjects: MORPHO_PROJECTS
  },
  'sentora': {
    symbolPrefixes: ['SM', 'SEN'],
    symbolContains: ['SENTORA'],
    requiredProjects: MORPHO_PROJECTS
  },
  'mev-capital': {
    // Note: Do NOT use symbolContains: ['MEV'] - it matches false positives like PRIMEV2
    symbolPrefixes: ['MC-', 'MC', 'MMEV', 'MEV', 'MEVF'],
    requiredProjects: MORPHO_PROJECTS
  },
  're7-labs': {
    symbolPrefixes: ['RE7'],
    requiredProjects: MORPHO_PROJECTS
  },
  'k3-capital': {
    symbolPrefixes: ['K3', 'KHYPE'],
    requiredProjects: MORPHO_PROJECTS
  },
  'block-analitica': {
    symbolPrefixes: ['BBQ', 'BB'],
    requiredProjects: MORPHO_PROJECTS
  },
  'b-protocol': {
    symbolPrefixes: ['BP'],
    symbolContains: ['BPROTOCOL'],
    requiredProjects: MORPHO_PROJECTS
  },
  'summer-fi': {
    symbolPrefixes: ['SPARK', 'SU'],
    symbolContains: ['SUMMER'],
    requiredProjects: MORPHO_PROJECTS
  },
  'ultrayield-by-edge': {
    symbolPrefixes: ['EDGE', 'UY'],
    symbolContains: ['ULTRAYIELD'],
    requiredProjects: MORPHO_PROJECTS
  },
  'hyperithm': {
    symbolPrefixes: ['HYPER', 'HB', 'HY'],
    requiredProjects: MORPHO_PROJECTS
  },
  'vault-bridge': {
    symbolPrefixes: ['VB'],
    requiredProjects: MORPHO_PROJECTS
  },
  'clearstar': {
    symbolPrefixes: ['CS'],
    requiredProjects: MORPHO_PROJECTS
  },
  'kpk': {
    symbolPrefixes: ['KPK-', 'KPK'],
    requiredProjects: MORPHO_PROJECTS
  },
  // Non-Morpho curators - match directly by project
  'euler-dao': {
    symbolPrefixes: [],
    directProjects: ['euler', 'euler-v2']
  },
};

// Get vaults for a specific curator (with optional pre-fetched pools to avoid N+1 queries)
export async function getCuratorVaults(curatorSlug: string, prefetchedPools?: VaultPool[]): Promise<VaultPool[]> {
  const allPools = prefetchedPools || await getYieldPools();
  const config = CURATOR_CONFIG[curatorSlug];

  if (!config) {
    // Fallback: no config found, return empty
    console.log(`[getCuratorVaults] No config for curator: ${curatorSlug}`);
    return [];
  }

  // Filter pools based on curator config
  const curatorPools = allPools.filter(pool => {
    const projectLower = pool.project.toLowerCase();
    const symbolUpper = pool.symbol.toUpperCase();

    // Direct project match (for non-Morpho curators like Euler)
    if (config.directProjects && config.directProjects.length > 0) {
      return config.directProjects.some(proj => projectLower.includes(proj.toLowerCase()));
    }

    // Morpho curators: must be on a Morpho protocol AND match symbol pattern
    if (config.requiredProjects && config.requiredProjects.length > 0) {
      const isRequiredProject = config.requiredProjects.some(proj =>
        projectLower.includes(proj.toLowerCase())
      );
      if (!isRequiredProject) return false;

      // Check symbol prefix match
      const prefixMatch = config.symbolPrefixes.some(prefix => {
        const matches = symbolUpper.startsWith(prefix.toUpperCase());
        return matches;
      });
      if (prefixMatch) return true;

      // Check symbol contains match (fallback)
      if (config.symbolContains && config.symbolContains.length > 0) {
        const containsMatch = config.symbolContains.some(term =>
          symbolUpper.includes(term.toUpperCase())
        );
        if (containsMatch) return true;
      }

      return false;
    }

    return false;
  });

  console.log(`[getCuratorVaults] Found ${curatorPools.length} vaults for ${curatorSlug}`);

  // Sort by TVL descending
  return curatorPools.sort((a, b) => b.tvlUsd - a.tvlUsd);
}

// Filter vaults from pre-fetched pools (for bulk operations without N+1 queries)
// Uses same logic as getCuratorVaults but synchronously with pre-fetched data
export function filterCuratorVaultsFromPools(curatorSlug: string, allPools: VaultPool[]): VaultPool[] {
  const config = CURATOR_CONFIG[curatorSlug];

  if (!config) {
    return [];
  }

  const curatorPools = allPools.filter(pool => {
    const projectLower = pool.project.toLowerCase();
    const symbolUpper = pool.symbol.toUpperCase();

    // Direct project match (for non-Morpho curators like Euler)
    if (config.directProjects && config.directProjects.length > 0) {
      return config.directProjects.some(proj => projectLower.includes(proj.toLowerCase()));
    }

    // Morpho curators: must be on a Morpho protocol AND match symbol pattern
    if (config.requiredProjects && config.requiredProjects.length > 0) {
      const isRequiredProject = config.requiredProjects.some(proj =>
        projectLower.includes(proj.toLowerCase())
      );
      if (!isRequiredProject) return false;

      // Check symbol prefix match
      const prefixMatch = config.symbolPrefixes.some(prefix =>
        symbolUpper.startsWith(prefix.toUpperCase())
      );
      if (prefixMatch) return true;

      // Check symbol contains match (fallback)
      if (config.symbolContains && config.symbolContains.length > 0) {
        const containsMatch = config.symbolContains.some(term =>
          symbolUpper.includes(term.toUpperCase())
        );
        if (containsMatch) return true;
      }

      return false;
    }

    return false;
  });

  return curatorPools.sort((a, b) => b.tvlUsd - a.tvlUsd);
}

// Get top vaults across all curators
export async function getTopVaults(limit: number = 50): Promise<VaultPool[]> {
  const allPools = await getYieldPools();

  // Filter for vault protocol pools (Morpho, Euler, etc.)
  const curatorPools = allPools.filter(pool => {
    const projectLower = pool.project.toLowerCase();
    return projectLower.includes('morpho') ||
           projectLower.includes('euler') ||
           projectLower.includes('yearn') ||
           projectLower.includes('gearbox') ||
           projectLower.includes('sommelier');
  });

  // Sort by TVL and return top N
  return curatorPools
    .sort((a, b) => b.tvlUsd - a.tvlUsd)
    .slice(0, limit);
}
