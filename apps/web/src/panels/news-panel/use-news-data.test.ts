/**
 * Unit tests for useNewsData.
 *
 * Covers: API happy path, 3-article mock fallback, isUsingMockData flag,
 * enabled-gate (empty symbol / not visible).
 *
 * All network calls are mocked — no real HTTP (CLAUDE.md Part XI).
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ── Mock the API module ───────────────────────────────────────────────────────
vi.mock('@/lib/api/news.api', () => ({
  fetchNewsBySymbol: vi.fn(),
}));

import { fetchNewsBySymbol } from '@/lib/api/news.api';
import { useNewsData } from './use-news-data';

const mockFetchNews = fetchNewsBySymbol as Mock;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWrapper(): React.ComponentType<{ children: React.ReactNode }> {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }): React.ReactElement {
    return React.createElement(QueryClientProvider, { client }, children);
  }
  return Wrapper;
}

const LIVE_ARTICLE = {
  id: 'article-1',
  headline: 'AAPL hits record high',
  summary: 'Shares rose 3% on earnings beat.',
  sourceName: 'Reuters',
  sourceUrl: 'https://reuters.com',
  publishedAt: '2026-04-18T10:00:00.000Z',
  symbols: ['AAPL'],
};

const LIVE_RESPONSE = {
  articles: [LIVE_ARTICLE],
  total: 1,
  page: 1,
  pageSize: 20,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useNewsData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns articles array from API on happy path', async () => {
    mockFetchNews.mockResolvedValue(LIVE_RESPONSE);

    const { result } = renderHook(() => useNewsData('AAPL'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.articles).toHaveLength(1);
    expect(result.current.articles[0]?.headline).toBe('AAPL hits record high');
    expect(result.current.total).toBe(1);
    expect(result.current.isUsingMockData).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it('falls back to 3 mock articles when fetchNewsBySymbol throws', async () => {
    mockFetchNews.mockRejectedValue(new Error('503'));

    const { result } = renderHook(() => useNewsData('AAPL'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.articles).toHaveLength(3);
    expect(result.current.isUsingMockData).toBe(true);
    expect(result.current.isError).toBe(false);
  });

  it('sets isUsingMockData false for live API data', async () => {
    mockFetchNews.mockResolvedValue(LIVE_RESPONSE);

    const { result } = renderHook(() => useNewsData('AAPL'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isUsingMockData).toBe(false);
  });

  it('stays idle when symbol is empty string', async () => {
    const { result } = renderHook(() => useNewsData(''), {
      wrapper: makeWrapper(),
    });

    await new Promise((r) => setTimeout(r, 50));

    expect(mockFetchNews).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.articles).toEqual([]);
  });

  it('stays idle when isVisible is false', async () => {
    const { result } = renderHook(() => useNewsData('AAPL', false), {
      wrapper: makeWrapper(),
    });

    await new Promise((r) => setTimeout(r, 50));

    expect(mockFetchNews).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });
});
