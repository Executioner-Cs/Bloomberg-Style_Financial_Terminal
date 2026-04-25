/**
 * ChartPanel — TradingView Lightweight Charts candlestick panel.
 *
 * Renders an interactive OHLCV candlestick chart for a given symbol and
 * timeframe. Uses the lightweight-charts library (v4) via a ref-based
 * imperative API. The chart resizes via ResizeObserver and is cleaned up
 * properly on unmount to prevent memory leaks.
 *
 * Accessibility: aria-label on the container, timeframe buttons are
 * keyboard-navigable when the panel is active.
 */
import { useEffect, useRef, useState, useCallback, type JSX, useMemo } from 'react';
import { createChart, type IChartApi, type ISeriesApi } from 'lightweight-charts';
import type { Timeframe } from '@terminal/types';
import { PanelSkeleton } from '@terminal/ui-components';
import { PanelError } from '@terminal/ui-components';

import { useChartData } from './use-chart-data';
import { useRealtimePrice } from '@/hooks/use-realtime-price';

/** Timeframes available in the selector. Ordered from shortest to longest. */
const TIMEFRAME_OPTIONS: Timeframe[] = ['1D', '1W', '1M'];

/**
 * Terminal color palette used by lightweight-charts.
 *
 * These hex values are the resolved values of the corresponding CSS variables
 * (defined in apps/web/src/index.css). lightweight-charts does not accept CSS
 * variable references in its options object — it requires resolved hex values.
 * If the palette changes in index.css, update these constants to match.
 *
 * --color-bg-panel      → #14141c
 * --color-text-secondary → #9090a8
 * --color-border        → #2a2a3a
 * --color-border-focus  → #4a4a6a
 * --color-positive      → #22c55e
 * --color-negative      → #ef4444
 */
const CHART_THEME = {
  bgPanel: '#14141c',
  textSecondary: '#9090a8',
  border: '#2a2a3a',
  borderFocus: '#4a4a6a',
  positive: '#22c55e',
  negative: '#ef4444',
} as const;

type ChartPanelProps = {
  /** Unique panel instance ID — used for layout state management. */
  panelId: string;
  /** Whether this panel has keyboard focus. Enables shortcut registration. */
  isActive: boolean;
  /** Called when the panel's close button is clicked. */
  onClose: () => void;
  /** Symbol to chart — equity ticker or CoinGecko coin id. */
  symbol: string;
  /** Initial timeframe selection. Defaults to '1D'. */
  timeframe?: Timeframe;
  /**
   * Called when the user selects a different timeframe.
   * Used by the workspace adapter to persist timeframe in the layout store.
   */
  onTimeframeChange?: (tf: Timeframe) => void;
};

