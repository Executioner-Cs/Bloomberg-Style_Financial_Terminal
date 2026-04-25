/**
 * Unit tests for useChartData.
 *
 * Tests cover: API happy path, mock-data fallback, enabled-gate logic,
 * bar transformation (ts → UTCTimestamp), and refetch stability.
 *
 * All network calls are mocked — no real HTTP (CLAUDE.md Part XI).
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ── Mock the API module ───────────────────────────────────────────────────────
vi.mock('@/lib/api/market-data.api', () => ({
  fetchOHLCV: vi.fn(),
  fetchQuote: vi.fn(),
  fetchBulkQuotes: vi.fn(),
}));

import { fetchOHLCV } from '@/lib/api/market-data.api';
import { useChartData } from './use-chart-data';

const mockFetchOHLCV = fetchOHLCV as Mock;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWrapper(): React.ComponentType<{ children: React.ReactNode }> {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }): React.ReactElement {
    return React.createElement(QueryClientProvider, { client }, children);
  }
  return Wrapper;
}

const SAMPLE_BAR = {
  ts: '2026-04-18T00:00:00.000Z',
  open: 100,
  high: 110,
  low: 90,
  close: 105,
  volume: 1_000_000,
  adjClose: 105,
};

const EXPECTED_TIME_SECONDS = new Date('2026-04-18T00:00:00.000Z').getTime() / 1000;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useChartData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns transformed chartBars on successful API response', async () => {
    mockFetchOHLCV.mockResolvedValue({
      symbol: 'bitcoin',
      timeframe: '1D',
      bars: [SAMPLE_BAR],
      source: 'live',
    });

    const { result } = renderHook(() => useChartData('bitcoin', '1D'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.chartBars).toHaveLength(1);
    expect(result.current.chartBars[0]).toEqual({
      time: EXPECTED_TIME_SECONDS,
      open: 100,
      high: 110,
      low: 90,
      close: 105,
    });
    expect(result.current.isUsingMockData).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it('falls back to mock bars when fetchOHLCV throws', async () => {
    mockFetchOHLCV.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useChartData('bitcoin', '1D'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Mock bars are generated — there should be 180 bars for '1D'
    expect(result.current.chartBars.length).toBe(180);
    expect(result.current.isUsingMockData).toBe(true);
    expect(result.current.isError).toBe(false);
  });

  it('stays idle (no fetch) when symbol is empty string', async () => {
    const { result } = renderHook(() => useChartData('', '1D'), {
      wrapper: makeWrapper(),
    });

    // Give query time to potentially fire (it should not)
    await new Promise((r) => setTimeout(r, 50));

    expect(mockFetchOHLCV).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.chartBars).toEqual([]);
  });

  it('stays idle when isVisible is false', async () => {
    const { result } = renderHook(() => useChartData('bitcoin', '1D', false), {
      wrapper: makeWrapper(),
    });

    await new Promise((r) => setTimeout(r, 50));

    expect(mockFetchOHLCV).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it('maps OHLCVBar.ts to ChartBar.time as Unix seconds', async () => {
    const ts = '2026-01-01T12:00:00.000Z';
    mockFetchOHLCV.mockResolvedValue({
      symbol: 'ethereum',
      timeframe: '1H',
      bars: [{ ...SAMPLE_BAR, ts }],
      source: 'live',
    });

    const { result } = renderHook(() => useChartData('ethereum', '1H'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const expectedSeconds = new Date(ts).getTime() / 1000;
    expect(result.current.chartBars[0]?.time).toBe(expectedSeconds);
  });

  it('refetch function reference is stable across re-renders', async () => {
    mockFetchOHLCV.mockResolvedValue({
      symbol: 'solana',
      timeframe: '1D',
      bars: [],
      source: 'live',
    });

    const { result, rerender } = renderHook(() => useChartData('solana', '1D'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const firstRef = result.current.refetch;
    rerender();
    expect(result.current.refetch).toBe(firstRef);
  });
});
