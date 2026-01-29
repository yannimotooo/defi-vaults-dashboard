// Morpho GraphQL API client for fee and vault data
// API Documentation: https://docs.morpho.org/tools/offchain/api/
// Supports both Vault V1 (legacy) and Vault V2 (current)

const MORPHO_GRAPHQL_ENDPOINT = 'https://api.morpho.org/graphql';

export interface MorphoVault {
  address: string;
  name: string;
  symbol: string;
  asset: {
    address: string;
    symbol: string;
    decimals: number;
  };
  state: {
    totalAssets: string;
    totalAssetsUsd: number;
    apy: number;
    netApy: number;
    fee: number; // Performance fee as decimal (0.1 = 10%)
    curator: string | null;
  };
  metadata: {
    curators?: Array<{
      name: string;
      image: string | null;
    }>;
  };
}

export interface MorphoCurator {
  address: string;
  name: string;
  image: string | null;
}

export interface CuratorFeeData {
  curatorName: string;
  vaultCount: number;
  totalTvl: number;
  avgPerformanceFee: number; // Percentage (e.g., 10 for 10%)
  avgManagementFee: number;  // Percentage (annual)
  avgGrossApy: number;       // Before fees
  avgNetApy: number;         // After fees
  estimatedAnnualFeeRevenue: number;
  vaultFees: Array<{
    vaultName: string;
    vaultSymbol: string;
    tvl: number;
    performanceFee: number;
    grossApy: number;
    netApy: number;
    estimatedFeeRevenue: number;
  }>;
}

// GraphQL query for Vault V2 (current) - preferred
const VAULTS_V2_QUERY = `
  query VaultsV2($first: Int!, $skip: Int!) {
    vaultV2s(
      first: $first
      skip: $skip
      orderBy: TotalAssetsUsd
      orderDirection: Desc
      where: { totalAssetsUsd_gte: 100000 }
    ) {
      items {
        address
        name
        symbol
        asset {
          address
          symbol
          decimals
        }
        state {
          totalAssets
          totalAssetsUsd
          apy
          netApy
          fee
        }
        metadata {
          curators {
            name
            image
          }
        }
        performanceFee
        curator {
          address
        }
      }
      pageInfo {
        countTotal
        count
      }
    }
  }
`;

// GraphQL query for Vault V1 (legacy) - for backwards compatibility
const VAULTS_V1_QUERY = `
  query VaultsV1($first: Int!, $skip: Int!) {
    vaults(
      first: $first
      skip: $skip
      orderBy: TotalAssetsUsd
      orderDirection: Desc
      where: { totalAssetsUsd_gte: 100000 }
    ) {
      items {
        address
        name
        symbol
        asset {
          address
          symbol
          decimals
        }
        state {
          totalAssets
          totalAssetsUsd
          apy
          netApy
          fee
          curator
        }
        metadata {
          curators {
            name
            image
          }
        }
      }
      pageInfo {
        countTotal
        count
      }
    }
  }
`;