export function ChartPanel({
  panelId: _panelId,
  isActive,
  onClose,
  symbol,
  timeframe: initialTimeframe = '1D',
  onTimeframeChange,
}: ChartPanelProps): JSX.Element {
  const [timeframe, setTimeframe] = useState<Timeframe>(initialTimeframe);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  // Pass isActive so polling pauses when the panel is not focused/visible.
  // CLAUDE.md Part XII: "Pause TanStack Query polling when not visible in the layout."
  const { chartBars, isLoading, isError, error, refetch } = useChartData(
    symbol,
    timeframe,
    isActive,
  );

  // Real-time last-bar update: each WS tick updates the close of the current candle.
  // Only active on the 1D timeframe (intraday tick = within the current day's bar).
  const { price: rtPrice } = useRealtimePrice(timeframe === '1D' ? symbol : '');

  /** Void-wrapped refetch for use as a callback where Promise return is unexpected. */
  const handleRetry = useCallback((): void => {
    void refetch();
  }, [refetch]);

  // Initialise chart on mount, clean up on unmount.
  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { color: CHART_THEME.bgPanel },
        textColor: CHART_THEME.textSecondary,
      },
      grid: {
        vertLines: { color: CHART_THEME.border },
        horzLines: { color: CHART_THEME.border },
      },
      crosshair: {
        vertLine: { color: CHART_THEME.borderFocus },
        horzLine: { color: CHART_THEME.borderFocus },
      },
      rightPriceScale: {
        borderColor: CHART_THEME.border,
      },
      timeScale: {
        borderColor: CHART_THEME.border,
        timeVisible: true,
      },
    });

    const series = chart.addCandlestickSeries({
      upColor: CHART_THEME.positive,
      downColor: CHART_THEME.negative,
      borderUpColor: CHART_THEME.positive,
      borderDownColor: CHART_THEME.negative,
      wickUpColor: CHART_THEME.positive,
      wickDownColor: CHART_THEME.negative,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    // Resize chart when container dimensions change.
    const resizeObserver = new ResizeObserver((entries): void => {
      const entry = entries[0];
      if (entry !== undefined) {
        chart.applyOptions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    resizeObserver.observe(container);

    return (): void => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Update series data whenever bars change.
  useEffect(() => {
    const series = seriesRef.current;
    if (series === null || chartBars.length === 0) return;
    series.setData(chartBars);
    chartRef.current?.timeScale().fitContent();
  }, [chartBars]);

  // Real-time last-bar update — applies each WS tick to the current day's candle.
  // `series.update()` merges into the existing bar when the time matches.
  useEffect(() => {
    const series = seriesRef.current;
    if (series === null || rtPrice === null || rtPrice === undefined) return;

    const lastBar = chartBars.at(-1);
    if (lastBar === undefined) return;

    series.update({
      time: lastBar.time,
      open: lastBar.open,
      high: Math.max(lastBar.high, rtPrice.price),
      low: Math.min(lastBar.low, rtPrice.price),
      close: rtPrice.price,
    });
  }, [rtPrice, chartBars]);

  const handleTimeframeChange = useCallback(
    (tf: Timeframe) => {
      setTimeframe(tf);
      onTimeframeChange?.(tf);
    },
    [onTimeframeChange],
  );

  // Keyboard shortcuts — only active when this panel has focus (isActive).
  // CLAUDE.md Part XVI: "Every panel must be fully keyboard-navigable.
  // Register shortcuts with useKeyboardShortcuts when isActive === true."
  //
  // Timeframe shortcuts: D → 1D, W → 1W, M → 1M (single-key, no modifier).
  // These follow Bloomberg Terminal convention for timeframe selection.
  const handleTimeframeShortcut = useMemo(
    () => ({
      d: '1D' as Timeframe,
      w: '1W' as Timeframe,
      m: '1M' as Timeframe,
    }),
    [],
  );

  useEffect(() => {
    if (!isActive) return;

    function onKeyDown(event: KeyboardEvent): void {
      // Ignore shortcuts when the user is typing in an input/textarea.
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      const tf = handleTimeframeShortcut[event.key as keyof typeof handleTimeframeShortcut];
      if (tf !== undefined) {
        handleTimeframeChange(tf);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return (): void => window.removeEventListener('keydown', onKeyDown);
  }, [isActive, handleTimeframeChange, handleTimeframeShortcut]);

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-panel)] border border-[var(--color-border)]">
      {/* Header */}
      <div className="flex items-center justify-between py-1.5 px-2.5 border-b border-[var(--color-border)] shrink-0">
        <span className="text-[12px] font-semibold text-[var(--color-accent)] tracking-wider">
          {symbol.toUpperCase()}
        </span>

        {/* Timeframe selector */}
        <div className="flex gap-1 items-center">
          {TIMEFRAME_OPTIONS.map((tf) => (
            <button
              key={tf}
              type="button"
              aria-pressed={timeframe === tf}
              aria-label={`Select ${tf} timeframe`}
              onClick={() => handleTimeframeChange(tf)}
              className={`py-0.5 px-2 text-[11px] cursor-pointer tracking-wider border rounded-[2px] ${
                timeframe === tf
                  ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-black'
                  : 'bg-transparent border-[var(--color-border)] text-[var(--color-text-secondary)]'
              }`}
            >
              {tf}
            </button>
          ))}

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chart panel"
            className="ml-2 py-0.5 px-1.5 bg-transparent border border-[var(--color-border)] rounded-[2px] text-[var(--color-text-muted)] text-[11px] cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Chart area */}
      <div className="flex-1 relative overflow-hidden">
        {isLoading && <PanelSkeleton rows={8} />}
        {isError && error !== null && <PanelError error={error} onRetry={handleRetry} />}
        {/*
         * The container div always remains mounted so lightweight-charts has a DOM
         * element to attach to. Hidden (not removed) while loading or erroring.
         */}
        <div
          ref={containerRef}
          aria-label={`Price chart for ${symbol}`}
          className={`w-full h-full ${isLoading || isError ? 'invisible' : 'visible'}`}
        />
      </div>
    </div>
  );
}
