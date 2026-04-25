/**
 * useWatchlistData — TanStack Query hook for bulk quote data.
 *
 * Fetches live quotes for all symbols in the watchlist via the
 * bulk-quotes endpoint. Falls back to deterministic mock data on
 * API error.
 *
 * Panel data discipline (CLAUDE.md Part XII):
 *   - `enabled: symbols.length > 0 && isVisible`
 *   - Mock fallback sets `source: 'mock'` for each quote
 *   - `refetch` memoised via useCallback
 */
import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Quote } from '@terminal/types';

import { fetchBulkQuotes } from '@/lib/api/market-data.api';

type QuoteWithSource = Quote & { source?: string };

/** Bulk quotes response with optional mock tag per entry. */
export type WatchlistQuoteMap = Record<string, QuoteWithSource>;

/** Stale time for watchlist data — 30 s between background re-fetches. */
const WATCHLIST_STALE_TIME_MS = 30_000;

/** Refetch interval — 60 s matches QUOTE_CACHE_TTL_SECONDS. */
const WATCHLIST_REFETCH_INTERVAL_MS = 60_000;

/** Build deterministic mock quote for a symbol. */
function buildMockQuote(symbol: string): QuoteWithSource {
  const seed = symbol.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const price = 50 + (seed % 950);
  const change = ((seed % 21) - 10) / 100;
  return {
    symbol,
    price,
    change_24h: change,
    volume_24h: (seed % 500) * 1_000_000,
    ts: new Date().toISOString(),
    source: 'mock',
  };
}

export interface UseWatchlistDataResult {
  quotes: WatchlistQuoteMap;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isUsingMockData: boolean;
  refetch: () => Promise<void>;
}

/**
 * Fetches bulk quotes for a list of symbols.
 *
 * @param symbols   - Array of tickers/coin ids to quote
 * @param isVisible - Pass false when panel hidden to pause polling
 */
export function useWatchlistData(symbols: string[], isVisible = true): UseWatchlistDataResult {
  const query = useQuery<WatchlistQuoteMap, Error>({
    queryKey: ['watchlist-quotes', symbols.slice().sort().join(',')],
    queryFn: async (): Promise<WatchlistQuoteMap> => {
      try {
        const resp = await fetchBulkQuotes(symbols);
        return resp.quotes as WatchlistQuoteMap;
      } catch (err) {
        console.warn('[use-watchlist-data] API unreachable — serving mock data', { symbols, err });
        const mockMap: WatchlistQuoteMap = {};
        for (const sym of symbols) mockMap[sym] = buildMockQuote(sym);
        return mockMap;
      }
    },
    enabled: symbols.length > 0 && isVisible,
    staleTime: WATCHLIST_STALE_TIME_MS,
    refetchInterval: WATCHLIST_REFETCH_INTERVAL_MS,
  });

  const { refetch: queryRefetch } = query;
  const refetch = useCallback(async (): Promise<void> => {
    await queryRefetch();
  }, [queryRefetch]);

  const isUsingMockData =
    query.data !== undefined && Object.values(query.data).some((q) => q.source === 'mock');

  return {
    quotes: query.data ?? {},
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isUsingMockData,
    refetch,
  };
}
