// Risk Metrics API
// Returns comprehensive risk data for curators and protocols

import { NextResponse } from 'next/server';
import { getRiskMetrics, getCuratorRiskMetrics } from '@/lib/risk';
import { getMultiProtocolLiquidations } from '@/lib/liquidations';

export const revalidate = 300; // 5 minutes

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const curator = searchParams.get('curator');

  try {
    // If specific curator requested
    if (curator) {
      const curatorRisk = await getCuratorRiskMetrics(curator);

      if (!curatorRisk) {
        return NextResponse.json(
          { error: `Curator '${curator}' not found or has no risk data` },
          { status: 404 }
        );
      }

      return NextResponse.json({
        curator: curatorRisk,
        source: 'Morpho GraphQL API',
        timestamp: new Date().toISOString(),
      });
    }

    // Get all risk metrics and multi-protocol liquidations in parallel
    const [riskData, liquidationData] = await Promise.all([
      getRiskMetrics(),
      getMultiProtocolLiquidations(168), // 7 days
    ]);

    return NextResponse.json({
      // Curator risk rankings (Morpho-specific)
      curators: riskData.curators,

      // Protocol-level summary (Morpho)
      protocolSummary: riskData.protocolSummary,

      // Multi-protocol liquidations
      multiProtocolLiquidations: {
        // Recent events across all protocols
        recentEvents: liquidationData.recentEvents,
        // Per-protocol summaries
        protocolSummaries: liquidationData.protocolSummaries,
        // Totals
        totals: liquidationData.totals,
        // Daily aggregation for timeline chart (pre-computed from ALL events)
        dailyVolume: liquidationData.dailyVolume,
      },

      // Legacy: Recent liquidation events (Morpho-only for backwards compatibility)
      recentLiquidations: riskData.recentLiquidations,

      // Markets with bad debt warnings
      marketsWithBadDebt: riskData.marketsWithBadDebt,

      // Aggregated stats (combined)
      stats: {
        totalCuratorsWithRiskData: riskData.curators.length,
        curatorsWithBadDebt: riskData.curators.filter(c => c.hasBadDebt).length,
        curatorsWithCriticalWarnings: riskData.curators.filter(c => c.criticalWarnings.length > 0).length,
        // Use multi-protocol totals
        totalLiquidationVolume24h: liquidationData.totals.volume24h,
        totalLiquidationVolume7d: liquidationData.totals.volume7d,
        totalLiquidationCount24h: liquidationData.totals.count24h,
        totalLiquidationCount7d: liquidationData.totals.count7d,
        totalBadDebt7d: liquidationData.totals.badDebt7d,
        avgRiskScore: riskData.curators.length > 0
          ? riskData.curators.reduce((sum, c) => sum + c.riskScore, 0) / riskData.curators.length
          : 0,
        protocolCoverage: liquidationData.protocolSummaries.map(p => p.protocol),
      },

      // Risk level distribution
      riskDistribution: {
        critical: riskData.curators.filter(c => c.riskLevel === 'CRITICAL').length,
        high: riskData.curators.filter(c => c.riskLevel === 'HIGH').length,
        medium: riskData.curators.filter(c => c.riskLevel === 'MEDIUM').length,
        low: riskData.curators.filter(c => c.riskLevel === 'LOW').length,
      },

      source: 'Multi-protocol: Morpho GraphQL + Aave Subgraph + Euler Subgraph + Spark Subgraph',
      note: 'Risk scores are calculated based on bad debt, utilization, warnings, and liquidation volume. Higher score = higher risk. Liquidation data aggregated across Morpho, Aave V3, Euler V2, Spark, and Kamino.',
      timestamp: riskData.timestamp,
    });
  } catch (error) {
    console.error('[Risk API] Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch risk metrics',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
