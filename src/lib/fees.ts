/**
 * Fee and rate normalization utilities.
 *
 * **Why this module exists:** different protocols return fees and rates in
 * different formats (decimal, percentage, basis points, WAD). Without a single
 * canonical format and explicit conversions, it's easy to introduce 10x or
 * 0.01x bugs at any boundary. This module:
 *
 * - Defines `Percent` and `Decimal` branded types so the compiler distinguishes
 *   `5` (Percent) from `0.05` (Decimal).
 * - Provides `decimalToPercent` / `percentToDecimal` / `bpsToPercent` /
 *   `wadToPercent` for explicit conversion at API boundaries.
 * - Provides `assertReasonablePercent` for runtime guards at consumption sites
 *   (catches regressions if an external API silently changes its format).
 *
 * Convention: all internal `Curator` / `Vault` / `CuratorFeeData` types should
 * carry fees and APYs as `Percent` (e.g. `5` = 5%). Convert at the source layer
 * (Morpho `* 100`, Euler `parsePerformanceFee`, Kamino BPS) before storing.
 */

// Branded numeric types — purely a TS-level guard, no runtime cost.
// Use the `as` casts only at conversion boundaries.
export type Percent = number & { readonly __brand: 'Percent' };
export type Decimal = number & { readonly __brand: 'Decimal' };

/** Convert a decimal fraction (0.05) to a percentage value (5). */
export function decimalToPercent(value: number): Percent {
  return (value * 100) as Percent;
}

/** Convert a percentage value (5) to a decimal fraction (0.05). */
export function percentToDecimal(value: number): Decimal {
  return (value / 100) as Decimal;
}

/** Convert basis points (500) to a percentage value (5). */
export function bpsToPercent(value: number): Percent {
  return (value / 100) as Percent;
}

/**
 * Convert WAD-formatted value (1e18 = 100%) to a percentage value (100).
 * Used by Euler V2 subgraph for performance fees.
 */
export function wadToPercent(value: number): Percent {
  return ((value / 1e18) * 100) as Percent;
}

/**
 * Runtime guard for fee/rate values that should be in 0–100 percent range.
 *
 * Logs a warning and returns the value clamped to a sane bound when it falls
 * outside `[min, max]`. Use at consumption sites — DO NOT silently swallow.
 *
 * Default bounds: 0–500 (allows for high-yield APYs, but catches obvious
 * format errors like a 5000% APY that was actually 50× over-scaled).
 */
export function assertReasonablePercent(
  value: number | undefined | null,
  context: string,
  { min = 0, max = 500 }: { min?: number; max?: number } = {},
): Percent {
  if (value == null || !Number.isFinite(value)) {
    return 0 as Percent;
  }
  if (value < min || value > max) {
    console.warn(
      `[fees] Out-of-range value (${value}) for ${context} — expected ${min}-${max}%. ` +
      `Possible format mismatch. Clamping.`,
    );
    return Math.max(min, Math.min(value, max)) as Percent;
  }
  return value as Percent;
}

/**
 * Format a fee value as a display string with a fixed number of decimals.
 * Returns "—" for null/undefined/NaN. Always emits a `%` suffix.
 */
export function formatPercent(value: number | undefined | null, decimals = 2): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(decimals)}%`;
}
