/**
 * ChartPanel workspace app registration.
 *
 * Wraps the visual ChartPanel component in a thin workspace adapter that:
 *   1. Translates PanelProps<ChartPanelProps> → ChartPanel's own prop shape.
 *   2. Subscribes to activeSymbol from the terminal-context store so the chart
 *      follows the symbol-linking bus (plan ref: D4).
 *   3. Persists timeframe changes back to the workspace store via updateProps.
 *
 * The visual ChartPanel remains testable with simple props — it knows nothing
 * about the workspace. All workspace glue lives here in app.ts.
 *
 * Plan ref: C16, D6.
 */

import { type JSX } from 'react';
import { BarChart2 } from 'lucide-react';
import type { Timeframe } from '@terminal/types';

import { useTerminalContextStore } from '@/workspace/stores/terminal-context.store';
import type { PanelApp, PanelProps } from '@/workspace/types';

import { ChartPanel } from './ChartPanel';

// ------------------------------------------------------------------
// Panel props shape
// ------------------------------------------------------------------

/** Serialisable per-instance state for a ChartPanel tile. */
export interface ChartPanelProps {
  /** Equity ticker or CoinGecko coin id shown in this instance. */
  symbol: string;
  /** Active bar resolution for this instance. */
  timeframe: Timeframe;
}

/** Default symbol for new chart panels — most-recognised equity in mock data. */
const DEFAULT_CHART_SYMBOL = 'AAPL';

/**
 * Type guard for deserialised panel props.
 *
 * NEVER use `as` on JSON.parse output — the shape is unknown until validated.
 * CLAUDE.md Part VI: "NEVER use `as` unless you own the data shape AND add a
 * runtime assertion."
 */
function isChartPanelProps(v: unknown): v is Partial<ChartPanelProps> {
  if (typeof v !== 'object' || v === null) return false;
  const obj = v as Record<string, unknown>;
  if ('symbol' in obj && typeof obj['symbol'] !== 'string') return false;
  if ('timeframe' in obj && typeof obj['timeframe'] !== 'string') return false;
  return true;
}

/** Default timeframe for new chart panels — daily bars are the most common view. */
const DEFAULT_CHART_TIMEFRAME: Timeframe = '1D';

// ------------------------------------------------------------------
// Workspace adapter component
// ------------------------------------------------------------------

/**
 * Thin wrapper that adapts PanelProps<ChartPanelProps> to ChartPanel's own
 * prop interface and wires the symbol-linking bus subscription.
 */
function ChartPanelWorkspace({
  panelId,
  isActive,
  onClose,
  props,
  updateProps,
}: PanelProps<ChartPanelProps>): JSX.Element {
  // Selector — re-renders only when activeSymbol changes, not on any other
  // terminal-context state change (CLAUDE.md Part XII panel data discipline).
  const activeSymbol = useTerminalContextStore((s) => s.activeSymbol);

  // When the symbol bus has an active symbol, it overrides the panel's own
  // stored symbol (D4). Falls back to persisted symbol when bus is idle.
  const symbol = activeSymbol ?? props.symbol;

  return (
    <ChartPanel
      panelId={panelId}
      isActive={isActive}
      onClose={onClose}
      symbol={symbol}
      timeframe={props.timeframe}
      onTimeframeChange={(tf) => updateProps({ timeframe: tf })}
    />
  );
}

// ------------------------------------------------------------------
// PanelApp registration record
// ------------------------------------------------------------------

export const chartPanelApp: PanelApp<ChartPanelProps> = {
  id: 'chart',
  displayName: 'Chart',
  icon: BarChart2,
  defaultProps: { symbol: DEFAULT_CHART_SYMBOL, timeframe: DEFAULT_CHART_TIMEFRAME },
  linkable: true,
  serialize: (props): string => JSON.stringify(props),
  deserialize: (raw): ChartPanelProps => {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isChartPanelProps(parsed)) {
        console.warn('[chart-panel] Corrupted stored props — using defaults', parsed);
        return { symbol: DEFAULT_CHART_SYMBOL, timeframe: DEFAULT_CHART_TIMEFRAME };
      }
      return {
        symbol: parsed.symbol ?? DEFAULT_CHART_SYMBOL,
        timeframe: parsed.timeframe ?? DEFAULT_CHART_TIMEFRAME,
      };
    } catch {
      return { symbol: DEFAULT_CHART_SYMBOL, timeframe: DEFAULT_CHART_TIMEFRAME };
    }
  },
  Component: ChartPanelWorkspace,
};
