/**
 * Financial formatting utilities.
 *
 * All formatting is centralised here so display conventions are consistent
 * across every panel. Bloomberg-style: right-aligned numbers, sign-prefixed
 * changes, abbreviated large figures (K/M/B/T).
 *
 * These are pure functions with no side effects — safe for use in render
 * paths and memoisation.
 */

// ------------------------------------------------------------------
// Price
// ------------------------------------------------------------------

/**
 * Format a price for display. Uses 2 decimal places for values ≥ 1,
 * up to 6 decimal places for sub-penny crypto prices.
 *
 * @param value - Raw price number, or null when unavailable.
 * @returns Formatted string, e.g. "182.36", "0.000045", or "—"
 */
export function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  if (value === 0) return '0.00';
  const abs = Math.abs(value);
  const decimals = abs < 0.0001 ? 6 : abs < 0.01 ? 4 : 2;
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// ------------------------------------------------------------------
// Change (absolute)
// ------------------------------------------------------------------

/**
 * Format an absolute price change with sign prefix.
 *
 * @param value - Change amount, or null when unavailable.
 * @returns e.g. "+1.42", "-0.87", or "—"
 */
export function formatChange(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${formatPrice(value)}`;
}

// ------------------------------------------------------------------
// Change (percentage)
// ------------------------------------------------------------------

/**
 * Format a percentage change.
 *
 * The API returns change_24h as a decimal fraction (e.g. 0.032 = +3.2%).
 * Pass the raw fraction — this function multiplies by 100.
 *
 * @param value - Decimal fraction change, or null when unavailable.
 * @returns e.g. "+3.20%", "-1.05%", or "—"
 */
export function formatChangePct(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const pct = value * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

// ------------------------------------------------------------------
// Volume / large numbers
// ------------------------------------------------------------------

/** Abbreviated volume thresholds. */
const TRILLION = 1_000_000_000_000;
const BILLION = 1_000_000_000;
const MILLION = 1_000_000;
const THOUSAND = 1_000;

/**
 * Abbreviate a large number using K/M/B/T suffixes.
 *
 * Used for volume, market cap, and other large figures where full precision
 * would consume too much column width.
 *
 * @param value - Raw number, or null when unavailable.
 * @returns e.g. "1.23T", "456.78B", "12.34M", "9.87K", or "—"
 */
export function formatVolume(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  if (value >= TRILLION) return `${(value / TRILLION).toFixed(2)}T`;
  if (value >= BILLION) return `${(value / BILLION).toFixed(2)}B`;
  if (value >= MILLION) return `${(value / MILLION).toFixed(2)}M`;
  if (value >= THOUSAND) return `${(value / THOUSAND).toFixed(2)}K`;
  return value.toFixed(2);
}

// ------------------------------------------------------------------
// Dates and times
// ------------------------------------------------------------------

/**
 * Format an ISO 8601 UTC string as a short date.
 *
 * @param isoString - ISO 8601 date string from the API, or null.
 * @returns e.g. "Apr 18, 2026", or "—"
 */
export function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    return new Date(isoString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

/**
 * Format an ISO 8601 UTC string as HH:MM time (24h, UTC).
 *
 * @param isoString - ISO 8601 date-time string from the API, or null.
 * @returns e.g. "14:32", or "—"
 */
export function formatTime(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    // hourCycle: 'h23' produces 00–23. Using `hour12: false` instead causes
    // V8 to emit '24:00' at midnight UTC (a long-standing ICU quirk where
    // it picks the 'h24' cycle implicitly). 'h23' is unambiguous and
    // matches the format the rest of the terminal expects.
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: 'UTC',
    });
  } catch {
    return '—';
  }
}

/**
 * Format an ISO 8601 date string as YYYY-MM for FRED macro series bars.
 *
 * FRED observations arrive as 'YYYY-MM-DD'; showing just YYYY-MM is
 * enough resolution for monthly/quarterly series.
 *
 * @param isoString - ISO 8601 date string, or null.
 * @returns e.g. "2026-04", or "—"
 */
export function formatYearMonth(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  // Slice is safe — FRED always returns YYYY-MM-DD format.
  return isoString.length >= 7 ? isoString.slice(0, 7) : '—';
}
