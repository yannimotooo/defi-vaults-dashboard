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
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-gray-500 font-medium mb-1">Protocols</p>
            <CardTitle>Protocol Rankings</CardTitle>
          </div>
          <span className="text-[12px] text-gray-400 font-mono">{data.length} protocols</span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-5 py-3 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider w-12">#</th>
                <th className="px-5 py-3 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">Protocol</th>
                <th className="px-5 py-3 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wider">TVL</th>
                <th className="px-5 py-3 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wider">24h</th>
                <th className="px-5 py-3 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wider">7d</th>
                <th className="px-5 py-3 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">30d</th>
                <th className="px-5 py-3 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">Chains</th>
              </tr>
            </thead>
            <tbody>
              {data.map((protocol, index) => (
                <tr
                  key={protocol.slug}
                  className={cn(
                    'border-b border-gray-200 hover:bg-gray-50 transition-all',
                    index % 2 === 1 && 'bg-gray-50/70'
                  )}
                >
                  <td className="px-5 py-4">
                    <span className="font-mono text-gray-500 text-[13px]">{index + 1}</span>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-[14px] text-gray-900">{protocol.name}</p>
                    <p className="text-[11px] text-gray-400">{protocol.category}</p>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className="font-mono text-gray-900 text-[14px]">{formatTvl(protocol.tvl)}</span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className={cn(
                      'font-mono text-[14px]',
                      protocol.change24h > 0 ? 'text-emerald-600' : protocol.change24h < 0 ? 'text-red-600' : 'text-gray-500'
                    )}>
                      {protocol.change24h > 0 ? '+' : ''}{protocol.change24h.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className={cn(
                      'font-mono text-[14px]',
                      protocol.change7d > 0 ? 'text-emerald-600' : protocol.change7d < 0 ? 'text-red-600' : 'text-gray-500'
                    )}>
                      {protocol.change7d > 0 ? '+' : ''}{protocol.change7d.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right hidden md:table-cell">
                    {protocol.change30d !== undefined ? (
                      <span className={cn(
                        'font-mono text-[14px]',
                        protocol.change30d > 0 ? 'text-emerald-600' : protocol.change30d < 0 ? 'text-red-600' : 'text-gray-500'
                      )}>
                        {protocol.change30d > 0 ? '+' : ''}{protocol.change30d.toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-gray-400 text-[14px]">-</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-[12px] text-gray-500">
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
