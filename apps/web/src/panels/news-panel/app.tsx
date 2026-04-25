/**
 * NewsPanel workspace app registration.
 *
 * linkable: true — follows the activeSymbol symbol-linking bus so
 * news updates when the user selects a different symbol in the watchlist.
 */
import { type JSX } from 'react';
import { Newspaper } from 'lucide-react';

import { useTerminalContextStore } from '@/workspace/stores/terminal-context.store';
import type { PanelApp, PanelProps } from '@/workspace/types';

import { NewsPanel } from './NewsPanel';

/** Default symbol for new NewsPanel instances. */
const DEFAULT_NEWS_SYMBOL = 'AAPL';

/** Serialisable per-instance state for a NewsPanel tile. */
export interface NewsPanelProps {
  symbol: string;
}

function isNewsPanelProps(v: unknown): v is Partial<NewsPanelProps> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const obj = v as Record<string, unknown>;
  if ('symbol' in obj && typeof obj['symbol'] !== 'string') return false;
  return true;
}

function NewsPanelWorkspace({
  panelId,
  isActive,
  onClose,
  props,
}: PanelProps<NewsPanelProps>): JSX.Element {
  const activeSymbol = useTerminalContextStore((s) => s.activeSymbol);
  const symbol = activeSymbol ?? props.symbol;

  return <NewsPanel panelId={panelId} isActive={isActive} onClose={onClose} symbol={symbol} />;
}

export const newsPanelApp: PanelApp<NewsPanelProps> = {
  id: 'news',
  displayName: 'News',
  icon: Newspaper,
  defaultProps: { symbol: DEFAULT_NEWS_SYMBOL },
  linkable: true,
  serialize: (props): string => JSON.stringify(props),
  deserialize: (raw): NewsPanelProps => {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isNewsPanelProps(parsed)) {
        console.warn('[news-panel] Corrupted stored props — using defaults', parsed);
        return { symbol: DEFAULT_NEWS_SYMBOL };
      }
      return { symbol: parsed.symbol ?? DEFAULT_NEWS_SYMBOL };
    } catch {
      return { symbol: DEFAULT_NEWS_SYMBOL };
    }
  },
  Component: NewsPanelWorkspace,
};
