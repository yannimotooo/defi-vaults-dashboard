'use client';

import { LiquidationTable, ProtocolLiquidationSummary } from '@/components/charts/liquidation-table';
import { LiquidationTimeline, LiquidationStats } from '@/components/charts/liquidation-timeline';
import type { LiquidationData } from '@/types';

interface LiquidationsTabProps {
  liquidationData: LiquidationData | null;
}

export function LiquidationsTab({ liquidationData }: LiquidationsTabProps) {
  return (
    <>
      {/* Liquidation Stats */}
      {liquidationData && (
        <div className="mb-8">
          <LiquidationStats
            volume24h={liquidationData.totals.volume24h}
            volume7d={liquidationData.totals.volume7d}
            count24h={liquidationData.totals.count24h}
            count7d={liquidationData.totals.count7d}
            badDebt7d={liquidationData.totals.badDebt7d}
          />
        </div>
      )}

      {/* 7-Day Liquidation Timeline */}
      <div className="bg-[#141922]/60 rounded-xl border border-[#2d3548]/60 p-6 mb-8">
        <h3 className="text-[15px] font-semibold text-slate-100 mb-4">
          7-Day Liquidation Volume
        </h3>
        {liquidationData?.dailyVolume && liquidationData.dailyVolume.length > 0 ? (
          <LiquidationTimeline
            data={liquidationData.dailyVolume}
            showByProtocol={true}
          />
        ) : (
          <div className="h-[300px] flex items-center justify-center text-slate-500">
            Loading liquidation data...
          </div>
        )}
      </div>

      {/* Two Column Layout: Recent Events + Protocol Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Liquidations (2/3 width) */}
        <div className="lg:col-span-2 bg-[#141922]/60 rounded-xl border border-[#2d3548]/60 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold text-slate-100">
              Recent Liquidations
            </h3>
            <span className="text-[12px] text-slate-500">
              24h events across all protocols
            </span>
          </div>
          {liquidationData?.recentEvents ? (
            <LiquidationTable
              events={liquidationData.recentEvents}
              maxItems={15}
              showProtocol={true}
            />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-slate-500">
              Loading events...
            </div>
          )}
        </div>

        {/* Protocol Summary (1/3 width) */}
        <div className="bg-[#141922]/60 rounded-xl border border-[#2d3548]/60 p-6">
          <h3 className="text-[15px] font-semibold text-slate-100 mb-4">
            By Protocol
          </h3>
          {liquidationData?.protocolSummaries ? (
            <ProtocolLiquidationSummary
              summaries={liquidationData.protocolSummaries}
            />
          ) : (
            <div className="h-[200px] flex items-center justify-center text-slate-500">
              Loading protocols...
            </div>
          )}
        </div>
      </div>

      {/* Data Source Note */}
      <div className="mt-8 p-4 bg-[#0f172a]/60 rounded-lg border border-slate-700/30">
        <p className="text-[11px] text-slate-500">
          <span className="text-slate-400 font-medium">Data Sources:</span> Morpho GraphQL API, Aave V3 Subgraph, Euler V2 Subgraph (Goldsky), Spark Subgraph.
          Kamino (Solana) liquidation data requires on-chain event parsing and may have limited historical depth.
          Bad debt tracking is only available for Morpho protocol.
        </p>
      </div>
    </>
  );
}
