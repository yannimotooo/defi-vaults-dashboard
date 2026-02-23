'use client';

import { formatTvl } from '@/lib/utils';
import { ProtocolIcon, ChainIcon } from '@/components/ui/protocol-icon';

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
      Morpho: 'text-blue-600',
      Aave: 'text-purple-600',
      Euler: 'text-red-600',
      Spark: 'text-orange-600',
      Kamino: 'text-teal-600',
    };
    return colors[protocol] || 'text-gray-500';
  };

  const truncateAddress = (addr: string) => {
    if (!addr) return '-';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (events.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No liquidation events in the selected timeframe
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50">
            <th className="pb-3 pt-2 px-2 font-medium text-[10px] uppercase tracking-wider">Time</th>
            {showProtocol && <th className="pb-3 pt-2 px-2 font-medium text-[10px] uppercase tracking-wider">Protocol</th>}
            <th className="pb-3 pt-2 px-2 font-medium text-[10px] uppercase tracking-wider">Market</th>
            <th className="pb-3 pt-2 px-2 font-medium text-right text-[10px] uppercase tracking-wider">Repaid</th>
            <th className="pb-3 pt-2 px-2 font-medium text-right text-[10px] uppercase tracking-wider">Bad Debt</th>
            <th className="pb-3 pt-2 px-2 font-medium hidden sm:table-cell text-[10px] uppercase tracking-wider">Liquidator</th>
          </tr>
        </thead>
        <tbody>
          {displayEvents.map((event) => (
            <tr
              key={event.id}
              className={`border-b border-gray-200 hover:bg-gray-50 transition-all ${
                event.hasSignificantBadDebt ? 'bg-red-50/50' :
                event.badDebtUsd > 0 ? 'bg-amber-50/50' : ''
              }`}
              style={{
                borderLeft: event.hasSignificantBadDebt ? '3px solid #ef4444' :
                  event.badDebtUsd > 0 ? '3px solid #f59e0b' : '3px solid transparent',
              }}
            >
              <td className="py-3 px-2 text-gray-500">
                {formatTimeAgo(event.timestamp)}
              </td>
              {showProtocol && (
                <td className="py-3 px-2">
                  <div className="flex items-center gap-1.5">
                    <ProtocolIcon name={event.protocol} size={14} className="flex-shrink-0" />
                    <span className={`font-medium ${getProtocolColor(event.protocol)}`}>
                      {event.protocol}
                    </span>
                    <ChainIcon name={event.chain} size={12} className="flex-shrink-0 opacity-60" />
                  </div>
                </td>
              )}
              <td className="py-3 px-2">
                <span className="text-gray-700">
                  {event.loanAsset}
                </span>
                <span className="text-gray-400 mx-1">/</span>
                <span className="text-gray-500">
                  {event.collateralAsset}
                </span>
              </td>
              <td className="py-3 px-2 text-right font-mono text-gray-700">
                {formatTvl(event.repaidUsd)}
              </td>
              <td className="py-3 px-2 text-right font-mono">
                {event.badDebtUsd > 0 ? (
                  <span className={event.hasSignificantBadDebt ? 'text-red-600' : 'text-amber-600'}>
                    {formatTvl(event.badDebtUsd)}
                  </span>
                ) : (
                  <span className="text-gray-400">$0</span>
                )}
              </td>
              <td className="py-3 px-2 hidden sm:table-cell">
                <a
                  href={`https://etherscan.io/address/${event.liquidator}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-indigo-600 font-mono text-xs transition-colors"
                >
                  {truncateAddress(event.liquidator)}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {events.length > maxItems && (
        <div className="text-center text-gray-500 text-sm mt-4">
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
    return colors[protocol] || 'bg-gray-500';
  };

  if (summaries.length === 0) {
    return (
      <div className="text-center text-gray-500 py-4">
        No protocol data available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {summaries.map((summary) => (
        <div
          key={summary.protocol}
          className="bg-gray-50 rounded-lg p-4 border border-gray-200"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ProtocolIcon name={summary.protocol} size={18} />
              <span className="font-medium text-gray-800">{summary.protocol}</span>
            </div>
            <div className="text-right">
              <div className="text-gray-700 font-mono">{formatTvl(summary.volume7d)}</div>
              <div className="text-xs text-gray-500">7d volume</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-500 text-xs">24h Volume</div>
              <div className="text-gray-700 font-mono">{formatTvl(summary.volume24h)}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">24h Count</div>
              <div className="text-gray-700">{summary.count24h}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">7d Bad Debt</div>
              <div className={summary.badDebt7d > 0 ? 'text-red-600 font-mono' : 'text-gray-500'}>
                {summary.badDebt7d > 0 ? formatTvl(summary.badDebt7d) : '$0'}
              </div>
            </div>
          </div>

          {summary.topMarkets.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="text-xs text-gray-500 mb-2">Top Markets</div>
              <div className="flex flex-wrap gap-2">
                {summary.topMarkets.slice(0, 3).map((market, i) => (
                  <span
                    key={i}
                    className="text-xs bg-gray-100 px-2 py-1 rounded"
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
