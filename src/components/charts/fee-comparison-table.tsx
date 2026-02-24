'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatTvl, cn } from '@/lib/utils';
import { EmptyStateCard } from '@/components/ui/empty-state-card';
import type { Curator } from '@/types';

interface FeeComparisonTableProps {
  curators: Curator[];
}

type SortKey = 'name' | 'perfFee' | 'mgmtFee' | 'grossApy' | 'netApy' | 'feeBurden' | 'revenue';
type SortDir = 'asc' | 'desc';

interface FeeRow {
  name: string;
  slug: string;
  perfFee: number;
  mgmtFee: number;
  grossApy: number;
  netApy: number;
  feeBurden: number;
  revenue: number;
  tvl: number;
}

export function FeeComparisonTable({ curators }: FeeComparisonTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('feeBurden');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const router = useRouter();

  const rows = useMemo(() => {
    return curators
      .filter(c => c.avgPerformanceFee !== undefined || c.grossApy !== undefined)
      .map((c): FeeRow => {
        const perfFee = c.avgPerformanceFee || 0;
        const mgmtFee = c.avgManagementFee || 0;
        const grossApy = c.grossApy || c.avgApy || 0;
        const netApy = c.netApy !== undefined ? c.netApy : c.avgApy;
        const feeBurden = grossApy > 0 ? ((grossApy - netApy) / grossApy) * 100 : 0;
        const revenue = c.estimatedAnnualRevenue || 0;

        return { name: c.name, slug: c.slug, perfFee, mgmtFee, grossApy, netApy, feeBurden, revenue, tvl: c.totalTvl };
      })
      .sort((a, b) => {
        const mul = sortDir === 'asc' ? 1 : -1;
        if (sortKey === 'name') return mul * a.name.localeCompare(b.name);
        return mul * ((a[sortKey] as number) - (b[sortKey] as number));
      });
  }, [curators, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  if (rows.length === 0) {
    return <EmptyStateCard title="Fee Comparison" message="No fee data available for comparison." />;
  }

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  const feeBurdenColor = (pct: number) => {
    if (pct < 10) return 'text-emerald-600';
    if (pct < 20) return 'text-amber-600';
    return 'text-red-600';
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <p className="text-[11px] uppercase tracking-widest text-gray-500 font-medium mb-1">Fee Economics</p>
          <CardTitle>Fee Comparison</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {[
                  { key: 'name' as SortKey, label: 'Curator', align: 'text-left' },
                  { key: 'perfFee' as SortKey, label: 'Perf Fee', align: 'text-right' },
                  { key: 'mgmtFee' as SortKey, label: 'Mgmt Fee', align: 'text-right' },
                  { key: 'grossApy' as SortKey, label: 'Gross APY', align: 'text-right' },
                  { key: 'netApy' as SortKey, label: 'Net APY', align: 'text-right' },
                  { key: 'feeBurden' as SortKey, label: 'Fee Burden', align: 'text-right' },
                  { key: 'revenue' as SortKey, label: 'Est. Revenue', align: 'text-right' },
                ].map(col => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className={cn(
                      'px-3 sm:px-4 py-3 text-[10px] sm:text-[11px] font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 transition-colors',
                      col.align,
                      col.key === 'mgmtFee' && 'hidden md:table-cell',
                      col.key === 'revenue' && 'hidden lg:table-cell',
                    )}
                  >
                    {col.label}{sortIndicator(col.key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.slug}
                  onClick={() => router.push(`/curator/${row.slug}`)}
                  className={cn(
                    'border-b border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer',
                    i % 2 === 1 && 'bg-gray-50/70'
                  )}
                >
                  <td className="px-3 sm:px-4 py-3 text-[13px] text-gray-900 font-medium truncate max-w-[160px]">
                    {row.name}
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-right font-mono text-[12px] text-gray-700">
                    {row.perfFee > 0 ? `${row.perfFee.toFixed(1)}%` : '—'}
                  </td>
                  <td className="hidden md:table-cell px-3 sm:px-4 py-3 text-right font-mono text-[12px] text-gray-500">
                    {row.mgmtFee > 0 ? `${row.mgmtFee.toFixed(2)}%` : '—'}
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-right font-mono text-[12px] text-gray-700">
                    {row.grossApy > 0 ? `${row.grossApy.toFixed(2)}%` : '—'}
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-right font-mono text-[12px] text-emerald-600">
                    {row.netApy > 0 ? `${row.netApy.toFixed(2)}%` : '—'}
                  </td>
                  <td className={cn('px-3 sm:px-4 py-3 text-right font-mono text-[12px]', feeBurdenColor(row.feeBurden))}>
                    {row.feeBurden > 0 ? `${row.feeBurden.toFixed(1)}%` : '—'}
                  </td>
                  <td className="hidden lg:table-cell px-3 sm:px-4 py-3 text-right font-mono text-[12px] text-gray-500">
                    {row.revenue > 0 ? formatTvl(row.revenue) : '—'}
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
