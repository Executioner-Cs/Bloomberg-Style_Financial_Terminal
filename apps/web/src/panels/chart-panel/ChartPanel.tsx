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
import { useEffect, useRef, useState, useCallback, type JSX } from 'react';
import { createChart, type IChartApi, type ISeriesApi } from 'lightweight-charts';
import type { Timeframe } from '@terminal/types';
import { PanelSkeleton } from '@terminal/ui-components';
import { PanelError } from '@terminal/ui-components';

import { useChartData } from './use-chart-data';

/** Timeframes available in the selector. Ordered from shortest to longest. */
const TIMEFRAME_OPTIONS: Timeframe[] = ['1D', '1W', '1M'];

type ChartPanelProps = {
  /** Unique panel instance ID — used for layout state management. */
  panelId: string;
  /** Whether this panel has keyboard focus. Enables shortcut registration. */
  isActive: boolean;
  /** Called when the panel's close button is clicked. */
  onClose: () => void;
  /** CoinGecko coin id, e.g. "bitcoin". */
  symbol: string;
  /** Initial timeframe selection. Defaults to '1D'. */
  timeframe?: Timeframe;
};

export function ChartPanel({
  panelId: _panelId, // reserved for layout state management — not yet used
  isActive: _isActive, // reserved for keyboard shortcut activation — not yet used
  onClose,
  symbol,
  timeframe: initialTimeframe = '1D',
}: ChartPanelProps): JSX.Element {
  const [timeframe, setTimeframe] = useState<Timeframe>(initialTimeframe);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  const { chartBars, isLoading, isError, error, refetch } = useChartData(symbol, timeframe);

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
        background: { color: '#14141c' }, // --color-bg-panel
        textColor: '#9090a8', // --color-text-secondary
      },
      grid: {
        vertLines: { color: '#2a2a3a' }, // --color-border
        horzLines: { color: '#2a2a3a' },
      },
      crosshair: {
        vertLine: { color: '#4a4a6a' }, // --color-border-focus
        horzLine: { color: '#4a4a6a' },
      },
      rightPriceScale: {
        borderColor: '#2a2a3a',
      },
      timeScale: {
        borderColor: '#2a2a3a',
        timeVisible: true,
      },
    });

    const series = chart.addCandlestickSeries({
      upColor: '#22c55e', // --color-positive
      downColor: '#ef4444', // --color-negative
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
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

  const handleTimeframeChange = useCallback((tf: Timeframe) => {
    setTimeframe(tf);
  }, []);

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