// Fetch vaults using a specific query
async function fetchVaultsWithQuery(
  query: string,
  dataPath: 'vaults' | 'vaultV2s'
): Promise<MorphoVault[]> {
  const allVaults: MorphoVault[] = [];
  let skip = 0;
  const pageSize = 100;
  let hasMore = true;

  while (hasMore) {
    try {
      const response = await fetch(MORPHO_GRAPHQL_ENDPOINT, {
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

      if (!response.ok) {
        console.error(`Morpho API error (${dataPath}):`, response.status);
        break;
      }

      const data = await response.json();

      if (data.errors) {
        console.error(`Morpho GraphQL errors (${dataPath}):`, data.errors);
        break;
      }

      const vaults = data.data?.[dataPath]?.items || [];
      allVaults.push(...vaults);

      const totalCount = data.data?.[dataPath]?.pageInfo?.countTotal || 0;
      skip += pageSize;
      hasMore = skip < totalCount && vaults.length === pageSize;
    } catch (error) {
      console.error(`Error in fetchVaultsWithQuery (${dataPath}):`, error);
      break;
    }
  }

  return allVaults;
}

// Fetch all Morpho vaults with fee data (V1 + V2)
export async function getMorphoVaultsWithFees(): Promise<MorphoVault[]> {
  try {
    // Fetch V2 vaults first (preferred), then V1 as fallback
    const [v2Vaults, v1Vaults] = await Promise.all([
      fetchVaultsWithQuery(VAULTS_V2_QUERY, 'vaultV2s').catch(() => []),
      fetchVaultsWithQuery(VAULTS_V1_QUERY, 'vaults').catch(() => []),
    ]);

    // Combine and deduplicate by address
    const vaultMap = new Map<string, MorphoVault>();

    // Add V1 vaults first
    for (const vault of v1Vaults) {
      vaultMap.set(vault.address.toLowerCase(), vault);
    }

    // V2 vaults override V1 (preferred source)
    for (const vault of v2Vaults) {
      vaultMap.set(vault.address.toLowerCase(), vault);
    }

    const allVaults = Array.from(vaultMap.values());
    console.log(`Morpho: Fetched ${v2Vaults.length} V2 vaults, ${v1Vaults.length} V1 vaults, ${allVaults.length} unique total`);

    return allVaults;
  } catch (error) {
    console.error('Error fetching Morpho vaults:', error);
    return [];
  }
}

// Map curator slugs to Morpho curator names
const CURATOR_NAME_MAPPING: Record<string, string[]> = {
  'steakhouse-financial': ['Steakhouse Financial', 'Steakhouse'],
  'gauntlet': ['Gauntlet'],
  'sentora': ['Sentora'],
  'mev-capital': ['MEV Capital'],
  're7-labs': ['RE7 Labs', 'Re7 Labs', 'RE7'],
  'k3-capital': ['K3 Capital', 'K3'],
  'block-analitica': ['Block Analitica', 'BA Labs'],
  'b-protocol': ['B.Protocol'],
  'summer-fi': ['Summer.fi'],
  'ultrayield-by-edge': ['UltraYield', 'Edge'],
  'hyperithm': ['Hyperithm'],
};

// Get fee data for a specific curator
export async function getCuratorFeeData(curatorSlug: string): Promise<CuratorFeeData | null> {
  try {
    const allVaults = await getMorphoVaultsWithFees();

    // Find vaults managed by this curator
    const curatorNames = CURATOR_NAME_MAPPING[curatorSlug] || [curatorSlug];

    const curatorVaults = allVaults.filter(vault => {
      // Check curator in metadata
      if (vault.metadata?.curators) {
        return vault.metadata.curators.some(c =>
          curatorNames.some(name =>
            c.name.toLowerCase().includes(name.toLowerCase())
          )
        );
      }

      // Check curator address field (some vaults have curator address in state)
      if (vault.state.curator) {
        // Check if vault name contains curator name
        return curatorNames.some(name =>
          vault.name.toLowerCase().includes(name.toLowerCase())
        );
      }

      return false;
    });

    if (curatorVaults.length === 0) {
      return null;
    }

    // Calculate aggregated metrics
    const totalTvl = curatorVaults.reduce((sum, v) => sum + (v.state.totalAssetsUsd || 0), 0);

    // TVL-weighted average fees and APYs
    let weightedPerformanceFee = 0;
    let weightedGrossApy = 0;
    let weightedNetApy = 0;
    let estimatedTotalFeeRevenue = 0;

    const vaultFees = curatorVaults.map(vault => {
      const tvl = vault.state.totalAssetsUsd || 0;
      const weight = totalTvl > 0 ? tvl / totalTvl : 0;

      // Performance fee from Morpho is stored as decimal (0.1 = 10%)
      const performanceFee = (vault.state.fee || 0) * 100;
      const grossApy = (vault.state.apy || 0) * 100;
      const netApy = (vault.state.netApy || 0) * 100;

      // Estimated annual fee revenue = TVL * gross APY * performance fee %
      const estimatedFeeRevenue = tvl * (grossApy / 100) * (performanceFee / 100);

      weightedPerformanceFee += performanceFee * weight;
      weightedGrossApy += grossApy * weight;
      weightedNetApy += netApy * weight;
      estimatedTotalFeeRevenue += estimatedFeeRevenue;

      return {
        vaultName: vault.name,
        vaultSymbol: vault.symbol,
        tvl,
        performanceFee,
        grossApy,
        netApy,
        estimatedFeeRevenue,
      };
    });

    // Sort by TVL
    vaultFees.sort((a, b) => b.tvl - a.tvl);

    // Get display name for curator
    const displayName = curatorNames[0] || curatorSlug;

    return {
      curatorName: displayName,
      vaultCount: curatorVaults.length,
      totalTvl,
      avgPerformanceFee: weightedPerformanceFee,
      avgManagementFee: 0, // Morpho doesn't have separate management fees
      avgGrossApy: weightedGrossApy,
      avgNetApy: weightedNetApy,
      estimatedAnnualFeeRevenue: estimatedTotalFeeRevenue,
      vaultFees,
    };
  } catch (error) {
    console.error('Error getting curator fee data:', error);
    return null;
  }
}

// Get fee overview for all curators
export async function getAllCuratorsFeeData(): Promise<CuratorFeeData[]> {
  try {
    const allVaults = await getMorphoVaultsWithFees();

    // Group vaults by curator
    const curatorVaultsMap = new Map<string, MorphoVault[]>();

    for (const vault of allVaults) {
      let curatorName = 'Unknown';

      if (vault.metadata?.curators && vault.metadata.curators.length > 0) {
        curatorName = vault.metadata.curators[0].name;
      } else if (vault.name) {
        // Try to extract curator from vault name
        const nameMatch = vault.name.match(/^([A-Za-z0-9]+)/);
        if (nameMatch) {
          curatorName = nameMatch[1];
        }
      }

      if (!curatorVaultsMap.has(curatorName)) {
        curatorVaultsMap.set(curatorName, []);
      }
      curatorVaultsMap.get(curatorName)!.push(vault);
    }

    // Calculate metrics for each curator
    const curatorFeeData: CuratorFeeData[] = [];

    for (const [curatorName, vaults] of curatorVaultsMap) {
      if (vaults.length === 0) continue;

      const totalTvl = vaults.reduce((sum, v) => sum + (v.state.totalAssetsUsd || 0), 0);
      if (totalTvl < 1000000) continue; // Skip small curators

      let weightedPerformanceFee = 0;
      let weightedGrossApy = 0;
      let weightedNetApy = 0;
      let estimatedTotalFeeRevenue = 0;

      const vaultFees = vaults.map(vault => {
        const tvl = vault.state.totalAssetsUsd || 0;
        const weight = totalTvl > 0 ? tvl / totalTvl : 0;

        const performanceFee = (vault.state.fee || 0) * 100;
        const grossApy = (vault.state.apy || 0) * 100;
        const netApy = (vault.state.netApy || 0) * 100;
        const estimatedFeeRevenue = tvl * (grossApy / 100) * (performanceFee / 100);

        weightedPerformanceFee += performanceFee * weight;
        weightedGrossApy += grossApy * weight;
        weightedNetApy += netApy * weight;
        estimatedTotalFeeRevenue += estimatedFeeRevenue;

        return {
          vaultName: vault.name,
          vaultSymbol: vault.symbol,
          tvl,
          performanceFee,
          grossApy,
          netApy,
          estimatedFeeRevenue,
        };
      });

      vaultFees.sort((a, b) => b.tvl - a.tvl);

      curatorFeeData.push({
        curatorName,
        vaultCount: vaults.length,
        totalTvl,
        avgPerformanceFee: weightedPerformanceFee,
        avgManagementFee: 0,
        avgGrossApy: weightedGrossApy,
        avgNetApy: weightedNetApy,
        estimatedAnnualFeeRevenue: estimatedTotalFeeRevenue,
        vaultFees,
      });
    }

    // Sort by TVL
    curatorFeeData.sort((a, b) => b.totalTvl - a.totalTvl);

    return curatorFeeData;
  } catch (error) {
    console.error('Error getting all curators fee data:', error);
    return [];
  }
}
