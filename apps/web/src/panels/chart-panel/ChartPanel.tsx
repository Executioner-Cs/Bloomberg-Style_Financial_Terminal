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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--color-bg-panel)',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--color-accent)',
            letterSpacing: '0.05em',
          }}
        >
          {symbol.toUpperCase()}
        </span>

        {/* Timeframe selector */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {TIMEFRAME_OPTIONS.map((tf) => (
            <button
              key={tf}
              type="button"
              aria-pressed={timeframe === tf}
              aria-label={`Select ${tf} timeframe`}
              onClick={() => handleTimeframeChange(tf)}
              style={{
                padding: '2px 8px',
                background: timeframe === tf ? 'var(--color-accent)' : 'transparent',
                border: `1px solid ${timeframe === tf ? 'var(--color-accent)' : 'var(--color-border)'}`,
                borderRadius: '2px',
                color: timeframe === tf ? '#000' : 'var(--color-text-secondary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                cursor: 'pointer',
                letterSpacing: '0.05em',
              }}
            >
              {tf}
            </button>
          ))}

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chart panel"
            style={{
              marginLeft: '8px',
              padding: '2px 6px',
              background: 'transparent',
              border: '1px solid var(--color-border)',
              borderRadius: '2px',
              color: 'var(--color-text-muted)',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Chart area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {isLoading && <PanelSkeleton rows={8} />}
        {isError && error !== null && <PanelError error={error} onRetry={handleRetry} />}
        <div
          ref={containerRef}
          aria-label={`Price chart for ${symbol}`}
          style={{
            width: '100%',
            height: '100%',
            // Hide the container while loading/erroring so the chart DOM
            // element still exists for the chart to mount into.
            visibility: isLoading || isError ? 'hidden' : 'visible',
          }}
        />
      </div>
    </div>
  );
}
