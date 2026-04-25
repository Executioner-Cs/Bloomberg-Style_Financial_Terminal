/**
 * QuotePanel workspace app registration.
 *
 * Thin workspace adapter that:
 *   1. Follows the activeSymbol symbol-linking bus (linkable: true).
 *   2. Translates PanelProps<QuotePanelProps> → QuotePanel's own prop shape.
 *
 * The visual QuotePanel knows nothing about the workspace.
 */
import { type JSX } from 'react';
import { Activity } from 'lucide-react';

import { useTerminalContextStore } from '@/workspace/stores/terminal-context.store';
import type { PanelApp, PanelProps } from '@/workspace/types';

import { QuotePanel } from './QuotePanel';

/** Default symbol for new QuotePanel instances. */
const DEFAULT_QUOTE_SYMBOL = 'AAPL';

/** Serialisable per-instance state for a QuotePanel tile. */
export interface QuotePanelProps {
  symbol: string;
}

function isQuotePanelProps(v: unknown): v is Partial<QuotePanelProps> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const obj = v as Record<string, unknown>;
  if ('symbol' in obj && typeof obj['symbol'] !== 'string') return false;
  return true;
}

function QuotePanelWorkspace({
  panelId,
  isActive,
  onClose,
  props,
}: PanelProps<QuotePanelProps>): JSX.Element {
  const activeSymbol = useTerminalContextStore((s) => s.activeSymbol);
  const symbol = activeSymbol ?? props.symbol;

  return <QuotePanel panelId={panelId} isActive={isActive} onClose={onClose} symbol={symbol} />;
}

export const quotePanelApp: PanelApp<QuotePanelProps> = {
  id: 'quote',
  displayName: 'Quote',
  icon: Activity,
  defaultProps: { symbol: DEFAULT_QUOTE_SYMBOL },
  linkable: true,
  serialize: (props): string => JSON.stringify(props),
  deserialize: (raw): QuotePanelProps => {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isQuotePanelProps(parsed)) {
        console.warn('[quote-panel] Corrupted stored props — using defaults', parsed);
        return { symbol: DEFAULT_QUOTE_SYMBOL };
      }
      return { symbol: parsed.symbol ?? DEFAULT_QUOTE_SYMBOL };
    } catch {
      return { symbol: DEFAULT_QUOTE_SYMBOL };
    }
  },
  Component: QuotePanelWorkspace,
};
