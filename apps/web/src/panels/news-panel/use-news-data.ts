/**
 * useNewsData — TanStack Query hook for symbol-filtered news articles.
 *
 * Fetches from GET /api/v1/news/{symbol}. Falls back to deterministic
 * mock articles on API error.
 *
 * Panel data discipline (CLAUDE.md Part XII):
 *   - `enabled: symbol.length > 0 && isVisible`
 *   - Mock fallback sets `source: 'mock'` for detection
 *   - `refetch` memoised via useCallback
 */
import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { NewsArticle, NewsResponse } from '@terminal/types';

import { fetchNewsBySymbol } from '@/lib/api/news.api';

/** News cache TTL — 5 minutes, matching NEWS_CACHE_TTL_SECONDS in .env.example. */
const NEWS_STALE_TIME_MS = 300_000;

type NewsResponseWithSource = NewsResponse & { source?: string };

/** Build deterministic mock articles for dev/demo mode. */
function buildMockNews(symbol: string): NewsResponseWithSource {
  const now = new Date();
  const articles: NewsArticle[] = [
    {
      id: `mock-${symbol}-1`,
      headline: `${symbol} reports record quarterly earnings, beats estimates`,
      summary: 'Revenue grew 12% year-over-year driven by strong product demand.',
      sourceName: 'Mock Financial Times',
      sourceUrl: null,
      publishedAt: new Date(now.getTime() - 3_600_000).toISOString(),
      symbols: [symbol],
    },
    {
      id: `mock-${symbol}-2`,
      headline: `Analysts raise ${symbol} price target amid positive outlook`,
      summary: 'Multiple investment banks raised their 12-month targets following guidance.',
      sourceName: 'Mock Reuters',
      sourceUrl: null,
      publishedAt: new Date(now.getTime() - 7_200_000).toISOString(),
      symbols: [symbol],
    },
    {
      id: `mock-${symbol}-3`,
      headline: `${symbol} announces strategic partnership`,
      summary: 'The deal is expected to accelerate growth in emerging markets.',
      sourceName: 'Mock Bloomberg',
      sourceUrl: null,
      publishedAt: new Date(now.getTime() - 10_800_000).toISOString(),
      symbols: [symbol],
    },
  ];
  return { articles, total: articles.length, page: 1, pageSize: 20, source: 'mock' };
}

export interface UseNewsDataResult {
  articles: NewsArticle[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isUsingMockData: boolean;
  refetch: () => Promise<void>;
}

/**
 * Fetches news articles for a symbol.
 *
 * @param symbol    - Ticker or coin id
 * @param isVisible - Pass false when panel hidden to pause polling
 */
export function useNewsData(symbol: string, isVisible = true): UseNewsDataResult {
  const query = useQuery<NewsResponseWithSource, Error>({
    queryKey: ['news', symbol],
    queryFn: async (): Promise<NewsResponseWithSource> => {
      try {
        return await fetchNewsBySymbol(symbol);
      } catch (err) {
        console.warn('[use-news-data] API unreachable — serving mock data', { symbol, err });
        return buildMockNews(symbol);
      }
    },
    enabled: symbol.length > 0 && isVisible,
    staleTime: NEWS_STALE_TIME_MS,
  });

  const { refetch: queryRefetch } = query;
  const refetch = useCallback(async (): Promise<void> => {
    await queryRefetch();
  }, [queryRefetch]);

  return {
    articles: query.data?.articles ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isUsingMockData: query.data?.source === 'mock',
    refetch,
  };
}
