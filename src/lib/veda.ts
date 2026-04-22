// Veda BoringVault Protocol Integration
// Fetches vault data from DefiLlama for Veda and Veda-powered protocols

import { getPoolsByProjects, type VaultPool } from './defillama';

export interface VedaVault {
  id: string;
  name: string;
  symbol: string;
  chain: string;
  tvlUsd: number;
  apy: number;
  apyBase: number;
  apyReward: number | null;
  stablecoin: boolean;
  exposure: string;
  project: string; // veda, ether.fi-liquid, lombard, etc.
  underlyingTokens: string[];
}

export interface VedaCuratorData {
  curatorName: string;
  vaults: VedaVault[];
  totalTvl: number;
  avgApy: number;
  vaultCount: number;
  chains: string[];
}

// Projects that use Veda's BoringVault infrastructure
const VEDA_POWERED_PROJECTS = [
  'veda',
  'ether.fi-liquid',
  'concrete',
  'lombard-defi', // Lombard DeFi vaults (not the base LBTC token)
  'plasma-veda',
];

// Map project names to display names
const PROJECT_DISPLAY_NAMES: Record<string, string> = {
  'veda': 'Veda',
  'ether.fi-liquid': 'ether.fi Liquid',
  'ether.fi-stake': 'ether.fi Stake',
  'concrete': 'Concrete',
  'lombard-defi': 'Lombard DeFi',
  'plasma-veda': 'Plasma',
};

function poolToVedaVault(pool: VaultPool): VedaVault {
  return {
    id: pool.pool,
    name: `${PROJECT_DISPLAY_NAMES[pool.project] || pool.project} ${pool.symbol}`,
    symbol: pool.symbol,
    chain: pool.chain,
    tvlUsd: pool.tvlUsd || 0,
    apy: pool.apy || 0,
    apyBase: pool.apyBase ?? 0,
    apyReward: pool.apyReward,
    stablecoin: pool.stablecoin || false,
    exposure: pool.exposure || 'single',
    project: pool.project,
    underlyingTokens: pool.underlyingTokens ?? [],
  };
}

// Get all Veda-powered vaults (Veda, ether.fi Liquid, Concrete, Lombard, Plasma).
// Uses the shared /pools cache in defillama.ts so this doesn't re-download the
// 16MB response each call.
export async function getAllVedaPoweredVaults(): Promise<VedaVault[]> {
  try {
    const pools = await getPoolsByProjects(VEDA_POWERED_PROJECTS);
    return pools.map(poolToVedaVault);
  } catch (error) {
    console.error('Error fetching Veda-powered vaults:', error);
    return [];
  }
}

// Aggregate Veda vaults by curator/project
export function aggregateVedaByCurator(vaults: VedaVault[]): VedaCuratorData[] {
  const curatorMap = new Map<string, VedaCuratorData>();

  for (const vault of vaults) {
    const curatorName = PROJECT_DISPLAY_NAMES[vault.project] || vault.project;

    if (!curatorMap.has(curatorName)) {
      curatorMap.set(curatorName, {
        curatorName,
        vaults: [],
        totalTvl: 0,
        avgApy: 0,
        vaultCount: 0,
        chains: [],
      });
    }

    const curator = curatorMap.get(curatorName)!;
    curator.vaults.push(vault);
    curator.totalTvl += vault.tvlUsd;

    if (!curator.chains.includes(vault.chain)) {
      curator.chains.push(vault.chain);
    }
  }

  // Calculate averages
  for (const curator of curatorMap.values()) {
    curator.vaultCount = curator.vaults.length;

    if (curator.vaultCount > 0 && curator.totalTvl > 0) {
      // TVL-weighted average APY
      let weightedApy = 0;
      for (const vault of curator.vaults) {
        const weight = vault.tvlUsd / curator.totalTvl;
        weightedApy += vault.apy * weight;
      }
      curator.avgApy = weightedApy;
    }
  }

  return Array.from(curatorMap.values()).sort((a, b) => b.totalTvl - a.totalTvl);
}

