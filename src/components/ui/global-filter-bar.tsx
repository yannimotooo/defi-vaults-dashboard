'use client';

import { useCallback, useMemo, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Curator } from '@/types';

/**
 * Phase 4.a — Global filter bar.
 *
 * State is persisted to URL search params so deep links work and the back
 * button restores the user's exact view. Filters apply across all tabs.
 *
 * Filter keys:
 *   ?chains=ethereum,solana       — comma-separated chain names (case-sensitive
 *                                   match against Curator.chains[])
 *   ?protocols=morpho,euler       — comma-separated protocol names
 *   ?minTvl=100000000             — minimum TVL in USD (number, optional)
 *
 * Pattern note: `useSearchParams()` returns a stable reference per navigation
 * but reading individual params via `.get()` is safe in render. We use
 * `router.replace` (not `push`) so filter changes don't pollute browser history.
 */

export interface GlobalFilters {
  chains: Set<string>;
  protocols: Set<string>;
  minTvl: number;
}

/**
 * Reads current filters from URL. Returns a stable identity per param change.
 * Use this in any component that needs to react to filter changes.
 */
export function useGlobalFilters(): GlobalFilters {
  const params = useSearchParams();
  return useMemo(() => {
    const chainsParam = params.get('chains');
    const protocolsParam = params.get('protocols');
    const minTvlParam = params.get('minTvl');
    return {
      chains: new Set(chainsParam ? chainsParam.split(',').filter(Boolean) : []),
      protocols: new Set(protocolsParam ? protocolsParam.split(',').filter(Boolean) : []),
      minTvl: minTvlParam ? Number(minTvlParam) || 0 : 0,
    };
  }, [params]);
}

/**
 * Apply active filters to a list of curators.
 * Empty filter sets = no filtering for that dimension (pass-through).
 */
export function applyFiltersToCurators(curators: Curator[], filters: GlobalFilters): Curator[] {
  if (
    filters.chains.size === 0 &&
    filters.protocols.size === 0 &&
    filters.minTvl <= 0
  ) {
    return curators;
  }
  return curators.filter(c => {
    if (filters.minTvl > 0 && c.totalTvl < filters.minTvl) return false;
    if (filters.chains.size > 0) {
      const hasMatchingChain = (c.chains || []).some(ch => filters.chains.has(ch));
      if (!hasMatchingChain) return false;
    }
    if (filters.protocols.size > 0) {
      const hasMatchingProtocol = (c.protocols || []).some(p => filters.protocols.has(p));
      if (!hasMatchingProtocol) return false;
    }
    return true;
  });
}

interface GlobalFilterBarProps {
  /** All curators in the dataset — used to derive the chain/protocol option lists. */
  curators: Curator[];
}

export function GlobalFilterBar({ curators }: GlobalFilterBarProps) {
  const router = useRouter();
  const params = useSearchParams();
  const filters = useGlobalFilters();

  // Derive available chain/protocol options from the data, sorted alphabetically.
  const allChains = useMemo(() => {
    const set = new Set<string>();
    for (const c of curators) for (const ch of c.chains || []) set.add(ch);
    return Array.from(set).sort();
  }, [curators]);
  const allProtocols = useMemo(() => {
    const set = new Set<string>();
    for (const c of curators) for (const p of c.protocols || []) set.add(p);
    return Array.from(set).sort();
  }, [curators]);

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value && value.length > 0) next.set(key, value);
      else next.delete(key);
      const qs = next.toString();
      router.replace(qs ? `?${qs}` : '?', { scroll: false });
    },
    [params, router],
  );

  const toggleChain = useCallback(
    (chain: string) => {
      const next = new Set(filters.chains);
      if (next.has(chain)) next.delete(chain);
      else next.add(chain);
      updateParam('chains', Array.from(next).join(','));
    },
    [filters.chains, updateParam],
  );

  const toggleProtocol = useCallback(
    (protocol: string) => {
      const next = new Set(filters.protocols);
      if (next.has(protocol)) next.delete(protocol);
      else next.add(protocol);
      updateParam('protocols', Array.from(next).join(','));
    },
    [filters.protocols, updateParam],
  );

  const clearAll = useCallback(() => {
    const next = new URLSearchParams(params.toString());
    next.delete('chains');
    next.delete('protocols');
    next.delete('minTvl');
    const qs = next.toString();
    router.replace(qs ? `?${qs}` : '?', { scroll: false });
  }, [params, router]);

  const activeCount =
    filters.chains.size + filters.protocols.size + (filters.minTvl > 0 ? 1 : 0);

  if (curators.length === 0) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 text-[12px]">
      <FilterDropdown
        label="Chains"
        options={allChains}
        selected={filters.chains}
        onToggle={toggleChain}
      />
      <FilterDropdown
        label="Protocols"
        options={allProtocols}
        selected={filters.protocols}
        onToggle={toggleProtocol}
      />
      <MinTvlInput
        value={filters.minTvl}
        onChange={v => updateParam('minTvl', v > 0 ? String(v) : null)}
      />
      {activeCount > 0 && (
        <button
          onClick={clearAll}
          className="flex items-center gap-1 px-2.5 py-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors text-[11px]"
          aria-label={`Clear ${activeCount} active filter${activeCount === 1 ? '' : 's'}`}
        >
          <X className="h-3 w-3" />
          Clear ({activeCount})
        </button>
      )}
    </div>
  );
}

/**
 * Multi-select dropdown for filter values.
 * Closes on outside click. Selected items shown inline as count.
 */
function FilterDropdown({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: Set<string>;
  onToggle: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  // Close on outside click via document listener.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(`[data-filter-dropdown="${label}"]`)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, label]);

  return (
    <div className="relative" data-filter-dropdown={label}>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium border transition-colors',
          selected.size > 0
            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {label}
        {selected.size > 0 && (
          <span className="text-[10px] bg-indigo-100 text-indigo-700 rounded-full px-1.5 py-0.5">
            {selected.size}
          </span>
        )}
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute top-full left-0 mt-1 w-56 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1"
        >
          {options.length === 0 ? (
            <div className="px-3 py-2 text-gray-400 text-[11px]">No options</div>
          ) : (
            options.map(opt => (
              <label
                key={opt}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-[12px]"
              >
                <input
                  type="checkbox"
                  checked={selected.has(opt)}
                  onChange={() => onToggle(opt)}
                  className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500 focus:ring-1 focus:ring-offset-0"
                />
                <span className="text-gray-700">{opt}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Min TVL filter — input expecting USD millions (user-friendly, internally
 * stored as raw USD). E.g. typing "100" filters to >= $100M.
 */
function MinTvlInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const millionsValue = value > 0 ? Math.round(value / 1_000_000) : '';
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 bg-white">
      <span className="text-gray-500 text-[11px]">Min TVL</span>
      <span className="text-gray-400 text-[11px]">$</span>
      <input
        type="number"
        min={0}
        value={millionsValue}
        onChange={e => {
          const m = Number(e.target.value);
          onChange(m > 0 ? m * 1_000_000 : 0);
        }}
        placeholder="0"
        aria-label="Minimum TVL in millions of USD"
        className="w-16 bg-transparent outline-none text-[12px] text-gray-900"
        style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
      />
      <span className="text-gray-400 text-[11px]">M</span>
    </div>
  );
}
