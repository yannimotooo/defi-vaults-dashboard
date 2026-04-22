// Veda BoringVault Protocol Integration
// Fetches vault data from DefiLlama for Veda and Veda-powered protocols

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

// Fetch Veda vaults from DefiLlama
export async function getVedaVaults(): Promise<VedaVault[]> {
  try {
    const response = await fetch('https://yields.llama.fi/pools', {
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      throw new Error(`DefiLlama API error: ${response.status}`);
    }

    const data = await response.json();
    const allPools = data.data || [];

    // Filter for Veda and Veda-powered projects
    const vedaVaults: VedaVault[] = allPools
      .filter((pool: Record<string, unknown>) => {
        const project = (pool.project as string || '').toLowerCase();
        return VEDA_POWERED_PROJECTS.some(p => project.includes(p.toLowerCase()));
      })
      .map((pool: Record<string, unknown>) => ({
        id: pool.pool as string,
        name: `${PROJECT_DISPLAY_NAMES[pool.project as string] || pool.project} ${pool.symbol}`,
        symbol: pool.symbol as string,
        chain: pool.chain as string,
        tvlUsd: pool.tvlUsd as number || 0,
        apy: pool.apy as number || 0,
        apyBase: pool.apyBase as number || 0,
        apyReward: pool.apyReward as number | null,
        stablecoin: pool.stablecoin as boolean || false,
        exposure: pool.exposure as string || 'single',
        project: pool.project as string,
        underlyingTokens: pool.underlyingTokens as string[] || [],
      }));

    return vedaVaults;
  } catch (error) {
    console.error('Error fetching Veda vaults:', error);
    return [];
  }
}

// Get all Veda-powered vaults including ether.fi Liquid
export async function getAllVedaPoweredVaults(): Promise<VedaVault[]> {
  try {
    const response = await fetch('https://yields.llama.fi/pools', {
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`DefiLlama API error: ${response.status}`);
    }

    const data = await response.json();
    const allPools = data.data || [];

    // Include direct Veda vaults and known Veda-powered protocols
    const vedaPoweredProjects = [
      'veda',
      'ether.fi-liquid', // Uses BoringVault
      'concrete',
    ];

    const vaults: VedaVault[] = allPools
      .filter((pool: Record<string, unknown>) => {
        const project = (pool.project as string || '').toLowerCase();
        return vedaPoweredProjects.some(p => project.includes(p.toLowerCase()));
      })
      .map((pool: Record<string, unknown>) => ({
        id: pool.pool as string,
        name: `${PROJECT_DISPLAY_NAMES[pool.project as string] || pool.project} ${pool.symbol}`,
        symbol: pool.symbol as string,
        chain: pool.chain as string,
        tvlUsd: pool.tvlUsd as number || 0,
        apy: pool.apy as number || 0,
        apyBase: pool.apyBase as number || 0,
        apyReward: pool.apyReward as number | null,
        stablecoin: pool.stablecoin as boolean || false,
        exposure: pool.exposure as string || 'single',
        project: pool.project as string,
        underlyingTokens: pool.underlyingTokens as string[] || [],
      }));

    return vaults;
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
