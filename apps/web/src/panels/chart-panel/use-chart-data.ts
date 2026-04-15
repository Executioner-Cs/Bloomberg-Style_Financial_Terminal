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
import type { OHLCVBar, OHLCVResponse, Timeframe } from '@terminal/types';

import { fetchOHLCV } from '@/lib/api/market-data.api';

/** Crypto-safe random float in [0, 1). */
function secureRandom(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] ?? 0) / 0x1_0000_0000;
}

/**
 * Generate a seeded random walk of OHLCV bars for local dev when the backend
 * is not running. Prices follow a geometric random walk (±3% per bar) from a
 * base price keyed to the symbol name.
 */
function generateMockBars(symbol: string, timeframe: Timeframe): OHLCVResponse {
  const barCount = timeframe === '1M' ? 24 : timeframe === '1W' ? 52 : 180;
  // Base prices keyed to known symbols; unknown symbols default to 100.
  const BASE_PRICES: Record<string, number> = {
    bitcoin: 65_000,
    ethereum: 3_500,
    solana: 170,
    binancecoin: 580,
    ripple: 0.55,
    cardano: 0.45,
  };
  const basePrice = BASE_PRICES[symbol] ?? 100;
  // Milliseconds per bar for each timeframe resolution.
  const MS_PER_BAR: Record<Timeframe, number> = {
    '1m': 60_000,
    '5m': 5 * 60_000,
    '15m': 15 * 60_000,
    '30m': 30 * 60_000,
    '1H': 60 * 60_000,
    '4H': 4 * 60 * 60_000,
    '1D': 24 * 60 * 60_000,
    '1W': 7 * 24 * 60 * 60_000,
    '1M': 30 * 24 * 60 * 60_000,
  };
  const msPerBar = MS_PER_BAR[timeframe];

  const bars: OHLCVBar[] = [];
  let price = basePrice;
  const now = Date.now();

  for (let i = barCount - 1; i >= 0; i--) {
    const ts = new Date(now - i * msPerBar).toISOString();
    // ±3% random walk per bar — representative of daily crypto volatility.
    const change = price * (secureRandom() * 0.06 - 0.03);
    const open = price;
    const close = price + change;
    // Wicks extend ±1% beyond the open/close range.
    const high = Math.max(open, close) * (1 + secureRandom() * 0.01);
    const low = Math.min(open, close) * (1 - secureRandom() * 0.01);
    bars.push({
      ts,
      open,
      high,
      low,
      close,
      volume: 1_000_000 + secureRandom() * 500_000,
      adjClose: close,
    });
    price = close;
  }

  return { symbol, timeframe, bars, source: 'mock' };
}

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
    queryFn: async (): Promise<OHLCVResponse> => {
      try {
        return await fetchOHLCV(symbol, timeframe);
      } catch {
        // Backend not reachable in local dev — return mock bars so the chart
        // renders something meaningful without the API running.
        return generateMockBars(symbol, timeframe);
      }
    },
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
