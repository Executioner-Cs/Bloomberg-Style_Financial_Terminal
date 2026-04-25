/**
 * Unit tests for useMacroData.
 *
 * Covers: API happy path, mock-series fallback, isUsingMockData flag,
 * enabled-gate (empty seriesId / not visible).
 *
 * All network calls are mocked — no real HTTP (CLAUDE.md Part XI).
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ── Mock the API module ───────────────────────────────────────────────────────
vi.mock('@/lib/api/macro.api', () => ({
  fetchMacroSeries: vi.fn(),
}));

import { fetchMacroSeries } from '@/lib/api/macro.api';
import { useMacroData } from './use-macro-data';

const mockFetchMacro = fetchMacroSeries as Mock;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWrapper(): React.ComponentType<{ children: React.ReactNode }> {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }): React.ReactElement {
    return React.createElement(QueryClientProvider, { client }, children);
  }
  return Wrapper;
}

const LIVE_RESPONSE = {
  series_id: 'GDP',
  name: 'Gross Domestic Product',
  unit: 'Billions of Dollars',
  bars: [
    { ts: '2026-01-01T00:00:00.000Z', value: 28_000 },
    { ts: '2025-10-01T00:00:00.000Z', value: 27_800 },
  ],
  source: 'fred',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useMacroData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns series observations from API on happy path', async () => {
    mockFetchMacro.mockResolvedValue(LIVE_RESPONSE);

    const { result } = renderHook(() => useMacroData('GDP'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.series?.series_id).toBe('GDP');
    expect(result.current.series?.bars).toHaveLength(2);
    expect(result.current.isUsingMockData).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('falls back to mock series when fetchMacroSeries throws', async () => {
    mockFetchMacro.mockRejectedValue(new Error('API unavailable'));

    const { result } = renderHook(() => useMacroData('GDP'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Mock generates 60 observations
    expect(result.current.series?.bars).toHaveLength(60);
    expect(result.current.series?.series_id).toBe('GDP');
    expect(result.current.isUsingMockData).toBe(true);
    expect(result.current.isError).toBe(false);
  });

  it('uses known FRED series name for recognised seriesId', async () => {
    mockFetchMacro.mockRejectedValue(new Error('down'));

    const { result } = renderHook(() => useMacroData('FEDFUNDS'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.series?.name).toBe('Federal Funds Effective Rate');
  });

  it('stays idle when seriesId is empty string', async () => {
    const { result } = renderHook(() => useMacroData(''), {
      wrapper: makeWrapper(),
    });

    await new Promise((r) => setTimeout(r, 50));

    expect(mockFetchMacro).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.series).toBeNull();
  });

  it('stays idle when isVisible is false', async () => {
    const { result } = renderHook(() => useMacroData('GDP', false), {
      wrapper: makeWrapper(),
    });

    await new Promise((r) => setTimeout(r, 50));

    expect(mockFetchMacro).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });
});
