// Dune API client
// All calls happen server-side to keep API key secure

const DUNE_API_BASE = 'https://api.dune.com/api/v1';

// Known Dune query IDs for vault/curator data
export const DUNE_QUERIES = {
  // Morpho Volume per Curator - calculates total supply in USD by curator
  MORPHO_CURATOR_VOLUME: 4806508,
  // All vaults TVL data (Euler, Morpho, Mellow, etc.)
  ALL_VAULTS_TVL: 5175774,
  // Morpho liquidations - daily sum of seized USD on Ethereum only
  MORPHO_LIQUIDATIONS_ETH: 4678263,
  // Morpho Liquidation Events - multi-chain (Ethereum, Base, etc.)
  MORPHO_LIQUIDATIONS_ALL: 4216704,
  // Morpho Blue Liquidation History - comprehensive with repaid_usd
  MORPHO_LIQUIDATION_HISTORY: 3431820,
  // Aave V3 Liquidation Aggregated - multi-chain with USD amounts
  AAVE_LIQUIDATIONS: 585720,
  // Kamino liquidation volume - Solana lending protocol
  KAMINO_LIQUIDATIONS: 5255801,
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

// ============================================
// Liquidation Data from Dune
// ============================================

export interface DuneLiquidationData {
  date: string;
  seizedUsd: number;
  protocol: string;
  chain: string;
}

export interface DuneLiquidationSummary {
  totalVolume7d: number;
  totalVolume24h: number;
  dailyData: DuneLiquidationData[];
}

// Helper to calculate liquidation totals from daily data
function calculateLiquidationTotals(
  dailyData: DuneLiquidationData[]
): { totalVolume7d: number; totalVolume24h: number } {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  let totalVolume24h = 0;
  let totalVolume7d = 0;

  for (const day of dailyData) {
    const dayDate = new Date(day.date);
    if (dayDate >= sevenDaysAgo) {
      totalVolume7d += day.seizedUsd;
    }
    if (dayDate >= oneDayAgo) {
      totalVolume24h += day.seizedUsd;
    }
  }

  return { totalVolume7d, totalVolume24h };
}

// Fetch Morpho liquidation data from Dune (official dashboard query)
// Tries multiple queries to get the most comprehensive data
export async function getMorphoLiquidationsFromDune(): Promise<DuneLiquidationSummary> {
  try {
    // Try multiple queries in parallel and use the one with highest volume
    const [historyResult, allResult, ethResult] = await Promise.all([
      getLatestDuneResults(DUNE_QUERIES.MORPHO_LIQUIDATION_HISTORY).catch(() => null),
      getLatestDuneResults(DUNE_QUERIES.MORPHO_LIQUIDATIONS_ALL).catch(() => null),
      getLatestDuneResults(DUNE_QUERIES.MORPHO_LIQUIDATIONS_ETH).catch(() => null),
    ]);

    // Log what we got from each query
    console.log('[Dune] Morpho query results:');
    if (historyResult?.result?.rows) {
      console.log(`  - History (3431820): ${historyResult.result.rows.length} rows`);
      if (historyResult.result.rows[0]) {
        console.log(`    Sample row keys: ${Object.keys(historyResult.result.rows[0]).join(', ')}`);
      }
    }
    if (allResult?.result?.rows) {
      console.log(`  - All (4216704): ${allResult.result.rows.length} rows`);
      if (allResult.result.rows[0]) {
        console.log(`    Sample row keys: ${Object.keys(allResult.result.rows[0]).join(', ')}`);
      }
    }
    if (ethResult?.result?.rows) {
      console.log(`  - ETH (4678263): ${ethResult.result.rows.length} rows`);
      if (ethResult.result.rows[0]) {
        console.log(`    Sample row keys: ${Object.keys(ethResult.result.rows[0]).join(', ')}`);
      }
    }

    // Process each result and find the highest volume
    const results: Array<{ source: string; summary: DuneLiquidationSummary }> = [];

    for (const [name, result] of [
      ['history', historyResult],
      ['all', allResult],
      ['eth', ethResult],
    ] as const) {
      if (!result?.result?.rows || result.result.rows.length === 0) continue;

      const rows = result.result.rows;

      // Parse - try multiple column name patterns
      // Log available columns on first row to catch schema changes
      if (rows.length > 0) {
        const availableCols = Object.keys(rows[0]);
        const usdCols = availableCols.filter(c => c.includes('usd') || c.includes('amount') || c.includes('value'));
        if (usdCols.length === 0) {
          console.warn(`[Dune] No USD column found in ${name} result. Available columns: ${availableCols.join(', ')}`);
        }
      }
      const dailyData: DuneLiquidationData[] = rows.map((row: Record<string, unknown>) => {
        // Try to extract USD amount from various possible column names
        const amount = Number(
          row.repaid_usd ||
          row.seized_usd ||
          row.liquidation_usd ||
          row.amount_usd ||
          row.sum_seized_usd ||
          row.seized_assets_usd ||
          row.repaid_assets_usd ||
          row.total_usd ||
          row.usd_value ||
          row.value_usd ||
          0
        );

        return {
          date: String(row.day || row.date || row.block_date || row.evt_block_time || row.block_time || ''),
          seizedUsd: amount,
          protocol: 'Morpho',
          chain: String(row.chain || row.blockchain || row.network || 'Ethereum'),
        };
      });

      const { totalVolume7d, totalVolume24h } = calculateLiquidationTotals(dailyData);
      results.push({
        source: name,
        summary: { totalVolume7d, totalVolume24h, dailyData: dailyData.slice(0, 30) },
      });
      console.log(`[Dune] Morpho ${name}: 7d=$${(totalVolume7d / 1e6).toFixed(2)}M, 24h=$${(totalVolume24h / 1e6).toFixed(2)}M`);
    }

    // Use the result with highest 7d volume
    if (results.length === 0) {
      console.log('[Dune] No Morpho liquidation data from any query');
      return { totalVolume7d: 0, totalVolume24h: 0, dailyData: [] };
    }

    const best = results.reduce((a, b) => a.summary.totalVolume7d > b.summary.totalVolume7d ? a : b);
    console.log(`[Dune] Using Morpho ${best.source}: $${(best.summary.totalVolume7d / 1e6).toFixed(2)}M`);

    return best.summary;
  } catch (error) {
    console.error('[Dune] Failed to fetch Morpho liquidations:', error);
    return { totalVolume7d: 0, totalVolume24h: 0, dailyData: [] };
  }
}

// Fetch Aave V3 liquidation data from Dune
export async function getAaveLiquidationsFromDune(): Promise<DuneLiquidationSummary> {
  try {
    const result = await getLatestDuneResults(DUNE_QUERIES.AAVE_LIQUIDATIONS);

    if (!result?.result?.rows || result.result.rows.length === 0) {
      console.log('[Dune] No Aave liquidation data returned');
      return { totalVolume7d: 0, totalVolume24h: 0, dailyData: [] };
    }

    const rows = result.result.rows;
    console.log(`[Dune] Fetched ${rows.length} Aave liquidation data points`);

    // Parse daily data - Aave query typically has date/day, amount_usd fields
    const dailyData: DuneLiquidationData[] = rows.map((row: Record<string, unknown>) => ({
      date: String(row.day || row.date || row.block_date || row.evt_block_time || ''),
      seizedUsd: Number(
        row.amount_usd ||
        row.liquidation_usd ||
        row.collateral_amount_usd ||
        row.debt_to_cover_usd ||
        row.total_usd ||
        0
      ),
      protocol: 'Aave',
      chain: String(row.chain || row.blockchain || row.network || 'Ethereum'),
    }));

    const { totalVolume7d, totalVolume24h } = calculateLiquidationTotals(dailyData);
    console.log(`[Dune] Aave liquidations - 24h: $${(totalVolume24h / 1e6).toFixed(2)}M, 7d: $${(totalVolume7d / 1e6).toFixed(2)}M`);

    return {
      totalVolume7d,
      totalVolume24h,
      dailyData: dailyData.slice(0, 30),
    };
  } catch (error) {
    console.error('[Dune] Failed to fetch Aave liquidations:', error);
    return { totalVolume7d: 0, totalVolume24h: 0, dailyData: [] };
  }
}

// Fetch Kamino liquidation data from Dune (Solana)
export async function getKaminoLiquidationsFromDune(): Promise<DuneLiquidationSummary> {
  try {
    const result = await getLatestDuneResults(DUNE_QUERIES.KAMINO_LIQUIDATIONS);

    if (!result?.result?.rows || result.result.rows.length === 0) {
      console.log('[Dune] No Kamino liquidation data returned');
      return { totalVolume7d: 0, totalVolume24h: 0, dailyData: [] };
    }

    const rows = result.result.rows;
    console.log(`[Dune] Fetched ${rows.length} Kamino liquidation data points`);

    // Parse daily data - Kamino query may have various column names
    const dailyData: DuneLiquidationData[] = rows.map((row: Record<string, unknown>) => ({
      date: String(row.day || row.date || row.block_date || row.block_time || ''),
      seizedUsd: Number(
        row.liquidation_usd ||
        row.amount_usd ||
        row.collateral_usd ||
        row.total_liquidated_usd ||
        row.value_usd ||
        0
      ),
      protocol: 'Kamino',
      chain: 'Solana',
    }));

    const { totalVolume7d, totalVolume24h } = calculateLiquidationTotals(dailyData);
    console.log(`[Dune] Kamino liquidations - 24h: $${(totalVolume24h / 1e6).toFixed(2)}M, 7d: $${(totalVolume7d / 1e6).toFixed(2)}M`);

    return {
      totalVolume7d,
      totalVolume24h,
      dailyData: dailyData.slice(0, 30),
    };
  } catch (error) {
    console.error('[Dune] Failed to fetch Kamino liquidations:', error);
    return { totalVolume7d: 0, totalVolume24h: 0, dailyData: [] };
  }
}
