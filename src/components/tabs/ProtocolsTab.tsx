'use client';

import { useMemo } from 'react';
import { StatCard } from '@/components/ui/stat-card';
import { TvlByProtocolChart } from '@/components/charts/tvl-by-protocol';
import { ProtocolTable } from '@/components/charts/protocol-table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatFlow, cn } from '@/lib/utils';
import { getProtocolColor } from '@/lib/colors';
import type { MarketOverview, Curator } from '@/types';

interface ProtocolsTabProps {
  overviewData: MarketOverview;
  curators?: Curator[];
}

export function ProtocolsTab({ overviewData, curators = [] }: ProtocolsTabProps) {
  // Protocol flow bars: absolute flow = tvl * (change7d / 100)
  const protocolFlows = useMemo(() => {
    return overviewData.tvlByProtocol
      .map(p => ({
        name: p.name,
        flow7d: p.tvl * (p.change7d / 100),
        tvl: p.tvl,
        change7d: p.change7d,
      }))
      .filter(p => Math.abs(p.flow7d) > 1000)
      .sort((a, b) => b.flow7d - a.flow7d);
  }, [overviewData]);

  // Growth leaders: top 3 gainers/losers by change7d and change30d
  const growthLeaders = useMemo(() => {
    const sorted7d = [...overviewData.tvlByProtocol].sort((a, b) => b.change7d - a.change7d);
    const sorted30d = [...overviewData.tvlByProtocol]
      .filter(p => p.change30d !== undefined)
      .sort((a, b) => (b.change30d || 0) - (a.change30d || 0));

    return {
      gainers7d: sorted7d.slice(0, 3),
      losers7d: sorted7d.slice(-3).reverse(),
      gainers30d: sorted30d.slice(0, 3),
      losers30d: sorted30d.slice(-3).reverse(),
    };
  }, [overviewData]);

  // Curator count per protocol
  const protocolCurators = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const c of curators) {
      for (const p of c.protocols) {
        if (!map.has(p)) map.set(p, []);
        map.get(p)!.push(c.name);
      }
    }
    return map;
  }, [curators]);

  return (
    <>
      {/* Protocol Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-gray-200/50 rounded-xl overflow-hidden mb-8 border border-gray-200">
        <div className="bg-white">
          <StatCard
            title="Total Protocol TVL"
            value={overviewData.totalTvl}
            change={overviewData.totalTvlChange24h}
            subtitle="24h"
            accent="blue"
          />
        </div>
        <div className="bg-white">
          <StatCard
            title="Protocols Tracked"
            value={overviewData.tvlByProtocol.length}
            format="number"
            accent="amber"
          />
        </div>
        <div className="bg-white">
          <StatCard
            title="Chains Covered"
            value={overviewData.tvlByChain.length}
            format="number"
            accent="cyan"
          />
        </div>
        <div className="bg-white">
          <StatCard
            title="7d Change"
            value={overviewData.totalTvlChange7d}
            format="percent"
            accent="emerald"
          />
        </div>
      </div>

      {/* Protocol Flow Bars + Growth Leaders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Protocol Flow Bars */}
        {protocolFlows.length > 0 && (
          <Card>
            <CardHeader>
              <p className="text-[11px] uppercase tracking-widest text-gray-500 font-medium mb-1">Capital Movement</p>
              <CardTitle>Protocol Flows (7d)</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="space-y-2.5">
                {protocolFlows.slice(0, 8).map(p => {
                  const maxAbs = Math.max(...protocolFlows.slice(0, 8).map(f => Math.abs(f.flow7d)));
                  const barWidth = maxAbs > 0 ? (Math.abs(p.flow7d) / maxAbs) * 100 : 0;
                  const isPositive = p.flow7d >= 0;

                  return (
                    <div key={p.name} className="flex items-center gap-3">
                      <span className="text-[12px] text-gray-600 w-[80px] truncate">{p.name}</span>
                      <div className="flex-1 flex items-center">
                        {isPositive ? (
                          <div className="flex-1 flex">
                            <div
                              className="h-4 rounded-r"
                              style={{
                                width: `${barWidth}%`,
                                backgroundColor: getProtocolColor(p.name),
                                opacity: 0.7,
                              }}
                            />
                          </div>
                        ) : (
                          <div className="flex-1 flex justify-end">
                            <div
                              className="h-4 rounded-l bg-red-400"
                              style={{ width: `${barWidth}%`, opacity: 0.7 }}
                            />
                          </div>
                        )}
                      </div>
                      <span className={cn(
                        'text-[11px] font-mono w-[70px] text-right',
                        isPositive ? 'text-emerald-600' : 'text-red-600'
                      )}>
                        {formatFlow(p.flow7d)}
                      </span>
                    </div>
                  );
                })}
              </div>
              {curators.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-200">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Curators per Protocol</p>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(protocolCurators.entries())
                      .sort((a, b) => b[1].length - a[1].length)
                      .slice(0, 6)
                      .map(([protocol, names]) => (
                        <span key={protocol} className="text-[11px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                          {protocol}: <span className="font-mono text-gray-700">{names.length}</span>
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Growth Leaders */}
        <Card>
          <CardHeader>
            <p className="text-[11px] uppercase tracking-widest text-gray-500 font-medium mb-1">Performance</p>
            <CardTitle>Growth Leaders</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-2 gap-4">
              {/* 7d Gainers */}
              <div>
                <p className="text-[10px] text-emerald-600 uppercase tracking-wider mb-2 font-medium">Top Gainers (7d)</p>
                <div className="space-y-2">
                  {growthLeaders.gainers7d.map(p => (
                    <div key={p.name} className="flex items-center justify-between">
                      <span className="text-[12px] text-gray-600 truncate max-w-[80px]">{p.name}</span>
                      <span className="font-mono text-[11px] text-emerald-600">
                        +{p.change7d.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {/* 7d Losers */}
              <div>
                <p className="text-[10px] text-red-600 uppercase tracking-wider mb-2 font-medium">Top Losers (7d)</p>
                <div className="space-y-2">
                  {growthLeaders.losers7d.map(p => (
                    <div key={p.name} className="flex items-center justify-between">
                      <span className="text-[12px] text-gray-600 truncate max-w-[80px]">{p.name}</span>
                      <span className="font-mono text-[11px] text-red-600">
                        {p.change7d.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {/* 30d Gainers */}
              {growthLeaders.gainers30d.length > 0 && (
                <div>
                  <p className="text-[10px] text-emerald-600 uppercase tracking-wider mb-2 font-medium">Top Gainers (30d)</p>
                  <div className="space-y-2">
                    {growthLeaders.gainers30d.map(p => (
                      <div key={p.name} className="flex items-center justify-between">
                        <span className="text-[12px] text-gray-600 truncate max-w-[80px]">{p.name}</span>
                        <span className="font-mono text-[11px] text-emerald-600">
                          +{(p.change30d || 0).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* 30d Losers */}
              {growthLeaders.losers30d.length > 0 && (
                <div>
                  <p className="text-[10px] text-red-600 uppercase tracking-wider mb-2 font-medium">Top Losers (30d)</p>
                  <div className="space-y-2">
                    {growthLeaders.losers30d.map(p => (
                      <div key={p.name} className="flex items-center justify-between">
                        <span className="text-[12px] text-gray-600 truncate max-w-[80px]">{p.name}</span>
                        <span className="font-mono text-[11px] text-red-600">
                          {(p.change30d || 0).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Protocol Chart */}
      <div className="mb-8">
        <TvlByProtocolChart data={overviewData.tvlByProtocol} />
      </div>

      {/* Protocol Table */}
      <ProtocolTable data={overviewData.tvlByProtocol} />
    </>
  );
}
