/**
 * useFilingsData — TanStack Query hook for SEC EDGAR filings.
 *
 * Fetches from GET /api/v1/filings/{symbol} with an optional form_type filter.
 * ADR-009: 24-hour cache TTL — filings publish quarterly.
 * Falls back to mock filings on API error.
 *
 * Panel data discipline (CLAUDE.md Part XII):
 *   - `enabled: symbol.length > 0 && isVisible`
 *   - Mock fallback sets `source: 'mock'`
 *   - `refetch` memoised via useCallback
 */
import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Filing, FilingsResponse } from '@terminal/types';

import { fetchFilings, type FilingFormType } from '@/lib/api/filings.api';

/** Stale time for filings — 24 hours (FILINGS_CACHE_TTL_SECONDS in .env.example). */
const FILINGS_STALE_TIME_MS = 86_400_000;

/** Number of filings to fetch per request. */
const FILINGS_FETCH_LIMIT = 30;

type FilingsResponseWithSource = FilingsResponse & { source?: string };

/** Build deterministic mock filings for dev/demo mode. */
function buildMockFilings(symbol: string, formType: FilingFormType): FilingsResponseWithSource {
  const forms: string[] = formType === 'ALL' ? ['10-K', '10-Q', '8-K'] : [formType];
  const now = new Date();
  const filings: Filing[] = forms.flatMap((form, fi) =>
    Array.from({ length: 3 }, (_, i) => ({
      symbol,
      form_type: form,
      filed_at: new Date(now.getTime() - (fi * 3 + i + 1) * 30 * 86_400_000).toISOString(),
      period_of_report: `${now.getFullYear() - Math.floor((fi * 3 + i) / 4)}-${String(12 - ((fi * 3 + i) % 4) * 3).padStart(2, '0')}-31`,
      accession_number: `0000320193-${now.getFullYear() - fi}-${String(i + 1).padStart(6, '0')}`,
      filing_url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${symbol}`,
      description: `${form} filing for ${symbol} - Q${4 - (i % 4)} ${now.getFullYear() - fi}`,
    })),
  );
  return {
    symbol,
    filings: filings.sort((a, b) => b.filed_at.localeCompare(a.filed_at)),
    total: filings.length,
    source: 'mock',
  };
}

export interface UseFilingsDataResult {
  filings: Filing[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isUsingMockData: boolean;
  refetch: () => Promise<void>;
}

/**
 * Fetches SEC EDGAR filings for a symbol.
 *
 * @param symbol    - Equity ticker, e.g. "AAPL"
 * @param formType  - Form type filter ('ALL' | '10-K' | '10-Q' | '8-K')
 * @param isVisible - Pass false when panel hidden to pause polling
 */
export function useFilingsData(
  symbol: string,
  formType: FilingFormType,
  isVisible = true,
): UseFilingsDataResult {
  const query = useQuery<FilingsResponseWithSource, Error>({
    queryKey: ['filings', symbol, formType],
    queryFn: async (): Promise<FilingsResponseWithSource> => {
      try {
        return await fetchFilings(symbol, formType, FILINGS_FETCH_LIMIT);
      } catch (err) {
        console.warn('[use-filings-data] API unreachable — serving mock data', {
          symbol,
          formType,
          err,
        });
        return buildMockFilings(symbol, formType);
      }
    },
    enabled: symbol.length > 0 && isVisible,
    staleTime: FILINGS_STALE_TIME_MS,
  });

  const { refetch: queryRefetch } = query;
  const refetch = useCallback(async (): Promise<void> => {
    await queryRefetch();
  }, [queryRefetch]);

  return {
    filings: query.data?.filings ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isUsingMockData: query.data?.source === 'mock',
    refetch,
  };
}
