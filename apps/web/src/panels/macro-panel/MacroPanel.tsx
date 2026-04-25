/**
 * MacroPanel — FRED macro series data table with series selector.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ [GDP ▾]  Gross Domestic Product  Billions of Dollars     │
 *   ├──────────────────────────────────────────────────────────┤
 *   │ Date       Value                                         │
 *   │ 2026-03   28 456.00                                      │
 *   │ …                                                        │
 *   └──────────────────────────────────────────────────────────┘
 *
 * The series selector is a native <select> — minimal chrome, keyboard-
 * friendly, matches the terminal's information-dense aesthetic.
 * Keyboard: ↑/↓ when panel focused navigate the series dropdown.
 */
import { type JSX, memo } from 'react';
import { TrendingUp } from 'lucide-react';
import type { MacroBar } from '@terminal/types';

import { formatYearMonth } from '@/lib/format';

import { useMacroData } from './use-macro-data';

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------

/** Available FRED series IDs — mirrors FRED_SERIES_IDS in .env.example. */
const AVAILABLE_SERIES = [
  { id: 'GDP', label: 'GDP' },
  { id: 'CPIAUCSL', label: 'CPI' },
  { id: 'FEDFUNDS', label: 'Fed Funds' },
  { id: 'DGS10', label: '10Y Treasury' },
  { id: 'UNRATE', label: 'Unemployment' },
];

// ------------------------------------------------------------------
// Row component
// ------------------------------------------------------------------

interface MacroRowProps {
  bar: MacroBar;
  unit: string;
}

const MacroRow = memo(function MacroRow({ bar, unit: _unit }: MacroRowProps): JSX.Element {
  return (
    <tr className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-hover)]">
      <td className="py-1 pl-3 pr-4 text-[var(--color-text-secondary)] tabular-nums w-24">
        {formatYearMonth(bar.ts)}
      </td>
      <td className="py-1 pr-3 text-right tabular-nums text-[var(--color-text-primary)]">
        {bar.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
    </tr>
  );
});

// ------------------------------------------------------------------
// Panel component
// ------------------------------------------------------------------

export interface MacroPanelProps {
  panelId: string;
  isActive: boolean;
  onClose: () => void;
  seriesId: string;
  onSeriesChange: (id: string) => void;
}

/**
 * Displays FRED macro observations in a scrollable table.
 *
 * @param seriesId      - Active FRED series ID
 * @param onSeriesChange - Callback when user picks a different series
 */
export function MacroPanel({
  panelId: _panelId,
  isActive: _isActive,
  onClose: _onClose,
  seriesId,
  onSeriesChange,
}: MacroPanelProps): JSX.Element {
  const { series, isLoading, isUsingMockData } = useMacroData(seriesId, true);

  // Newest observations first for the display table.
  const bars = series ? [...series.bars].reverse() : [];

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-panel)] text-[var(--color-text-primary)] font-mono text-xs">
      {/* Header with series selector */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] shrink-0">
        <select
          value={seriesId}
          onChange={(e) => onSeriesChange(e.target.value)}
          className="bg-transparent text-[var(--color-accent)] font-bold border border-[var(--color-border)] rounded px-1 py-0.5 text-xs outline-none cursor-pointer"
          aria-label="Select macro series"
        >
          {AVAILABLE_SERIES.map((s) => (
            <option key={s.id} value={s.id} className="bg-[var(--color-bg-secondary)]">
              {s.label}
            </option>
          ))}
        </select>

        <span className="text-[var(--color-text-secondary)] truncate">{series?.name ?? '—'}</span>

        <span className="text-[var(--color-text-muted)] ml-auto shrink-0">
          {series?.unit ?? ''}
        </span>

        {isUsingMockData && (
          <span className="text-[var(--color-text-muted)] border border-[var(--color-border)] px-1 rounded text-[10px] shrink-0">
            MOCK
          </span>
        )}
      </div>

      {/* Table header */}
      <div className="shrink-0 border-b border-[var(--color-border)]">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-[var(--color-text-muted)] text-[10px] uppercase tracking-wider">
              <th className="py-1 pl-3 pr-4 text-left w-24">Date</th>
              <th className="py-1 pr-3 text-right">Value</th>
            </tr>
          </thead>
        </table>
      </div>

      {/* Scrollable data */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-16 text-[var(--color-text-muted)]">
            Loading…
          </div>
        ) : bars.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-[var(--color-text-muted)]">
            <TrendingUp size={24} />
            <span>No data for {seriesId}</span>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <tbody>
              {bars.map((bar) => (
                <MacroRow key={bar.ts} bar={bar} unit={series?.unit ?? ''} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
