/**
 * useQuoteData — TanStack Query hook for a single symbol quote.
 *
 * Fetches the real-time quote from GET /api/v1/market-data/{symbol}/quote.
 * Falls back to a deterministic mock quote on API error so development
 * works without a running backend.
 *
 * Panel data discipline (CLAUDE.md Part XII):
 *   - `enabled: symbol.length > 0 && isVisible` — pauses polling when hidden.
 *   - Mock fallback sets `source: 'mock'` so callers can show an indicator.
 *   - `refetch` is memoised via useCallback to avoid unnecessary re-renders.
 */
import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Quote } from '@terminal/types';

import { fetchQuote } from '@/lib/api/market-data.api';

/** Quote with an optional source tag for mock-detection. */
type QuoteWithSource = Quote & { source?: string };

/** Stale time for quote data — 30 s between background re-fetches. */
const QUOTE_STALE_TIME_MS = 30_000;

/** Refetch interval for live quotes — 60 s (QUOTE_CACHE_TTL_SECONDS in .env.example). */
const QUOTE_REFETCH_INTERVAL_MS = 60_000;

/** Build a deterministic mock quote for dev/demo mode. */
function buildMockQuote(symbol: string): QuoteWithSource {
  const seed = symbol.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const price = 100 + (seed % 900);
  const change = ((seed % 21) - 10) / 100; // −0.10 … +0.10
  return {
    symbol,
    price,
    change_24h: change,
    volume_24h: (seed % 500) * 1_000_000,
    ts: new Date().toISOString(),
    source: 'mock',
  };
}

export interface UseQuoteDataResult {
  quote: QuoteWithSource | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isUsingMockData: boolean;
  refetch: () => Promise<void>;
}

/**
 * Fetches a real-time quote for the given symbol.
 *
 * @param symbol    - Ticker or coin id
 * @param isVisible - Pass false when the panel is hidden to pause polling
 */
export function useQuoteData(symbol: string, isVisible = true): UseQuoteDataResult {
  const query = useQuery<QuoteWithSource, Error>({
    queryKey: ['quote', symbol],
    queryFn: async (): Promise<QuoteWithSource> => {
      try {
        return await fetchQuote(symbol);
      } catch (err) {
        console.warn('[use-quote-data] API unreachable — serving mock data', { symbol, err });
        return buildMockQuote(symbol);
      }
    },
    enabled: symbol.length > 0 && isVisible,
    staleTime: QUOTE_STALE_TIME_MS,
    refetchInterval: QUOTE_REFETCH_INTERVAL_MS,
  });

  const { refetch: queryRefetch } = query;
  const refetch = useCallback(async (): Promise<void> => {
    await queryRefetch();
  }, [queryRefetch]);

  return {
    quote: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isUsingMockData: query.data?.source === 'mock',
    refetch,
  };
}
