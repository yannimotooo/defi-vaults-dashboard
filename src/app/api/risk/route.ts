// Risk Metrics API
// Returns comprehensive risk data for curators and protocols

import { NextResponse } from 'next/server';
import { getRiskMetrics, getCuratorRiskMetrics } from '@/lib/risk';

export const dynamic = 'force-dynamic';

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

    // Get all risk metrics
    const riskData = await getRiskMetrics();

    return NextResponse.json({
      // Curator risk rankings
      curators: riskData.curators,

      // Protocol-level summary
      protocolSummary: riskData.protocolSummary,

      // Recent liquidation events
      recentLiquidations: riskData.recentLiquidations,

      // Markets with bad debt warnings
      marketsWithBadDebt: riskData.marketsWithBadDebt,

      // Aggregated stats
      stats: {
        totalCuratorsWithRiskData: riskData.curators.length,
        curatorsWithBadDebt: riskData.curators.filter(c => c.hasBadDebt).length,
        curatorsWithCriticalWarnings: riskData.curators.filter(c => c.criticalWarnings.length > 0).length,
        totalLiquidationVolume24h: riskData.curators.reduce((sum, c) => sum + c.totalLiquidationVolume24h, 0),
        totalLiquidationVolume7d: riskData.curators.reduce((sum, c) => sum + c.totalLiquidationVolume7d, 0),
        avgRiskScore: riskData.curators.length > 0
          ? riskData.curators.reduce((sum, c) => sum + c.riskScore, 0) / riskData.curators.length
          : 0,
      },

      // Risk level distribution
      riskDistribution: {
        critical: riskData.curators.filter(c => c.riskLevel === 'CRITICAL').length,
        high: riskData.curators.filter(c => c.riskLevel === 'HIGH').length,
        medium: riskData.curators.filter(c => c.riskLevel === 'MEDIUM').length,
        low: riskData.curators.filter(c => c.riskLevel === 'LOW').length,
      },

      source: 'Morpho GraphQL API',
      note: 'Risk scores are calculated based on bad debt, utilization, warnings, and liquidation volume. Higher score = higher risk.',
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
