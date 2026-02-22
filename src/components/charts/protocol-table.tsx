'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatTvl, cn } from '@/lib/utils';
import type { ProtocolTVL } from '@/types';

interface ProtocolTableProps {
  data: ProtocolTVL[];
}

export function ProtocolTable({ data }: ProtocolTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Protocol Rankings</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700/35">
                <th className="px-5 py-3 text-left text-[11px] font-medium text-slate-500 uppercase tracking-wider w-12">#</th>
                <th className="px-5 py-3 text-left text-[11px] font-medium text-slate-500 uppercase tracking-wider">Protocol</th>
                <th className="px-5 py-3 text-right text-[11px] font-medium text-slate-500 uppercase tracking-wider">TVL</th>
                <th className="px-5 py-3 text-right text-[11px] font-medium text-slate-500 uppercase tracking-wider">24h</th>
                <th className="px-5 py-3 text-right text-[11px] font-medium text-slate-500 uppercase tracking-wider">7d</th>
                <th className="px-5 py-3 text-right text-[11px] font-medium text-slate-500 uppercase tracking-wider hidden md:table-cell">30d</th>
                <th className="px-5 py-3 text-left text-[11px] font-medium text-slate-500 uppercase tracking-wider">Chains</th>
              </tr>
            </thead>
            <tbody>
              {data.map((protocol, index) => (
                <tr
                  key={protocol.slug}
                  className="border-b border-slate-700/30 hover:bg-slate-700/25 transition-colors"
                >
                  <td className="px-5 py-4">
                    <span className="font-mono text-slate-500 text-[13px]">{index + 1}</span>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-[14px] text-white">{protocol.name}</p>
                    <p className="text-[11px] text-slate-600">{protocol.category}</p>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className="font-mono text-white text-[14px]">{formatTvl(protocol.tvl)}</span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className={cn(
                      'font-mono text-[14px]',
                      protocol.change24h > 0 ? 'text-emerald-400' : protocol.change24h < 0 ? 'text-red-400' : 'text-slate-500'
                    )}>
                      {protocol.change24h > 0 ? '+' : ''}{protocol.change24h.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className={cn(
                      'font-mono text-[14px]',
                      protocol.change7d > 0 ? 'text-emerald-400' : protocol.change7d < 0 ? 'text-red-400' : 'text-slate-500'
                    )}>
                      {protocol.change7d > 0 ? '+' : ''}{protocol.change7d.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right hidden md:table-cell">
                    {protocol.change30d !== undefined ? (
                      <span className={cn(
                        'font-mono text-[14px]',
                        protocol.change30d > 0 ? 'text-emerald-400' : protocol.change30d < 0 ? 'text-red-400' : 'text-slate-500'
                      )}>
                        {protocol.change30d > 0 ? '+' : ''}{protocol.change30d.toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-slate-600 text-[14px]">-</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-[12px] text-slate-400">
                      {protocol.chains.slice(0, 3).join(', ')}
                      {protocol.chains.length > 3 && ` +${protocol.chains.length - 3}`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
