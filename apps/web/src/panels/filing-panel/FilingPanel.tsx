/**
 * FilingPanel — SEC EDGAR filings list with form type filter.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ AAPL  Filings  [ALL][10-K][10-Q][8-K]  [MOCK]           │
 *   ├──────────────────────────────────────────────────────────┤
 *   │ 2026-04-18  10-K  Annual Report FY2025                   │
 *   │             Period: 2025-12-31  · 0000320193-26-000100  │
 *   │                                                           │
 *   │ 2026-01-10  10-Q  Q3 2025                                │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Clicking a row opens the EDGAR filing URL in a new tab.
 * The form type filter is a segmented control (ALL / 10-K / 10-Q / 8-K).
 */
import { type JSX, memo, useState, useCallback } from 'react';
import { FileText } from 'lucide-react';
import type { Filing } from '@terminal/types';

import { type FilingFormType } from '@/lib/api/filings.api';
import { formatDate } from '@/lib/format';

import { useFilingsData } from './use-filings-data';

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------

const FORM_TYPE_FILTERS: { id: FilingFormType; label: string }[] = [
  { id: 'ALL', label: 'ALL' },
  { id: '10-K', label: '10-K' },
  { id: '10-Q', label: '10-Q' },
  { id: '8-K', label: '8-K' },
];

// ------------------------------------------------------------------
// Row component
// ------------------------------------------------------------------

interface FilingRowProps {
  filing: Filing;
}

const FilingRow = memo(function FilingRow({ filing }: FilingRowProps): JSX.Element {
  const handleClick = (): void => {
    window.open(filing.filing_url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleClick();
      }}
      className="px-3 py-2 border-b border-[var(--color-border)] last:border-0 cursor-pointer hover:bg-[var(--color-bg-hover)] group"
    >
      <div className="flex items-start gap-3">
        {/* Date */}
        <span className="shrink-0 tabular-nums text-[var(--color-text-muted)] w-24">
          {formatDate(filing.filed_at)}
        </span>

        {/* Form type badge */}
        <span className="shrink-0 font-bold text-[var(--color-accent)] w-10">
          {filing.form_type}
        </span>

        {/* Description */}
        <span className="text-[var(--color-text-primary)] truncate group-hover:text-white">
          {filing.description ?? `${filing.form_type} filing`}
        </span>
      </div>

      <div className="flex gap-4 pl-37 mt-0.5 ml-36 text-[10px] text-[var(--color-text-muted)]">
        <span>Period: {filing.period_of_report}</span>
        <span className="font-mono">{filing.accession_number}</span>
      </div>
    </div>
  );
});

// ------------------------------------------------------------------
// Panel component
// ------------------------------------------------------------------

export interface FilingPanelProps {
  panelId: string;
  isActive: boolean;
  onClose: () => void;
  symbol: string;
}

/**
 * Displays SEC EDGAR filings for a symbol with form type filtering.
 */
export function FilingPanel({
  panelId: _panelId,
  isActive,
  onClose: _onClose,
  symbol,
}: FilingPanelProps): JSX.Element {
  const [formType, setFormType] = useState<FilingFormType>('ALL');
  const { filings, isLoading, isUsingMockData } = useFilingsData(symbol, formType, isActive);

  const handleFilterChange = useCallback((ft: FilingFormType) => {
    setFormType(ft);
  }, []);

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-panel)] text-[var(--color-text-primary)] font-mono text-xs">
      {/* Header with filter tabs */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] shrink-0 flex-wrap">
        <span className="font-bold text-[var(--color-accent)] tracking-wide">
          {symbol.toUpperCase()}
        </span>
        <span className="text-[var(--color-text-muted)]">Filings</span>

        <div className="flex ml-2 gap-px">
          {FORM_TYPE_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => handleFilterChange(filter.id)}
              className={[
                'px-2 py-0.5 text-[10px] font-medium transition-colors border border-[var(--color-border)]',
                'first:rounded-l last:rounded-r -ml-px first:ml-0',
                formType === filter.id
                  ? 'bg-[var(--color-accent)] text-black border-[var(--color-accent)]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-transparent',
              ].join(' ')}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {isUsingMockData && (
          <span className="ml-auto text-[var(--color-text-muted)] border border-[var(--color-border)] px-1 rounded text-[10px]">
            MOCK
          </span>
        )}
      </div>

      {/* Filings list */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-16 text-[var(--color-text-muted)]">
            Loading…
          </div>
        ) : filings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-[var(--color-text-muted)]">
            <FileText size={24} />
            <span>
              No {formType === 'ALL' ? '' : formType + ' '}filings for {symbol}
            </span>
          </div>
        ) : (
          filings.map((filing) => <FilingRow key={filing.accession_number} filing={filing} />)
        )}
      </div>
    </div>
  );
}
