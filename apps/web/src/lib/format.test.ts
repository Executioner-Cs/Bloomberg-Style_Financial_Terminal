/**
 * Unit tests for financial formatting utilities.
 *
 * All functions are pure — no mocks needed. Tests cover every branch in
 * format.ts to meet the ≥ 90% utility-function coverage threshold
 * (CLAUDE.md Part XI).
 */
import { describe, it, expect } from 'vitest';

import {
  formatPrice,
  formatChange,
  formatChangePct,
  formatVolume,
  formatDate,
  formatTime,
  formatYearMonth,
} from './format';

// ── formatPrice ──────────────────────────────────────────────────────────────

describe('formatPrice', () => {
  it('returns "—" for null', () => {
    expect(formatPrice(null)).toBe('—');
  });

  it('returns "—" for undefined', () => {
    expect(formatPrice(undefined)).toBe('—');
  });

  it('returns "0.00" for exactly 0', () => {
    expect(formatPrice(0)).toBe('0.00');
  });

  it('uses 6 decimal places for sub-0.0001 values', () => {
    // 0.000045 abs < 0.0001 → 6dp
    expect(formatPrice(0.000045)).toBe('0.000045');
  });

  it('uses 4 decimal places for values between 0.0001 and 0.01', () => {
    // 0.0055 abs < 0.01 → 4dp
    expect(formatPrice(0.0055)).toBe('0.0055');
  });

  it('uses 2 decimal places for values ≥ 1', () => {
    expect(formatPrice(182.3612)).toBe('182.36');
  });

  it('uses 2 decimal places for values between 0.01 and 1', () => {
    // 0.55 abs ≥ 0.01 → 2dp
    expect(formatPrice(0.55)).toBe('0.55');
  });

  it('handles negative sub-penny values correctly', () => {
    // abs of -0.000023 < 0.0001 → 6dp
    expect(formatPrice(-0.000023)).toBe('-0.000023');
  });

  it('handles large values with commas', () => {
    // 65000 → locale-formatted with 2dp
    expect(formatPrice(65000)).toBe('65,000.00');
  });
});

// ── formatChange ─────────────────────────────────────────────────────────────

describe('formatChange', () => {
  it('returns "—" for null', () => {
    expect(formatChange(null)).toBe('—');
  });

  it('returns "—" for undefined', () => {
    expect(formatChange(undefined)).toBe('—');
  });

  it('prefixes positive values with "+"', () => {
    expect(formatChange(1.42)).toBe('+1.42');
  });

  it('does not add extra sign to negative values', () => {
    expect(formatChange(-0.87)).toBe('-0.87');
  });

  it('prefixes zero with "+" (zero is non-negative)', () => {
    expect(formatChange(0)).toBe('+0.00');
  });
});

// ── formatChangePct ───────────────────────────────────────────────────────────

describe('formatChangePct', () => {
  it('returns "—" for null', () => {
    expect(formatChangePct(null)).toBe('—');
  });

  it('returns "—" for undefined', () => {
    expect(formatChangePct(undefined)).toBe('—');
  });

  it('converts decimal fraction to percentage and prefixes "+"', () => {
    // 0.032 → +3.20%
    expect(formatChangePct(0.032)).toBe('+3.20%');
  });

  it('handles negative fractions', () => {
    // -0.0105 → -1.05%
    expect(formatChangePct(-0.0105)).toBe('-1.05%');
  });

  it('handles zero', () => {
    expect(formatChangePct(0)).toBe('+0.00%');
  });
});

// ── formatVolume ──────────────────────────────────────────────────────────────

describe('formatVolume', () => {
  it('returns "—" for null', () => {
    expect(formatVolume(null)).toBe('—');
  });

  it('returns "—" for undefined', () => {
    expect(formatVolume(undefined)).toBe('—');
  });

  it('abbreviates trillions with T suffix', () => {
    expect(formatVolume(1_230_000_000_000)).toBe('1.23T');
  });

  it('abbreviates billions with B suffix', () => {
    expect(formatVolume(456_780_000_000)).toBe('456.78B');
  });

  it('abbreviates millions with M suffix', () => {
    expect(formatVolume(12_340_000)).toBe('12.34M');
  });

  it('abbreviates thousands with K suffix', () => {
    expect(formatVolume(9_870)).toBe('9.87K');
  });

  it('formats sub-thousand values with 2dp', () => {
    expect(formatVolume(123.456)).toBe('123.46');
  });

  it('formats exactly 1T boundary correctly', () => {
    expect(formatVolume(1_000_000_000_000)).toBe('1.00T');
  });
});

// ── formatDate ────────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('returns "—" for null', () => {
    expect(formatDate(null)).toBe('—');
  });

  it('returns "—" for undefined', () => {
    expect(formatDate(undefined)).toBe('—');
  });

  it('returns "—" for empty string', () => {
    expect(formatDate('')).toBe('—');
  });

  it('formats a valid ISO date string', () => {
    // Use noon UTC so the date renders as the 18th in any timezone (±12h of UTC).
    const result = formatDate('2026-04-18T12:00:00.000Z');
    expect(result).toMatch(/Apr\s+18,\s+2026/);
  });
});

// ── formatTime ────────────────────────────────────────────────────────────────

describe('formatTime', () => {
  it('returns "—" for null', () => {
    expect(formatTime(null)).toBe('—');
  });

  it('returns "—" for undefined', () => {
    expect(formatTime(undefined)).toBe('—');
  });

  it('returns "—" for empty string', () => {
    expect(formatTime('')).toBe('—');
  });

  it('formats a valid ISO date-time as HH:MM in UTC', () => {
    // 2026-04-18T14:32:00.000Z → "14:32"
    const result = formatTime('2026-04-18T14:32:00.000Z');
    expect(result).toBe('14:32');
  });

  it('formats midnight UTC correctly', () => {
    const result = formatTime('2026-04-18T00:00:00.000Z');
    expect(result).toBe('00:00');
  });
});

// ── formatYearMonth ───────────────────────────────────────────────────────────

describe('formatYearMonth', () => {
  it('returns "—" for null', () => {
    expect(formatYearMonth(null)).toBe('—');
  });

  it('returns "—" for undefined', () => {
    expect(formatYearMonth(undefined)).toBe('—');
  });

  it('returns "—" for empty string', () => {
    expect(formatYearMonth('')).toBe('—');
  });

  it('slices YYYY-MM from a full FRED date string', () => {
    expect(formatYearMonth('2026-04-01')).toBe('2026-04');
  });

  it('returns "—" for strings shorter than 7 characters', () => {
    expect(formatYearMonth('2026-0')).toBe('—');
  });

  it('handles a string of exactly 7 characters', () => {
    expect(formatYearMonth('2026-04')).toBe('2026-04');
  });
});
