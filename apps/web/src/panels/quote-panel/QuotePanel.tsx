/**
 * QuotePanel — dense Bloomberg-style quote header with 4 data tabs.
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ AAPL   182.36  +1.42 (+0.79%)  Vol: 45.23M  [MOCK]    │
 *   ├──────────────────────────────────────────────────────────┤
 *   │ [Current] [Historical] [Matrix] [Ownership]             │
 *   ├──────────────────────────────────────────────────────────┤
 *   │ (tab content)                                            │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Tabs 2-4 are placeholders — Phase 3 fills them. Current tab shows
 * a structured quote detail grid (open, high, low, close, volume).
 *
 * Keyboard navigation (when isActive):
 *   1–4  Switch tab  (CLAUDE.md Part XVI)
 */
import { type JSX, useState, useEffect, useCallback } from 'react';
import { TrendingUp } from 'lucide-react';

import { formatChange, formatChangePct, formatPrice, formatVolume } from '@/lib/format';
import { useRealtimePrice } from '@/hooks/use-realtime-price';

import { useQuoteData } from './use-quote-data';

// ------------------------------------------------------------------
// Tab types
// ------------------------------------------------------------------

type QuoteTab = 'current' | 'historical' | 'matrix' | 'ownership';

const TABS: { id: QuoteTab; label: string; num: number }[] = [
  { id: 'current', label: 'Current', num: 1 },
  { id: 'historical', label: 'Historical', num: 2 },
  { id: 'matrix', label: 'Matrix', num: 3 },
  { id: 'ownership', label: 'Ownership', num: 4 },
];

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------

export interface QuotePanelProps {
  panelId: string;
  isActive: boolean;
  onClose: () => void;
  symbol: string;
}

/**
 * Displays a real-time quote header strip plus numbered data tabs.
 *
 * @param panelId  - Stable workspace instance id
 * @param isActive - Whether this panel currently has keyboard focus
 * @param onClose  - Callback to request panel closure
 * @param symbol   - Ticker or coin id to fetch a quote for
 */
export function QuotePanel({
  panelId: _panelId,
  isActive,
  onClose: _onClose,
  symbol,
}: QuotePanelProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<QuoteTab>('current');
  const { quote, isLoading, isUsingMockData } = useQuoteData(symbol, isActive);
  const { price: rtPrice, isStale } = useRealtimePrice(symbol);

  // WS price supersedes the REST snapshot for the live price display only.
  // changePct from WS is accurate for crypto (Binance computes vs 24h open);
  // for equities Finnhub sends 0 — REST data already has the correct daily change.
  const displayPrice = rtPrice?.price ?? quote?.price;
  const displayChangePct =
    rtPrice !== null && rtPrice.changePct !== 0 ? rtPrice.changePct : (quote?.change_24h ?? null);

  // Keyboard shortcuts: 1–4 switch tabs when panel has focus.
  const handleKeyDown = useCallback(
    (e: KeyboardEvent): void => {
      if (!isActive) return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 4) {
        const tab = TABS[num - 1];
        if (tab) setActiveTab(tab.id);
      }
    },
    [isActive],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return (): void => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Derived colour for change value.
  const changeColor =
    displayChangePct === null || displayChangePct === undefined
      ? 'text-[var(--color-text-secondary)]'
      : displayChangePct >= 0
        ? 'text-[var(--color-positive)]'
        : 'text-[var(--color-negative)]';

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-panel)] text-[var(--color-text-primary)] font-mono text-xs">
      {/* Quote header strip */}
      <div className="flex items-center gap-4 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] shrink-0">
        <span className="font-bold text-sm text-[var(--color-accent)] tracking-wide">
          {symbol.toUpperCase()}
        </span>

        {isLoading ? (
          <span className="text-[var(--color-text-muted)]">Loading…</span>
        ) : (
          <>
            <span className="text-[var(--color-text-primary)] tabular-nums">
              {formatPrice(displayPrice)}
            </span>
            <span className={`tabular-nums ${changeColor}`}>
              {formatChange(
                displayChangePct != null ? displayChangePct * (displayPrice ?? 100) : null,
              )}
              {'  '}
              {formatChangePct(displayChangePct)}
            </span>
            <span className="text-[var(--color-text-secondary)] ml-auto">
              Vol: {formatVolume(rtPrice?.volume ?? quote?.volume_24h)}
            </span>
            {isStale && (
              <span
                className="text-[var(--color-text-muted)] border border-[var(--color-border)] px-1 rounded text-[10px]"
                title="No price tick in 10s"
              >
                STALE
              </span>
            )}
            {isUsingMockData && (
              <span className="text-[var(--color-text-muted)] border border-[var(--color-border)] px-1 rounded text-[10px]">
                MOCK
              </span>
            )}
          </>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-[var(--color-border)] shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={[
              'px-3 py-1.5 text-[11px] font-medium tracking-wide transition-colors',
              activeTab === tab.id
                ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)] -mb-px'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
            ].join(' ')}
          >
            <span className="text-[var(--color-text-muted)] mr-1">{tab.num}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-3">
        {activeTab === 'current' ? (
          <CurrentTab symbol={symbol} quote={quote} realtimePrice={displayPrice} />
        ) : (
          <PlaceholderTab
            icon={<TrendingUp size={24} />}
            label={TABS.find((t) => t.id === activeTab)?.label ?? ''}
          />
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Sub-components
// ------------------------------------------------------------------

interface CurrentTabProps {
  symbol: string;
  quote: {
    price: number | null;
    change_24h: number | null;
    volume_24h: number | null;
    ts: string | null;
  } | null;
  realtimePrice: number | null | undefined;
}

function CurrentTab({ symbol: _symbol, quote, realtimePrice }: CurrentTabProps): JSX.Element {
  const price = realtimePrice ?? quote?.price;
  const rows: { label: string; value: string }[] = [
    { label: 'Price', value: formatPrice(price) },
    {
      label: 'Change',
      value: `${formatChange(quote?.change_24h != null ? quote.change_24h * (price ?? 100) : null)}  (${formatChangePct(quote?.change_24h)})`,
    },
    { label: 'Volume 24h', value: formatVolume(quote?.volume_24h) },
    { label: 'As of', value: quote?.ts ? new Date(quote.ts).toLocaleTimeString() : '—' },
  ];

  return (
    <table className="w-full border-collapse">
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-b border-[var(--color-border)] last:border-0">
            <td className="py-1.5 pr-4 text-[var(--color-text-muted)] whitespace-nowrap w-32">
              {row.label}
            </td>
            <td className="py-1.5 text-[var(--color-text-primary)] tabular-nums font-mono">
              {row.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface PlaceholderTabProps {
  icon: JSX.Element;
  label: string;
}

function PlaceholderTab({ icon, label }: PlaceholderTabProps): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted)] gap-2">
      {icon}
      <span className="text-xs">{label} — Phase 3</span>
    </div>
  );
}
