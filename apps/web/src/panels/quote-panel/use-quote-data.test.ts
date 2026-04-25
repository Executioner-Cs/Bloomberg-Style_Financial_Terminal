/**
 * Unit tests for useQuoteData.
 *
 * Covers: API happy path, mock fallback, isUsingMockData flag,
 * enabled-gate (empty symbol / not visible).
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

import { fetchQuote } from '@/lib/api/market-data.api';
import { useQuoteData } from './use-quote-data';

const mockFetchQuote = fetchQuote as Mock;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWrapper(): React.ComponentType<{ children: React.ReactNode }> {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }): React.ReactElement {
    return React.createElement(QueryClientProvider, { client }, children);
  }
  return Wrapper;
}

const LIVE_QUOTE = {
  symbol: 'AAPL',
  price: 182.36,
  change_24h: 0.012,
  volume_24h: 55_000_000,
  ts: '2026-04-18T20:00:00.000Z',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useQuoteData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns quote from API on happy path', async () => {
    mockFetchQuote.mockResolvedValue(LIVE_QUOTE);

    const { result } = renderHook(() => useQuoteData('AAPL'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.quote).toMatchObject({ symbol: 'AAPL', price: 182.36 });
    expect(result.current.isUsingMockData).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('falls back to deterministic mock when fetchQuote throws', async () => {
    mockFetchQuote.mockRejectedValue(new Error('API down'));

    const { result } = renderHook(() => useQuoteData('AAPL'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.quote).not.toBeNull();
    expect(result.current.quote?.symbol).toBe('AAPL');
    expect(result.current.isUsingMockData).toBe(true);
    expect(result.current.isError).toBe(false);
  });

  it('sets isUsingMockData false when API returns live data', async () => {
    mockFetchQuote.mockResolvedValue(LIVE_QUOTE);

    const { result } = renderHook(() => useQuoteData('AAPL'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isUsingMockData).toBe(false);
  });

  it('stays idle when symbol is empty string', async () => {
    const { result } = renderHook(() => useQuoteData(''), {
      wrapper: makeWrapper(),
    });

    await new Promise((r) => setTimeout(r, 50));

    expect(mockFetchQuote).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.quote).toBeNull();
  });

  it('stays idle when isVisible is false', async () => {
    const { result } = renderHook(() => useQuoteData('AAPL', false), {
      wrapper: makeWrapper(),
    });

    await new Promise((r) => setTimeout(r, 50));

    expect(mockFetchQuote).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });
});
