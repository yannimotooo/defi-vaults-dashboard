// Kamino Finance API client
// Supports both REST API data and on-chain SDK reads for Earn vault fees

const KAMINO_API_BASE = 'https://api.kamino.finance';

// Known Kamino Earn vault curators and their approximate fee structures
// Source: Kamino documentation and public announcements
// These are estimates - actual fees may vary by vault
const KAMINO_CURATOR_FEES: Record<string, {
  name: string;
  performanceFee: number; // percentage
  managementFee: number;  // percentage (annual)
  source: string;
}> = {
  'steakhouse': {
    name: 'Steakhouse Financial',
    performanceFee: 10, // 10% of profits
    managementFee: 0,
    source: 'Kamino documentation - approximate',
  },
  're7': {
    name: 'RE7 Labs',
    performanceFee: 10,
    managementFee: 0,
    source: 'Kamino documentation - approximate',
  },
  'gauntlet': {
    name: 'Gauntlet',
    performanceFee: 10,
    managementFee: 0,
    source: 'Kamino documentation - approximate',
  },
};

// On-chain vault fee data types
export interface KaminoVaultOnChainFee {
  address: string;
  name: string;
  tokenMint: string;
  performanceFeePct: number;
  managementFeePct: number;
  curator: string | null;
}

export interface KaminoCuratorOnChainData {
  curatorName: string;
  vaults: KaminoVaultOnChainFee[];
  avgPerformanceFeePct: number;
  avgManagementFeePct: number;
  vaultCount: number;
}

export interface KaminoOnChainResponse {
  curators: KaminoCuratorOnChainData[];
  allVaults: KaminoVaultOnChainFee[];
  stats: {
    totalVaults: number;
    successfulFetches: number;
    curatorCount: number;
  };
  source: string;
  chain: string;
  timestamp: string;
  error?: string;
  fallback?: {
    note: string;
    curators: KaminoCuratorOnChainData[];
  };
}

export interface KaminoReserve {
  reserve: string;
  liquidityToken: string;
  liquidityTokenMint: string;
  maxLtv: number;
  borrowApy: number;
  supplyApy: number;
  totalSupply: string;
  totalBorrow: string;
  totalBorrowUsd: number;
  totalSupplyUsd: number;
}

export interface KaminoMarketMetrics {
  reserves: KaminoReserve[];
  totalSupplyUsd: number;
  totalBorrowUsd: number;
  avgSupplyApy: number;
}

export interface KaminoCuratorFeeData {
  curatorName: string;
  protocol: 'Kamino';
  chain: 'Solana';
  estimatedPerformanceFee: number;
  estimatedManagementFee: number;
  dataSource: string;
  disclaimer: string;
}

// Primary Kamino lending market on mainnet
const PRIMARY_MARKET = '7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF';

// Fetch Kamino lending market metrics
export async function getKaminoMarketMetrics(): Promise<KaminoMarketMetrics | null> {
  try {
    const response = await fetch(
      `${KAMINO_API_BASE}/kamino-market/${PRIMARY_MARKET}/reserves/metrics?env=mainnet-beta`,
      { next: { revalidate: 300 } }
    );

    if (!response.ok) {
      console.error('Kamino API error:', response.status);
      return null;
    }

    const reserves: KaminoReserve[] = await response.json();

    // Calculate totals
    const totalSupplyUsd = reserves.reduce((sum, r) => sum + r.totalSupplyUsd, 0);
    const totalBorrowUsd = reserves.reduce((sum, r) => sum + r.totalBorrowUsd, 0);

    // TVL-weighted average supply APY
    let weightedApy = 0;
    reserves.forEach(r => {
      const weight = totalSupplyUsd > 0 ? r.totalSupplyUsd / totalSupplyUsd : 0;
      weightedApy += r.supplyApy * weight;
    });

    return {
      reserves,
      totalSupplyUsd,
      totalBorrowUsd,
      avgSupplyApy: weightedApy * 100, // Convert to percentage
    };
  } catch (error) {
    console.error('Error fetching Kamino market metrics:', error);
    return null;
  }
}

