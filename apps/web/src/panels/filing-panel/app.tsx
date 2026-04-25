/**
 * FilingPanel workspace app registration.
 *
 * linkable: true — follows the activeSymbol symbol-linking bus so
 * filings update when the user selects a different symbol.
 */
import { type JSX } from 'react';
import { FileText } from 'lucide-react';

import { useTerminalContextStore } from '@/workspace/stores/terminal-context.store';
import type { PanelApp, PanelProps } from '@/workspace/types';

import { FilingPanel } from './FilingPanel';

/** Default symbol for new FilingPanel instances. */
const DEFAULT_FILING_SYMBOL = 'AAPL';

/** Serialisable per-instance state for a FilingPanel tile. */
export interface FilingPanelProps {
  symbol: string;
}

function isFilingPanelProps(v: unknown): v is Partial<FilingPanelProps> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const obj = v as Record<string, unknown>;
  if ('symbol' in obj && typeof obj['symbol'] !== 'string') return false;
  return true;
}

function FilingPanelWorkspace({
  panelId,
  isActive,
  onClose,
  props,
}: PanelProps<FilingPanelProps>): JSX.Element {
  const activeSymbol = useTerminalContextStore((s) => s.activeSymbol);
  const symbol = activeSymbol ?? props.symbol;

  return <FilingPanel panelId={panelId} isActive={isActive} onClose={onClose} symbol={symbol} />;
}

export const filingPanelApp: PanelApp<FilingPanelProps> = {
  id: 'filings',
  displayName: 'Filings',
  icon: FileText,
  defaultProps: { symbol: DEFAULT_FILING_SYMBOL },
  linkable: true,
  serialize: (props): string => JSON.stringify(props),
  deserialize: (raw): FilingPanelProps => {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isFilingPanelProps(parsed)) {
        console.warn('[filing-panel] Corrupted stored props — using defaults', parsed);
        return { symbol: DEFAULT_FILING_SYMBOL };
      }
      return { symbol: parsed.symbol ?? DEFAULT_FILING_SYMBOL };
    } catch {
      return { symbol: DEFAULT_FILING_SYMBOL };
    }
  },
  Component: FilingPanelWorkspace,
};
