'use client';

import { formatTvl } from '@/lib/utils';

interface LiquidationEvent {
  id: string;
  hash: string;
  timestamp: number;
  protocol: string;
  chain: string;
  loanAsset: string;
  collateralAsset: string;
  repaidUsd: number;
  seizedUsd: number;
  badDebtUsd: number;
  liquidator: string;
  borrower?: string;
  hasSignificantBadDebt: boolean;
}

interface LiquidationTableProps {
  events: LiquidationEvent[];
  maxItems?: number;
  showProtocol?: boolean;
}

export function LiquidationTable({
  events,
  maxItems = 20,
  showProtocol = true,
}: LiquidationTableProps) {
  const displayEvents = events.slice(0, maxItems);

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor(Date.now() / 1000 - timestamp);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getProtocolColor = (protocol: string) => {
    const colors: Record<string, string> = {
      Morpho: 'text-blue-400',
      Aave: 'text-purple-400',
      Euler: 'text-red-400',
      Spark: 'text-orange-400',
      Kamino: 'text-teal-400',
    };
    return colors[protocol] || 'text-slate-400';
  };

  const truncateAddress = (addr: string) => {
    if (!addr) return '-';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (events.length === 0) {
    return (
      <div className="text-center text-slate-500 py-8">
        No liquidation events in the selected timeframe
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500 border-b border-slate-700/40">
            <th className="pb-3 font-medium">Time</th>
            {showProtocol && <th className="pb-3 font-medium">Protocol</th>}
            <th className="pb-3 font-medium">Market</th>
            <th className="pb-3 font-medium text-right">Repaid</th>
            <th className="pb-3 font-medium text-right">Bad Debt</th>
            <th className="pb-3 font-medium hidden sm:table-cell">Liquidator</th>
          </tr>
        </thead>
        <tbody>
          {displayEvents.map((event) => (
            <tr
              key={event.id}
              className="border-b border-slate-700/40 hover:bg-[#111827]/60 transition-colors"
            >
              <td className="py-3 text-slate-400">
                {formatTimeAgo(event.timestamp)}
              </td>
              {showProtocol && (
                <td className="py-3">
                  <span className={`font-medium ${getProtocolColor(event.protocol)}`}>
                    {event.protocol}
                  </span>
                  <span className="text-slate-600 text-xs ml-1">
                    {event.chain}
                  </span>
                </td>
              )}
              <td className="py-3">
                <span className="text-slate-300">
                  {event.loanAsset}
                </span>
                <span className="text-slate-600 mx-1">/</span>
                <span className="text-slate-400">
                  {event.collateralAsset}
                </span>
              </td>
              <td className="py-3 text-right font-mono text-slate-300">
                {formatTvl(event.repaidUsd)}
              </td>
              <td className="py-3 text-right font-mono">
                {event.badDebtUsd > 0 ? (
                  <span className={event.hasSignificantBadDebt ? 'text-red-400' : 'text-yellow-500'}>
                    {formatTvl(event.badDebtUsd)}
                  </span>
                ) : (
                  <span className="text-slate-600">$0</span>
                )}
              </td>
              <td className="py-3 hidden sm:table-cell">
                <a
                  href={`https://etherscan.io/address/${event.liquidator}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-500 hover:text-slate-300 font-mono text-xs"
                >
                  {truncateAddress(event.liquidator)}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {events.length > maxItems && (
        <div className="text-center text-slate-500 text-sm mt-4">
          Showing {maxItems} of {events.length} liquidations
        </div>
      )}
    </div>
  );
}

// Protocol summary table
interface ProtocolSummary {
  protocol: string;
  volume24h: number;
  volume7d: number;
  count24h: number;
  count7d: number;
  badDebt24h: number;
  badDebt7d: number;
  topMarkets: Array<{
    loanAsset: string;
    collateralAsset: string;
    volume7d: number;
  }>;
}

interface ProtocolLiquidationSummaryProps {
  summaries: ProtocolSummary[];
}

export function ProtocolLiquidationSummary({ summaries }: ProtocolLiquidationSummaryProps) {
  const getProtocolColor = (protocol: string) => {
    const colors: Record<string, string> = {
      Morpho: 'bg-blue-500',
      Aave: 'bg-purple-500',
      Euler: 'bg-red-500',
      Spark: 'bg-orange-500',
      Kamino: 'bg-teal-500',
    };
    return colors[protocol] || 'bg-slate-500';
  };

  if (summaries.length === 0) {
    return (
      <div className="text-center text-slate-500 py-4">
        No protocol data available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {summaries.map((summary) => (
        <div
          key={summary.protocol}
          className="bg-[#111827]/60 rounded-lg p-4 border border-slate-700/40"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${getProtocolColor(summary.protocol)}`} />
              <span className="font-medium text-slate-200">{summary.protocol}</span>
            </div>
            <div className="text-right">
              <div className="text-slate-300 font-mono">{formatTvl(summary.volume7d)}</div>
              <div className="text-xs text-slate-500">7d volume</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-slate-500 text-xs">24h Volume</div>
              <div className="text-slate-300 font-mono">{formatTvl(summary.volume24h)}</div>
            </div>
            <div>
              <div className="text-slate-500 text-xs">24h Count</div>
              <div className="text-slate-300">{summary.count24h}</div>
            </div>
            <div>
              <div className="text-slate-500 text-xs">7d Bad Debt</div>
              <div className={summary.badDebt7d > 0 ? 'text-red-400 font-mono' : 'text-slate-500'}>
                {summary.badDebt7d > 0 ? formatTvl(summary.badDebt7d) : '$0'}
              </div>
            </div>
          </div>

          {summary.topMarkets.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-700/40">
              <div className="text-xs text-slate-500 mb-2">Top Markets</div>
              <div className="flex flex-wrap gap-2">
                {summary.topMarkets.slice(0, 3).map((market, i) => (
                  <span
                    key={i}
                    className="text-xs bg-slate-800/60 px-2 py-1 rounded"
                  >
                    {market.loanAsset}/{market.collateralAsset}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