// Get estimated fee data for a Kamino curator
// Note: This returns ESTIMATES based on public documentation
// Actual on-chain fees require SDK reads
export function getKaminoCuratorFeeEstimate(curatorSlug: string): KaminoCuratorFeeData | null {
  // Normalize curator slug
  const normalized = curatorSlug.toLowerCase().replace(/[\s\-]/g, '');

  // Check if we have data for this curator
  for (const [key, data] of Object.entries(KAMINO_CURATOR_FEES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return {
        curatorName: data.name,
        protocol: 'Kamino',
        chain: 'Solana',
        estimatedPerformanceFee: data.performanceFee,
        estimatedManagementFee: data.managementFee,
        dataSource: data.source,
        disclaimer: 'Kamino Earn vault fees require on-chain SDK reads. Values shown are estimates based on public documentation and may not reflect actual current fees.',
      };
    }
  }

  return null;
}

// Get all known Kamino curator fee estimates
export function getAllKaminoCuratorFeeEstimates(): KaminoCuratorFeeData[] {
  return Object.values(KAMINO_CURATOR_FEES).map(data => ({
    curatorName: data.name,
    protocol: 'Kamino' as const,
    chain: 'Solana' as const,
    estimatedPerformanceFee: data.performanceFee,
    estimatedManagementFee: data.managementFee,
    dataSource: data.source,
    disclaimer: 'Kamino Earn vault fees require on-chain SDK reads. Values shown are estimates based on public documentation and may not reflect actual current fees.',
  }));
}

// Fetch staking yields (LST APYs on Solana)
export async function getKaminoStakingYields(): Promise<Array<{ tokenMint: string; apy: number }>> {
  try {
    const response = await fetch(
      `${KAMINO_API_BASE}/v2/staking-yields?env=mainnet-beta`,
      { next: { revalidate: 300 } }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.map((item: { tokenMint: string; apy: string }) => ({
      tokenMint: item.tokenMint,
      apy: parseFloat(item.apy) * 100, // Convert to percentage
    }));
  } catch (error) {
    console.error('Error fetching Kamino staking yields:', error);
    return [];
  }
}

// Fetch actual on-chain Kamino Earn vault fee data via our API route
// This uses the @kamino-finance/klend-sdk to read real fee configurations
export async function getKaminoOnChainFeeData(): Promise<KaminoOnChainResponse | null> {
  try {
    // Call our internal API route that handles the Solana SDK calls
    const response = await fetch('/api/kamino', {
      next: { revalidate: 600 }, // Cache for 10 minutes
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Kamino API error:', response.status, errorData);

      // Return fallback data if available
      if (errorData.fallback) {
        return {
          curators: errorData.fallback.curators,
          allVaults: [],
          stats: {
            totalVaults: 0,
            successfulFetches: 0,
            curatorCount: errorData.fallback.curators.length,
          },
          source: 'Kamino estimates (on-chain fetch failed)',
          chain: 'Solana',
          timestamp: new Date().toISOString(),
          error: errorData.error,
        };
      }
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching Kamino on-chain fee data:', error);
    return null;
  }
}

// Get on-chain fee data for a specific curator
export async function getKaminoOnChainCuratorFees(
  curatorSlug: string
): Promise<KaminoCuratorOnChainData | null> {
  const data = await getKaminoOnChainFeeData();
  if (!data || !data.curators) return null;

  // Normalize for matching
  const normalized = curatorSlug.toLowerCase().replace(/[\s\-]/g, '');

  for (const curator of data.curators) {
    const curatorNormalized = curator.curatorName.toLowerCase().replace(/[\s\-]/g, '');
    if (
      curatorNormalized.includes(normalized) ||
      normalized.includes(curatorNormalized)
    ) {
      return curator;
    }
  }

  return null;
}
