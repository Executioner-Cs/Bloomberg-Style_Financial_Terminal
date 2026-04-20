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
 * Number of mock bars to generate per timeframe for dev/demo mode.
 * Values represent meaningful historical windows for each resolution:
 * 180 daily bars ≈ 6 months, 52 weekly bars ≈ 1 year, 24 monthly bars ≈ 2 years.
 */
const MOCK_BAR_COUNT: Record<Timeframe, number> = {
  '1m': 180,
  '5m': 180,
  '15m': 180,
  '30m': 180,
  '1H': 180,
  '4H': 90,
  '1D': 180,
  '1W': 52,
  '1M': 24,
} as const;

/**
 * Generate a seeded random walk of OHLCV bars for local dev when the backend
 * is not running. Prices follow a geometric random walk (±3% per bar) from a
 * base price keyed to the symbol name.
 */
function generateMockBars(symbol: string, timeframe: Timeframe): OHLCVResponse {
  const barCount = MOCK_BAR_COUNT[timeframe];
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
  /**
   * True when the chart is rendering locally-generated mock data because the
   * backend was unreachable. Use to show a "DEMO" indicator in the panel UI.
   */
  isUsingMockData: boolean;
  /** Triggers a manual refetch. Returns a promise that resolves when the query settles. */
  refetch: () => Promise<void>;
};

/**
 * Fetch and transform OHLCV data for a given symbol and timeframe.
 *
 * Polling is paused when the panel is not visible (isVisible = false) per
 * CLAUDE.md Part XII: "Pause TanStack Query polling when not visible in the
 * layout (enabled: isVisible on every useQuery inside a panel)."
 *
 * @param symbol    - CoinGecko coin id, e.g. "bitcoin"
 * @param timeframe - Bar resolution, e.g. "1D"
 * @param isVisible - Whether this panel is currently mounted and visible in the
 *                    workspace layout. Defaults to true so the hook works outside
 *                    a panel context (e.g. tests). Pass the panel's isActive prop.
 */
export function useChartData(
  symbol: string,
  timeframe: Timeframe,
  isVisible: boolean = true,
): UseChartDataResult {
  const query = useQuery({
    queryKey: ['ohlcv', symbol, timeframe],
    queryFn: async (): Promise<OHLCVResponse> => {
      try {
        return await fetchOHLCV(symbol, timeframe);
      } catch (err) {
        // Backend not reachable — serve mock bars so the chart remains usable
        // in local dev without the API running. Log so the dev knows this is
        // mock data, not live market data.
        console.warn('[use-chart-data] API unreachable — serving mock data', {
          symbol,
          timeframe,
          err,
        });
        return generateMockBars(symbol, timeframe);
      }
    },
    gcTime: 5 * 60_000,
    // Disable query entirely when the symbol is empty OR when the panel is not
    // visible — prevents background polling from wasting network and CPU.
    enabled: symbol.length > 0 && isVisible,
  });

  const chartBars = useMemo(() => (query.data?.bars ?? []).map(toChartBar), [query.data?.bars]);

  // Stable refetch reference — useCallback with [query] would re-create on every
  // render since query is a new object each render. query.refetch is stable.
  const refetch = useCallback(async (): Promise<void> => {
    await query.refetch();
  }, [query.refetch]);

  return {
    chartBars,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    // OHLCVResponse.source === 'mock' when the backend was unreachable.
    isUsingMockData: query.data?.source === 'mock',
    refetch,
  };
}
