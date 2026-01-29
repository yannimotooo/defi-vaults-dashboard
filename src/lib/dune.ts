// Dune API client
// All calls happen server-side to keep API key secure

const DUNE_API_BASE = 'https://api.dune.com/api/v1';

// Known Dune query IDs for vault/curator data
export const DUNE_QUERIES = {
  // Morpho Volume per Curator - calculates total supply in USD by curator
  MORPHO_CURATOR_VOLUME: 4806508,
  // All vaults TVL data (Euler, Morpho, Mellow, etc.)
  ALL_VAULTS_TVL: 5175774,
};

interface DuneQueryResult {
  execution_id: string;
  state: string;
  result?: {
    rows: Record<string, unknown>[];
    metadata: {
      column_names: string[];
      column_types: string[];
      row_count: number;
    };
  };
}

export interface DuneCuratorData {
  curator: string;
  totalSupplyUsd: number;
  vaultCount: number;
  chains: string[];
}

export interface DuneVaultData {
  protocol: string;
  chain: string;
  tvl: number;
  curator?: string;
}

export async function executeDuneQuery(queryId: number): Promise<DuneQueryResult> {
  const apiKey = process.env.DUNE_API_KEY;

  if (!apiKey) {
    throw new Error('DUNE_API_KEY is not configured');
  }

  // Execute the query
  const executeResponse = await fetch(`${DUNE_API_BASE}/query/${queryId}/execute`, {
    method: 'POST',
    headers: {
      'X-Dune-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
  });

  if (!executeResponse.ok) {
    throw new Error(`Dune API error: ${executeResponse.status}`);
  }

  const { execution_id } = await executeResponse.json();

  // Poll for results
  let result: DuneQueryResult;
  let attempts = 0;
  const maxAttempts = 30;

  while (attempts < maxAttempts) {
    const statusResponse = await fetch(`${DUNE_API_BASE}/execution/${execution_id}/results`, {
      headers: {
        'X-Dune-API-Key': apiKey,
      },
    });

    result = await statusResponse.json();

    if (result.state === 'QUERY_STATE_COMPLETED') {
      return result;
    }

    if (result.state === 'QUERY_STATE_FAILED') {
      throw new Error('Dune query failed');
    }

    // Wait 2 seconds before polling again
    await new Promise(resolve => setTimeout(resolve, 2000));
    attempts++;
  }

  throw new Error('Dune query timed out');
}

export async function getLatestDuneResults(queryId: number): Promise<DuneQueryResult> {
  const apiKey = process.env.DUNE_API_KEY;

  if (!apiKey) {
    throw new Error('DUNE_API_KEY is not configured');
  }

  const response = await fetch(`${DUNE_API_BASE}/query/${queryId}/results`, {
    headers: {
      'X-Dune-API-Key': apiKey,
    },
    next: { revalidate: 300 }, // Cache for 5 minutes
  });

  if (!response.ok) {
    throw new Error(`Dune API error: ${response.status}`);
  }

  return response.json();
}

// Fetch Morpho curator data from Dune
export async function getMorphoCuratorData(): Promise<DuneCuratorData[]> {
  try {
    const result = await getLatestDuneResults(DUNE_QUERIES.MORPHO_CURATOR_VOLUME);

    if (!result.result?.rows) {
      return [];
    }

    return result.result.rows.map((row: Record<string, unknown>) => ({
      curator: String(row.curator || row.curator_name || ''),
      totalSupplyUsd: Number(row.total_supply_usd || row.tvl || 0),
      vaultCount: Number(row.vault_count || row.vaults || 0),
      chains: Array.isArray(row.chains) ? row.chains : [String(row.chain || 'Ethereum')],
    }));
  } catch (error) {
    console.error('Failed to fetch Morpho curator data from Dune:', error);
    return [];
  }
}

// Fetch all vaults TVL data from Dune
export async function getAllVaultsTvl(): Promise<DuneVaultData[]> {
  try {
    const result = await getLatestDuneResults(DUNE_QUERIES.ALL_VAULTS_TVL);

    if (!result.result?.rows) {
      return [];
    }

    return result.result.rows.map((row: Record<string, unknown>) => ({
      protocol: String(row.protocol || row.project || ''),
      chain: String(row.chain || row.blockchain || 'Ethereum'),
      tvl: Number(row.tvl || row.total_value_locked || 0),
      curator: row.curator ? String(row.curator) : undefined,
    }));
  } catch (error) {
    console.error('Failed to fetch vaults TVL from Dune:', error);
    return [];
  }
}

// Cross-reference DeFiLlama data with Dune data
export interface CrossReferencedCurator {
  name: string;
  slug: string;
  defillamaTvl: number;
  duneTvl: number | null;
  tvlDifference: number | null; // percentage difference
  confidence: 'high' | 'medium' | 'low';
  dataSource: 'defillama' | 'dune' | 'both';
}

export function crossReferenceCuratorData(
  defillamaData: { name: string; slug: string; tvl: number }[],
  duneData: DuneCuratorData[]
): CrossReferencedCurator[] {
  const duneMap = new Map<string, DuneCuratorData>();

  // Create normalized lookup map for Dune data
  for (const curator of duneData) {
    const normalizedName = normalizeCuratorName(curator.curator);
    duneMap.set(normalizedName, curator);
  }

  return defillamaData.map((dlCurator) => {
    const normalizedName = normalizeCuratorName(dlCurator.name);
    const duneCurator = duneMap.get(normalizedName);

    if (duneCurator) {
      const difference = ((dlCurator.tvl - duneCurator.totalSupplyUsd) / dlCurator.tvl) * 100;
      const absDiff = Math.abs(difference);

      return {
        name: dlCurator.name,
        slug: dlCurator.slug,
        defillamaTvl: dlCurator.tvl,
        duneTvl: duneCurator.totalSupplyUsd,
        tvlDifference: difference,
        confidence: absDiff < 5 ? 'high' : absDiff < 15 ? 'medium' : 'low',
        dataSource: 'both' as const,
      };
    }

    return {
      name: dlCurator.name,
      slug: dlCurator.slug,
      defillamaTvl: dlCurator.tvl,
      duneTvl: null,
      tvlDifference: null,
      confidence: 'medium' as const,
      dataSource: 'defillama' as const,
    };
  });
}

// Normalize curator names for matching across data sources
function normalizeCuratorName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace('labs', '')
    .replace('capital', '')
    .replace('financial', '')
    .replace('protocol', '');
}
