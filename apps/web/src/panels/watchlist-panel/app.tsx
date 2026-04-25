/**
 * WatchlistPanel workspace app registration.
 *
 * linkable: false — the watchlist IS the symbol source, not a consumer.
 * Row clicks set activeSymbol on the terminal-context bus so linked
 * panels (Chart, Quote, News, Filings) follow.
 */
import { type JSX } from 'react';
import { List } from 'lucide-react';

import { useTerminalContextStore } from '@/workspace/stores/terminal-context.store';
import type { PanelApp, PanelProps } from '@/workspace/types';

import { WatchlistPanel } from './WatchlistPanel';

/** Default symbols for a new watchlist panel. */
const DEFAULT_WATCHLIST_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA'];

/** Serialisable per-instance state for a WatchlistPanel tile. */
export interface WatchlistPanelProps {
  /** Ordered list of symbols in this watchlist instance. */
  symbols: string[];
}

function isWatchlistPanelProps(v: unknown): v is Partial<WatchlistPanelProps> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const obj = v as Record<string, unknown>;
  if ('symbols' in obj) {
    if (!Array.isArray(obj['symbols'])) return false;
    if ((obj['symbols'] as unknown[]).some((s) => typeof s !== 'string')) return false;
  }
  return true;
}

function WatchlistPanelWorkspace({
  panelId,
  isActive,
  onClose,
  props,
  updateProps,
}: PanelProps<WatchlistPanelProps>): JSX.Element {
  const setActiveSymbol = useTerminalContextStore((s) => s.setActiveSymbol);

  return (
    <WatchlistPanel
      panelId={panelId}
      isActive={isActive}
      onClose={onClose}
      symbols={props.symbols}
      onSymbolSelect={(sym) => setActiveSymbol(sym)}
      onSymbolsChange={(symbols) => updateProps({ symbols })}
    />
  );
}

export const watchlistPanelApp: PanelApp<WatchlistPanelProps> = {
  id: 'watchlist',
  displayName: 'Watchlist',
  icon: List,
  defaultProps: { symbols: DEFAULT_WATCHLIST_SYMBOLS },
  linkable: false,
  serialize: (props): string => JSON.stringify(props),
  deserialize: (raw): WatchlistPanelProps => {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isWatchlistPanelProps(parsed)) {
        console.warn('[watchlist-panel] Corrupted stored props — using defaults', parsed);
        return { symbols: DEFAULT_WATCHLIST_SYMBOLS };
      }
      return {
        symbols:
          Array.isArray(parsed.symbols) && parsed.symbols.length > 0
            ? parsed.symbols
            : DEFAULT_WATCHLIST_SYMBOLS,
      };
    } catch {
      return { symbols: DEFAULT_WATCHLIST_SYMBOLS };
    }
  },
  Component: WatchlistPanelWorkspace,
};