// Get Veda fee estimates
// Note: Veda fees are configured per-vault and not publicly documented
// These are estimates based on industry standards
export interface VedaFeeEstimate {
  curatorName: string;
  performanceFeePct: number;
  managementFeePct: number;
  note: string;
}

export function getVedaFeeEstimates(): VedaFeeEstimate[] {
  return [
    {
      curatorName: 'Veda',
      performanceFeePct: 10,
      managementFeePct: 0,
      note: 'Estimated based on industry standards. Actual fees vary by vault.',
    },
    {
      curatorName: 'ether.fi Liquid',
      performanceFeePct: 10,
      managementFeePct: 0,
      note: 'Estimated. ether.fi Liquid vaults use Veda infrastructure.',
    },
    {
      curatorName: 'Concrete',
      performanceFeePct: 10,
      managementFeePct: 0,
      note: 'Estimated. Concrete is built on Veda BoringVault.',
    },
  ];
}

// Get combined Veda data for the fees API
export interface VedaCuratorFeeData {
  curatorName: string;
  vaults: {
    name: string;
    symbol: string;
    chain: string;
    tvl: number;
    apy: number;
  }[];
  totalTvl: number;
  avgApy: number;
  vaultCount: number;
  performanceFeePct: number;
  managementFeePct: number;
  feeNote: string;
}

// Fetch real Concrete data from their API
async function fetchConcreteData(): Promise<VedaCuratorFeeData | null> {
  try {
    // Import Concrete module dynamically to avoid circular dependencies
    const { getConcreteData } = await import('./concrete');
    const concreteData = await getConcreteData();

    if (!concreteData) return null;

    return {
      curatorName: concreteData.curatorName,
      vaults: concreteData.vaults.map(v => ({
        name: v.name,
        symbol: v.symbol,
        chain: v.chain,
        tvl: v.tvl,
        apy: v.apy,
      })),
      totalTvl: concreteData.totalTvl,
      avgApy: concreteData.avgApy,
      vaultCount: concreteData.vaultCount,
      performanceFeePct: concreteData.performanceFeePct,
      managementFeePct: concreteData.managementFeePct,
      feeNote: concreteData.feeNote,
    };
  } catch (error) {
    console.error('Error fetching Concrete data:', error);
    return null;
  }
}

export async function getVedaCuratorFeeData(): Promise<VedaCuratorFeeData[]> {
  // Fetch both Veda vaults from yields API and Concrete from protocol API
  const [vaults, concreteData] = await Promise.all([
    getAllVedaPoweredVaults(),
    fetchConcreteData(),
  ]);

  const aggregated = aggregateVedaByCurator(vaults);
  const feeEstimates = getVedaFeeEstimates();

  const results = aggregated.map(curator => {
    const feeEstimate = feeEstimates.find(f => f.curatorName === curator.curatorName);

    return {
      curatorName: curator.curatorName,
      vaults: curator.vaults.map(v => ({
        name: v.name,
        symbol: v.symbol,
        chain: v.chain,
        tvl: v.tvlUsd,
        apy: v.apy,
      })),
      totalTvl: curator.totalTvl,
      avgApy: curator.avgApy,
      vaultCount: curator.vaultCount,
      performanceFeePct: feeEstimate?.performanceFeePct || 10,
      managementFeePct: feeEstimate?.managementFeePct || 0,
      feeNote: feeEstimate?.note || 'Fee estimates based on industry standards.',
    };
  });

  // Concrete passes the VEDA_POWERED_PROJECTS filter in getAllVedaPoweredVaults,
  // so it's already aggregated from DeFiLlama. When the direct Concrete API
  // succeeds it's authoritative, so drop the DeFiLlama-sourced entry to avoid
  // double-counting.
  if (concreteData) {
    const deduped = results.filter(r => r.curatorName !== 'Concrete');
    deduped.push(concreteData);
    return deduped.sort((a, b) => b.totalTvl - a.totalTvl);
  }

  return results.sort((a, b) => b.totalTvl - a.totalTvl);
}
