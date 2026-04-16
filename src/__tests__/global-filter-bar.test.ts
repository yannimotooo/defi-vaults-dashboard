import { describe, it, expect } from 'vitest';
import { applyFiltersToCurators, type GlobalFilters } from '@/components/ui/global-filter-bar';
import type { Curator } from '@/types';

const NO_FILTERS: GlobalFilters = {
  chains: new Set(),
  protocols: new Set(),
  minTvl: 0,
  minGrowth30d: 0,
};

function makeCurator(partial: Partial<Curator>): Curator {
  return {
    name: 'Test Curator',
    slug: 'test',
    totalTvl: 100_000_000,
    vaultCount: 5,
    chains: ['Ethereum'],
    protocols: ['Morpho'],
    avgApy: 5,
    netFlow7d: 0,
    netFlow30d: 0,
    ...partial,
  };
}

describe('applyFiltersToCurators', () => {
  const curators: Curator[] = [
    makeCurator({
      slug: 'steakhouse',
      name: 'Steakhouse',
      totalTvl: 1_700_000_000,
      chains: ['Ethereum', 'Base'],
      protocols: ['Morpho', 'Spark'],
      netFlow30d: 100_000_000,
    }),
    makeCurator({
      slug: 'sentora',
      name: 'Sentora',
      totalTvl: 2_000_000_000,
      chains: ['Ethereum', 'Solana'],
      protocols: ['Morpho', 'Kamino'],
      netFlow30d: 343_000_000,
    }),
    makeCurator({
      slug: 'small',
      name: 'Small',
      totalTvl: 5_000_000,
      chains: ['Ethereum'],
      protocols: ['Morpho'],
      netFlow30d: 1_000_000,
    }),
    makeCurator({
      slug: 'rocketship',
      name: 'Rocketship',
      totalTvl: 50_000_000,
      chains: ['Solana'],
      protocols: ['Kamino'],
      netFlow30d: 80_000_000, // 160% growth
    }),
  ];

  it('passes through unchanged when no filters active', () => {
    expect(applyFiltersToCurators(curators, NO_FILTERS)).toEqual(curators);
  });

  it('filters by single chain', () => {
    const result = applyFiltersToCurators(curators, {
      ...NO_FILTERS,
      chains: new Set(['Solana']),
    });
    expect(result.map(c => c.slug).sort()).toEqual(['rocketship', 'sentora']);
  });

  it('filters by multiple chains (OR semantics)', () => {
    const result = applyFiltersToCurators(curators, {
      ...NO_FILTERS,
      chains: new Set(['Solana', 'Base']),
    });
    expect(result.map(c => c.slug).sort()).toEqual(['rocketship', 'sentora', 'steakhouse']);
  });

  it('returns empty when no curator matches the chain', () => {
    const result = applyFiltersToCurators(curators, {
      ...NO_FILTERS,
      chains: new Set(['ImaginaryChain']),
    });
    expect(result).toEqual([]);
  });

  it('filters by single protocol', () => {
    const result = applyFiltersToCurators(curators, {
      ...NO_FILTERS,
      protocols: new Set(['Spark']),
    });
    expect(result.map(c => c.slug)).toEqual(['steakhouse']);
  });

  it('filters by minTvl', () => {
    const result = applyFiltersToCurators(curators, {
      ...NO_FILTERS,
      minTvl: 100_000_000,
    });
    expect(result.map(c => c.slug).sort()).toEqual(['sentora', 'steakhouse']);
  });

  it('combines chain + minTvl filters (AND semantics)', () => {
    const result = applyFiltersToCurators(curators, {
      ...NO_FILTERS,
      chains: new Set(['Solana']),
      minTvl: 100_000_000,
    });
    // Only Sentora matches both Solana AND ≥$100M
    expect(result.map(c => c.slug)).toEqual(['sentora']);
  });

  it('filters by minGrowth30d (≥50%)', () => {
    const result = applyFiltersToCurators(curators, {
      ...NO_FILTERS,
      minGrowth30d: 50,
    });
    // Steakhouse: 100M / 1700M = 5.9% (out)
    // Sentora: 343M / 2000M = 17.2% (out)
    // Small: 1M / 5M = 20% (out)
    // Rocketship: 80M / 50M = 160% (in)
    expect(result.map(c => c.slug)).toEqual(['rocketship']);
  });

  it('emerging-preset behavior: minTvl=$10M + minGrowth30d=50%', () => {
    const result = applyFiltersToCurators(curators, {
      ...NO_FILTERS,
      minTvl: 10_000_000,
      minGrowth30d: 50,
    });
    // Small fails minTvl (5M < 10M), Rocketship passes both → only Rocketship
    expect(result.map(c => c.slug)).toEqual(['rocketship']);
  });

  it('excludes curators with zero or undefined TVL when growth filter active', () => {
    const broken: Curator[] = [
      makeCurator({ slug: 'zero', totalTvl: 0, netFlow30d: 100_000 }),
    ];
    const result = applyFiltersToCurators(broken, {
      ...NO_FILTERS,
      minGrowth30d: 50,
    });
    expect(result).toEqual([]);
  });

  it('handles curator with missing chains/protocols arrays gracefully', () => {
    const partial: Curator = makeCurator({
      slug: 'partial',
      chains: undefined as unknown as string[], // simulate missing field
      protocols: undefined as unknown as string[],
    });
    const result = applyFiltersToCurators([partial], {
      ...NO_FILTERS,
      chains: new Set(['Ethereum']),
    });
    // Curator with no chains can't match any chain filter → excluded
    expect(result).toEqual([]);
  });
});
