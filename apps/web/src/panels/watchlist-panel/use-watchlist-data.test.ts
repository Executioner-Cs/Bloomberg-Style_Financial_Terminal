/**
 * Unit tests for useWatchlistData.
 *
 * Covers: API happy path, mock-map fallback, isUsingMockData detection,
 * enabled-gate (empty symbols / not visible).
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

import { fetchBulkQuotes } from '@/lib/api/market-data.api';
import { useWatchlistData } from './use-watchlist-data';

const mockFetchBulkQuotes = fetchBulkQuotes as Mock;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWrapper(): React.ComponentType<{ children: React.ReactNode }> {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }): React.ReactElement {
    return React.createElement(QueryClientProvider, { client }, children);
  }
  return Wrapper;
}

const LIVE_RESPONSE = {
  quotes: {
    AAPL: {
      symbol: 'AAPL',
      price: 182.36,
      change_24h: 0.012,
      volume_24h: 55_000_000,
      ts: '2026-04-18T20:00:00.000Z',
    },
    MSFT: {
      symbol: 'MSFT',
      price: 420.0,
      change_24h: -0.005,
      volume_24h: 30_000_000,
      ts: '2026-04-18T20:00:00.000Z',
    },
  },
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useWatchlistData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns quote map from API on happy path', async () => {
    mockFetchBulkQuotes.mockResolvedValue(LIVE_RESPONSE);

    const { result } = renderHook(() => useWatchlistData(['AAPL', 'MSFT']), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(Object.keys(result.current.quotes)).toEqual(expect.arrayContaining(['AAPL', 'MSFT']));
    expect(result.current.quotes['AAPL']?.price).toBe(182.36);
    expect(result.current.isUsingMockData).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it('falls back to mock map when fetchBulkQuotes throws', async () => {
    mockFetchBulkQuotes.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useWatchlistData(['AAPL', 'MSFT']), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.quotes['AAPL']).toBeDefined();
    expect(result.current.quotes['MSFT']).toBeDefined();
    expect(result.current.isUsingMockData).toBe(true);
    expect(result.current.isError).toBe(false);
  });

  it('sets isUsingMockData false when all quotes are live', async () => {
    mockFetchBulkQuotes.mockResolvedValue(LIVE_RESPONSE);

    const { result } = renderHook(() => useWatchlistData(['AAPL', 'MSFT']), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isUsingMockData).toBe(false);
  });

  it('stays idle when symbols array is empty', async () => {
    const { result } = renderHook(() => useWatchlistData([]), {
      wrapper: makeWrapper(),
    });

    await new Promise((r) => setTimeout(r, 50));

    expect(mockFetchBulkQuotes).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.quotes).toEqual({});
  });

  it('stays idle when isVisible is false', async () => {
    const { result } = renderHook(() => useWatchlistData(['AAPL'], false), {
      wrapper: makeWrapper(),
    });

    await new Promise((r) => setTimeout(r, 50));

    expect(mockFetchBulkQuotes).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });
});
