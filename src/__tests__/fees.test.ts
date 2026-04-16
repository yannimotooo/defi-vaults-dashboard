import { describe, it, expect, vi } from 'vitest';
import {
  decimalToPercent,
  percentToDecimal,
  bpsToPercent,
  wadToPercent,
  assertReasonablePercent,
  formatPercent,
} from '@/lib/fees';

describe('decimalToPercent', () => {
  it('converts 0.1 to 10', () => {
    expect(decimalToPercent(0.1)).toBe(10);
  });

  it('converts 0 to 0', () => {
    expect(decimalToPercent(0)).toBe(0);
  });

  it('handles small values without floating-point surprise', () => {
    expect(decimalToPercent(0.05)).toBeCloseTo(5);
  });
});

describe('percentToDecimal', () => {
  it('converts 10 to 0.1', () => {
    expect(percentToDecimal(10)).toBeCloseTo(0.1);
  });

  it('round-trips with decimalToPercent', () => {
    const original = 0.123;
    expect(percentToDecimal(decimalToPercent(original))).toBeCloseTo(original);
  });
});

describe('bpsToPercent', () => {
  it('converts 1000 bps to 10%', () => {
    expect(bpsToPercent(1000)).toBe(10);
  });

  it('converts 50 bps to 0.5%', () => {
    expect(bpsToPercent(50)).toBe(0.5);
  });
});

describe('wadToPercent', () => {
  it('converts 1e18 (WAD = 100%) to 100', () => {
    expect(wadToPercent(1e18)).toBe(100);
  });

  it('converts 1e17 (WAD = 10%) to 10', () => {
    expect(wadToPercent(1e17)).toBeCloseTo(10);
  });
});

describe('assertReasonablePercent', () => {
  it('passes through reasonable values unchanged', () => {
    expect(assertReasonablePercent(5, 'test')).toBe(5);
    expect(assertReasonablePercent(50, 'test')).toBe(50);
  });

  it('returns 0 for null/undefined', () => {
    expect(assertReasonablePercent(null, 'test')).toBe(0);
    expect(assertReasonablePercent(undefined, 'test')).toBe(0);
  });

  it('returns 0 for NaN', () => {
    expect(assertReasonablePercent(NaN, 'test')).toBe(0);
  });

  it('clamps and warns when value exceeds default max (500)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(assertReasonablePercent(10000, 'fee')).toBe(500);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain('Out-of-range value (10000) for fee');
    warnSpy.mockRestore();
  });

  it('clamps and warns with custom max (100)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(assertReasonablePercent(150, 'fee', { max: 100 })).toBe(100);
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });

  it('clamps negative values to min', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(assertReasonablePercent(-5, 'fee')).toBe(0);
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });
});

describe('formatPercent', () => {
  it('formats with 2 decimals by default', () => {
    expect(formatPercent(5.234)).toBe('5.23%');
  });

  it('respects custom decimal count', () => {
    expect(formatPercent(5.234, 1)).toBe('5.2%');
    expect(formatPercent(5.234, 0)).toBe('5%');
  });

  it('returns "—" for null/undefined/NaN', () => {
    expect(formatPercent(null)).toBe('—');
    expect(formatPercent(undefined)).toBe('—');
    expect(formatPercent(NaN)).toBe('—');
  });

  it('handles negative values', () => {
    expect(formatPercent(-3.5)).toBe('-3.50%');
  });
});
