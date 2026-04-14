/**
 * useChartData — TanStack Query hook for OHLCV candlestick data.
 *
 * Fetches bars for a given symbol and timeframe, and derives the
 * lightweight-charts-compatible series from the raw API response.
 * staleTime is set at the QueryClient level (60s, CoinGecko ToS minimum);
 * individual queries inherit it. gcTime is extended to 5min so switching
 * timeframes quickly does not evict recently-loaded data.
 */
import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { UTCTimestamp } from 'lightweight-charts';
import type { OHLCVBar, Timeframe } from '@terminal/types';

import { fetchOHLCV } from '@/lib/api/market-data.api';

/** A candlestick bar in the shape lightweight-charts expects. */
export type ChartBar = {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
};

/** Converts an OHLCVBar from the API into a lightweight-charts ChartBar. */
function toChartBar(bar: OHLCVBar): ChartBar {
  return {
    // lightweight-charts requires Unix seconds as UTCTimestamp
    time: (new Date(bar.ts).getTime() / 1000) as UTCTimestamp,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
  };
}

type UseChartDataResult = {
  chartBars: ChartBar[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  /** Triggers a manual refetch. Returns a promise that resolves when the query settles. */
  refetch: () => Promise<void>;
};

/**
 * Fetch and transform OHLCV data for a given symbol and timeframe.
 *
 * @param symbol    - CoinGecko coin id, e.g. "bitcoin"
 * @param timeframe - Bar resolution, e.g. "1D"
 */
export function useChartData(symbol: string, timeframe: Timeframe): UseChartDataResult {
  const query = useQuery({
    queryKey: ['ohlcv', symbol, timeframe],
    queryFn: () => fetchOHLCV(symbol, timeframe),
    gcTime: 5 * 60_000,
    enabled: symbol.length > 0,
  });

  const chartBars = useMemo(() => (query.data?.bars ?? []).map(toChartBar), [query.data?.bars]);

  const refetch = useCallback(async (): Promise<void> => {
    await query.refetch();
  }, [query]);

  return {
    chartBars,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch,
  };
}
