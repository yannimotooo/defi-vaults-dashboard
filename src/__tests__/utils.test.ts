import { describe, it, expect } from 'vitest';
import { formatTvl, formatFlow, formatPercent, formatApy, getChangeColor, normalizeChainName } from '@/lib/utils';

describe('formatTvl', () => {
  it('formats billions', () => {
    expect(formatTvl(1_500_000_000)).toBe('$1.50B');
  });

  it('formats millions', () => {
    expect(formatTvl(250_000_000)).toBe('$250.00M');
  });

  it('formats thousands with 1 decimal', () => {
    expect(formatTvl(50_000)).toBe('$50.0K');
  });

  it('formats small values as integers', () => {
    expect(formatTvl(999)).toBe('$999');
  });

  it('formats zero', () => {
    expect(formatTvl(0)).toBe('$0');
  });

  it('compact mode shortens output', () => {
    expect(formatTvl(1_500_000_000, true)).toBe('$1.5B');
  });

  it('handles negative values', () => {
    expect(formatTvl(-500_000_000)).toBe('-$500.00M');
  });
});

describe('formatFlow', () => {
  it('formats positive flows with + sign', () => {
    expect(formatFlow(1_000_000)).toBe('+$1.0M');
  });

  it('formats negative flows with - sign', () => {
    expect(formatFlow(-500_000)).toBe('-$500K');
  });

  it('formats zero flow', () => {
    expect(formatFlow(0)).toBe('$0');
  });
});

describe('formatPercent', () => {
  it('formats positive values with + sign', () => {
    expect(formatPercent(5.123)).toBe('+5.12%');
  });

  it('formats zero with + sign', () => {
    expect(formatPercent(0)).toBe('+0.00%');
  });

  it('formats negative values', () => {
    expect(formatPercent(-2.5)).toBe('-2.50%');
  });
});

describe('formatApy', () => {
  it('formats APY to 2 decimal places', () => {
    expect(formatApy(12.345)).toBe('12.35%');
  });

  it('formats zero APY', () => {
    expect(formatApy(0)).toBe('0.00%');
  });
});

describe('getChangeColor', () => {
  it('returns green for positive values', () => {
    expect(getChangeColor(5)).toBe('text-green-600');
  });

  it('returns red for negative values', () => {
    expect(getChangeColor(-3)).toBe('text-red-600');
  });

  it('returns gray for zero', () => {
    expect(getChangeColor(0)).toBe('text-gray-500');
  });
});

describe('normalizeChainName', () => {
  it('normalizes lowercase chain names', () => {
    expect(normalizeChainName('ethereum')).toBe('Ethereum');
    expect(normalizeChainName('solana')).toBe('Solana');
  });

  it('is case-insensitive for mapped chains', () => {
    expect(normalizeChainName('ETHEREUM')).toBe('Ethereum');
  });

  it('handles BSC', () => {
    expect(normalizeChainName('bsc')).toBe('BSC');
  });

  it('returns raw input for unmapped chains', () => {
    expect(normalizeChainName('somechain')).toBe('somechain');
  });
});
