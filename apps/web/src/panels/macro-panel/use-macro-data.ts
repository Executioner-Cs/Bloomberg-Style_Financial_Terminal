/**
 * useMacroData — TanStack Query hook for a single FRED macro series.
 *
 * Fetches observations from GET /api/v1/macro/{series_id}.
 * Falls back to a deterministic mock series on API error.
 *
 * Panel data discipline (CLAUDE.md Part XII):
 *   - `enabled: seriesId.length > 0 && isVisible`
 *   - Mock fallback sets `source: 'mock'` so callers can show an indicator
 *   - `refetch` memoised via useCallback
 */
import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { MacroSeriesResponse } from '@terminal/types';

import { fetchMacroSeries } from '@/lib/api/macro.api';

/** Number of observations to request per series. */
const MACRO_OBSERVATION_LIMIT = 60;

/** Stale time for macro data — 1 hour (FRED updates weekly/monthly). */
const MACRO_STALE_TIME_MS = 3_600_000;

type MacroSeriesWithSource = MacroSeriesResponse & { source: string };

/** FRED series names for the 5 default series (ADR-006 mock data). */
const MOCK_SERIES_NAMES: Record<string, string> = {
  GDP: 'Gross Domestic Product',
  CPIAUCSL: 'Consumer Price Index for All Urban Consumers',
  FEDFUNDS: 'Federal Funds Effective Rate',
  DGS10: '10-Year Treasury Constant Maturity Rate',
  UNRATE: 'Unemployment Rate',
};

const MOCK_SERIES_UNITS: Record<string, string> = {
  GDP: 'Billions of Dollars',
  CPIAUCSL: 'Index 1982-1984=100',
  FEDFUNDS: 'Percent',
  DGS10: 'Percent',
  UNRATE: 'Percent',
};

/** Build a deterministic mock series for dev/demo mode. */
function buildMockSeries(seriesId: string): MacroSeriesWithSource {
  const seed = seriesId.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const bars = Array.from({ length: MACRO_OBSERVATION_LIMIT }, (_, i) => {
    const date = new Date(2021, i % 12, 1);
    return {
      ts: date.toISOString(),
      value: 100 + (seed % 50) + i * 0.3 + Math.sin(i * 0.5) * 5,
    };
  });
  return {
    series_id: seriesId,
    name: MOCK_SERIES_NAMES[seriesId] ?? seriesId,
    unit: MOCK_SERIES_UNITS[seriesId] ?? 'Units',
    bars,
    source: 'mock',
  };
}

export interface UseMacroDataResult {
  series: MacroSeriesWithSource | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isUsingMockData: boolean;
  refetch: () => Promise<void>;
}

/**
 * Fetches observations for a FRED macro series.
 *
 * @param seriesId  - FRED series ID, e.g. 'GDP', 'CPIAUCSL'
 * @param isVisible - Pass false when panel hidden to pause polling
 */
export function useMacroData(seriesId: string, isVisible = true): UseMacroDataResult {
  const query = useQuery<MacroSeriesWithSource, Error>({
    queryKey: ['macro', seriesId],
    queryFn: async (): Promise<MacroSeriesWithSource> => {
      try {
        const resp = await fetchMacroSeries(seriesId, MACRO_OBSERVATION_LIMIT);
        return { ...resp, source: resp.source };
      } catch (err) {
        console.warn('[use-macro-data] API unreachable — serving mock data', { seriesId, err });
        return buildMockSeries(seriesId);
      }
    },
    enabled: seriesId.length > 0 && isVisible,
    staleTime: MACRO_STALE_TIME_MS,
  });

  const { refetch: queryRefetch } = query;
  const refetch = useCallback(async (): Promise<void> => {
    await queryRefetch();
  }, [queryRefetch]);

  return {
    series: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isUsingMockData: query.data?.source === 'mock',
    refetch,
  };
}
