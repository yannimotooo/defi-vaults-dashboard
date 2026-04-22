import { describe, expect, it } from 'vitest';

import { parsePerformanceFee } from '../lib/euler';

// The Euler V2 subgraph has returned performance fees in four different
// formats depending on protocol version: WAD (1e18 = 100%), basis points
// (1000 = 10%), plain percent (10 = 10%), or decimal (0.1 = 10%). The
// parser detects format heuristically. These tests pin the heuristic down
// so format-detection drift doesn't silently corrupt displayed fees.
describe('parsePerformanceFee', () => {
  describe('WAD format (feeNum > 1e14)', () => {
    it('1e18 → 100%', () => {
      expect(parsePerformanceFee('1000000000000000000')).toBe(100);
    });

    it('1e17 → 10% (typical perf fee)', () => {
      expect(parsePerformanceFee('100000000000000000')).toBe(10);
    });

    it('5e16 → 5%', () => {
      expect(parsePerformanceFee('50000000000000000')).toBe(5);
    });

    it('clamps values above 1e18 to 100%', () => {
      expect(parsePerformanceFee('2000000000000000000')).toBe(100);
    });
  });

  describe('basis-points format (100 < feeNum ≤ 1e14)', () => {
    it('1000 bps → 10%', () => {
      expect(parsePerformanceFee('1000')).toBe(10);
    });

    it('500 bps → 5%', () => {
      expect(parsePerformanceFee('500')).toBe(5);
    });

    it('101 bps → 1.01%', () => {
      expect(parsePerformanceFee('101')).toBeCloseTo(1.01, 5);
    });

    it('clamps >=10000 bps at 100%', () => {
      expect(parsePerformanceFee('15000')).toBe(100);
    });
  });

  describe('already-percent format (1 < feeNum ≤ 100)', () => {
    it('10 → 10%', () => {
      expect(parsePerformanceFee('10')).toBe(10);
    });

    it('99.5 → 99.5%', () => {
      expect(parsePerformanceFee('99.5')).toBe(99.5);
    });

    // Known ambiguous boundary: 100 matches the percent branch (not BPS).
    // This test locks in current behavior — if a caller relies on the
    // opposite interpretation, the heuristic itself needs review.
    it('100 → 100% (ambiguous with BPS=1%, but treated as percent)', () => {
      expect(parsePerformanceFee('100')).toBe(100);
    });
  });

  describe('decimal format (0 ≤ feeNum ≤ 1)', () => {
    it('0.1 → 10%', () => {
      expect(parsePerformanceFee('0.1')).toBeCloseTo(10, 5);
    });

    it('0 → 0%', () => {
      expect(parsePerformanceFee('0')).toBe(0);
    });

    // 1 hits the decimal branch (not `> 1`, so it falls through percent).
    it('1 → 100% (decimal boundary, not "1%")', () => {
      expect(parsePerformanceFee('1')).toBe(100);
    });
  });

  describe('non-numeric and negative inputs', () => {
    it('empty string → 0', () => {
      expect(parsePerformanceFee('')).toBe(0);
    });

    it('non-numeric → 0', () => {
      expect(parsePerformanceFee('abc')).toBe(0);
    });

    it('negative → 0 (no branch matches)', () => {
      expect(parsePerformanceFee('-1')).toBe(0);
    });

    it('NaN string → 0', () => {
      expect(parsePerformanceFee('NaN')).toBe(0);
    });
  });
});
