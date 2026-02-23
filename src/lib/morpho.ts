// Morpho GraphQL API client for fee and vault data
// API Documentation: https://docs.morpho.org/tools/offchain/api/
// Supports both Vault V1 (legacy) and Vault V2 (current)

const MORPHO_GRAPHQL_ENDPOINT = 'https://api.morpho.org/graphql';
const MORPHO_BLUE_API = 'https://blue-api.morpho.org/graphql';

export interface MorphoVault {
  address: string;
  name: string;
  symbol: string;
  asset: {
    address: string;
    symbol: string;
    decimals: number;
  };
  // Normalized fields (populated from either V1 state or V2 top-level)
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
  // V2-only fields (management fee exists on Morpho V2 vaults)
  performanceFee?: number; // Decimal (0.1 = 10%)
  managementFee?: number;  // Decimal (0.01 = 1%) — annual fee on TVL
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
// V2 schema has flat top-level fields (no `state` wrapper) and curators at top level
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
        totalAssetsUsd
        apy
        netApy
        performanceFee
        managementFee
        curators {
          items {
            name
            image
          }
        }
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

// Normalize a V2 API response item into the MorphoVault format
// V2 has flat fields; V1 nests under `state` — we normalize both to same shape
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeVault(raw: any, isV2: boolean): MorphoVault {
  if (isV2) {
    // V2: flat top-level fields, curators at top level
    return {
      address: raw.address,
      name: raw.name,
      symbol: raw.symbol,
      asset: raw.asset,
      state: {
        totalAssets: raw.totalAssets || '0',
        totalAssetsUsd: raw.totalAssetsUsd || 0,
        apy: raw.apy || 0,
        netApy: raw.netApy || 0,
        fee: raw.performanceFee || 0, // Normalize to same field name as V1
        curator: raw.curator?.address || null,
      },
      metadata: {
        curators: raw.curators?.items || [],
      },
      performanceFee: raw.performanceFee || 0,
      managementFee: raw.managementFee || 0,
    };
  }
  // V1: already in correct shape
  return raw as MorphoVault;
}

// Fetch vaults using a specific query
async function fetchVaultsWithQuery(
  query: string,
  dataPath: 'vaults' | 'vaultV2s'
): Promise<MorphoVault[]> {
  const allVaults: MorphoVault[] = [];
  const isV2 = dataPath === 'vaultV2s';
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

      const rawVaults = data.data?.[dataPath]?.items || [];
      const vaults = rawVaults.map((v: unknown) => normalizeVault(v, isV2));
      allVaults.push(...vaults);

      const totalCount = data.data?.[dataPath]?.pageInfo?.countTotal || 0;
      skip += pageSize;
      hasMore = skip < totalCount && rawVaults.length === pageSize;
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

import { CURATOR_NAME_VARIANTS as CURATOR_NAME_MAPPING } from '@/lib/curator-names';

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
    let weightedManagementFee = 0;
    let weightedGrossApy = 0;
    let weightedNetApy = 0;
    let estimatedTotalFeeRevenue = 0;

    const vaultFees = curatorVaults.map(vault => {
      const tvl = vault.state.totalAssetsUsd || 0;
      const weight = totalTvl > 0 ? tvl / totalTvl : 0;

      // Performance fee from Morpho is stored as decimal (0.1 = 10%)
      const performanceFee = (vault.state.fee || 0) * 100;
      // Management fee (V2 only) — annual fee on TVL, stored as decimal (0.01 = 1%)
      const managementFee = (vault.managementFee || 0) * 100;
      const grossApy = (vault.state.apy || 0) * 100;
      const netApy = (vault.state.netApy || 0) * 100;

      // Fee revenue: performance fee on yield + management fee on TVL
      const perfFeeRevenue = tvl * (grossApy / 100) * (performanceFee / 100);
      const mgmtFeeRevenue = tvl * (managementFee / 100);
      const estimatedFeeRevenue = perfFeeRevenue + mgmtFeeRevenue;

      weightedPerformanceFee += performanceFee * weight;
      weightedManagementFee += managementFee * weight;
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
      avgManagementFee: weightedManagementFee,
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
      let weightedManagementFee = 0;
      let weightedGrossApy = 0;
      let weightedNetApy = 0;
      let estimatedTotalFeeRevenue = 0;

      const vaultFees = vaults.map(vault => {
        const tvl = vault.state.totalAssetsUsd || 0;
        const weight = totalTvl > 0 ? tvl / totalTvl : 0;

        const performanceFee = (vault.state.fee || 0) * 100;
        const managementFee = (vault.managementFee || 0) * 100;
        const grossApy = (vault.state.apy || 0) * 100;
        const netApy = (vault.state.netApy || 0) * 100;
        // Fee revenue: performance fee on yield + management fee on TVL
        const perfFeeRevenue = tvl * (grossApy / 100) * (performanceFee / 100);
        const mgmtFeeRevenue = tvl * (managementFee / 100);
        const estimatedFeeRevenue = perfFeeRevenue + mgmtFeeRevenue;

        weightedPerformanceFee += performanceFee * weight;
        weightedManagementFee += managementFee * weight;
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
        avgManagementFee: weightedManagementFee,
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

// ============================================
// Morpho Blue API - Authoritative On-Chain TVL
// ============================================

export interface MorphoCuratorTvl {
  curatorName: string;
  totalTvl: number;
  vaultCount: number;
  avgApy: number;
  vaults: Array<{
    address: string;
    name: string;
    tvl: number;
    apy: number;
  }>;
}

// Fetch authoritative on-chain TVL data from Morpho Blue API
// This is the primary source of truth for Morpho curator TVL
export async function getMorphoCuratorsTvl(): Promise<MorphoCuratorTvl[]> {
  const query = `
    query GetCuratorsTvl {
      vaults(first: 500, orderBy: TotalAssets, orderDirection: Desc) {
        items {
          address
          name
          state {
            totalAssetsUsd
            curators { name }
            apy
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(MORPHO_BLUE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      console.error('[Morpho TVL] API error:', response.status);
      return [];
    }

    const data = await response.json();
    const vaults = data?.data?.vaults?.items || [];

    // Group vaults by curator name
    const curatorMap = new Map<string, {
      vaults: Array<{ address: string; name: string; tvl: number; apy: number }>;
      totalTvl: number;
      weightedApy: number;
    }>();

    for (const vault of vaults) {
      const curators = vault.state?.curators || [];
      const curatorName = curators[0]?.name || 'Unknown';
      const tvl = vault.state?.totalAssetsUsd || 0;
      const apy = (vault.state?.apy || 0) * 100; // Convert to percentage

      // Skip very small vaults or unknown curators
      if (curatorName === 'Unknown' || tvl < 10000) continue;

      if (!curatorMap.has(curatorName)) {
        curatorMap.set(curatorName, { vaults: [], totalTvl: 0, weightedApy: 0 });
      }

      const entry = curatorMap.get(curatorName)!;
      entry.vaults.push({
        address: vault.address,
        name: vault.name,
        tvl,
        apy,
      });
      entry.totalTvl += tvl;
      entry.weightedApy += tvl * apy; // For weighted average
    }

    // Build result array
    const result: MorphoCuratorTvl[] = [];

    for (const [curatorName, data] of curatorMap) {
      // Skip curators with very low TVL
      if (data.totalTvl < 100000) continue;

      result.push({
        curatorName,
        totalTvl: data.totalTvl,
        vaultCount: data.vaults.length,
        avgApy: data.totalTvl > 0 ? data.weightedApy / data.totalTvl : 0,
        vaults: data.vaults.sort((a, b) => b.tvl - a.tvl),
      });
    }

    // Sort by TVL
    result.sort((a, b) => b.totalTvl - a.totalTvl);

    console.log(`[Morpho TVL] Fetched ${vaults.length} vaults, aggregated to ${result.length} curators`);
    return result;
  } catch (error) {
    console.error('[Morpho TVL] Error:', error);
    return [];
  }
}

// ============================================
// Vault-to-Curator Mapping
// ============================================

export interface MorphoVaultWithCurator {
  address: string;
  name: string;
  symbol: string;
  curator: string;
  tvlUsd: number;
  apy: number;
}

// In-memory cache for vault-curator mappings
let vaultCuratorCache: { data: MorphoVaultWithCurator[]; timestamp: number } | null = null;
const VAULT_CURATOR_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Fetch all Morpho vaults with their curators
// This is used to attribute vaults to curators in the dashboard
export async function getMorphoVaultsWithCurators(): Promise<MorphoVaultWithCurator[]> {
  // Return cached data if valid
  if (vaultCuratorCache && Date.now() - vaultCuratorCache.timestamp < VAULT_CURATOR_CACHE_TTL) {
    return vaultCuratorCache.data;
  }

  const query = `
    query GetVaultCurators {
      vaults(first: 500, orderBy: TotalAssets, orderDirection: Desc) {
        items {
          address
          name
          symbol
          state {
            totalAssetsUsd
            apy
            curators { name }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(MORPHO_BLUE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      console.error('[Morpho Vaults] API error:', response.status);
      return vaultCuratorCache?.data || [];
    }

    const data = await response.json();
    const vaults = data?.data?.vaults?.items || [];

    const result: MorphoVaultWithCurator[] = [];

    for (const vault of vaults) {
      const curators = vault.state?.curators || [];
      const curatorName = curators[0]?.name || null;
      const tvl = vault.state?.totalAssetsUsd || 0;

      // Skip vaults without curators or very small TVL
      if (!curatorName || tvl < 1000) continue;

      result.push({
        address: vault.address.toLowerCase(),
        name: vault.name,
        symbol: vault.symbol,
        curator: curatorName,
        tvlUsd: tvl,
        apy: (vault.state?.apy || 0) * 100,
      });
    }

    console.log(`[Morpho Vaults] Fetched ${result.length} vaults with curators`);

    // Cache the result
    vaultCuratorCache = { data: result, timestamp: Date.now() };
    return result;
  } catch (error) {
    console.error('[Morpho Vaults] Error:', error);
    return vaultCuratorCache?.data || [];
  }
}

// Create a lookup map from vault symbol/name to curator
export async function getVaultToCuratorMap(): Promise<Map<string, string>> {
  const vaults = await getMorphoVaultsWithCurators();
  const map = new Map<string, string>();

  // Normalize function
  const normalize = (s: string) => s.toLowerCase().replace(/[\s\-_]/g, '');

  for (const vault of vaults) {
    // Map by multiple keys for better matching
    map.set(normalize(vault.symbol), vault.curator);
    map.set(normalize(vault.name), vault.curator);
    map.set(vault.address.toLowerCase(), vault.curator);
  }

  return map;
}
