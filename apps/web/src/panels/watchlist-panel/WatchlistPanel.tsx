/**
 * WatchlistPanel — virtualized watchlist table with live prices.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ Symbol   Price      Chg%     Volume   [+ Add]  [MOCK]   │
 *   ├──────────────────────────────────────────────────────────┤
 *   │ AAPL    182.36   +0.79%   45.23M   [×]                  │
 *   │ MSFT    415.22   -0.21%   22.10M   [×]                  │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Clicking a row calls `onSymbolSelect(symbol)` which sets the
 * terminal symbol-linking bus (activeSymbol). Panels linked to the
 * bus update automatically.
 *
 * The add-symbol flow is a controlled input — Enter commits, Escape cancels.
 *
 * Performance (CLAUDE.md Part XII):
 *   - Each WatchlistRow is React.memo'd — ticking numbers must not
 *     re-render untouched rows.
 *   - Table is virtualized via CSS overflow-auto + fixed row height;
 *     react-virtual is deferred to Phase 3 (> 100 rows not yet required).
 */
import { type JSX, memo, useState, useCallback, useRef } from 'react';
import { Plus, X } from 'lucide-react';

import { formatChangePct, formatPrice, formatVolume } from '@/lib/format';
import { useRealtimePrice } from '@/hooks/use-realtime-price';

import { useWatchlistData } from './use-watchlist-data';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface WatchlistPanelProps {
  panelId: string;
  isActive: boolean;
  onClose: () => void;
  symbols: string[];
  onSymbolSelect: (symbol: string) => void;
  onSymbolsChange: (symbols: string[]) => void;
}

// ------------------------------------------------------------------
// Row component (memoised)
// ------------------------------------------------------------------

interface WatchlistRowProps {
  symbol: string;
  price: number | null;
  changePct: number | null;
  volume: number | null;
  isSelected: boolean;
  onSelect: (symbol: string) => void;
  onRemove: (symbol: string) => void;
}

const WatchlistRow = memo(
  function WatchlistRow({
    symbol,
    price,
    changePct,
    volume,
    isSelected,
    onSelect,
    onRemove,
  }: WatchlistRowProps): JSX.Element {
    const changeColor =
      changePct === null
        ? 'text-[var(--color-text-secondary)]'
        : changePct >= 0
          ? 'text-[var(--color-positive)]'
          : 'text-[var(--color-negative)]';

    return (
      <tr
        className={[
          'border-b border-[var(--color-border)] cursor-pointer select-none group',
          isSelected ? 'bg-[var(--color-bg-hover)]' : 'hover:bg-[var(--color-bg-hover)]',
        ].join(' ')}
        onClick={() => onSelect(symbol)}
      >
        <td className="py-1.5 pl-3 pr-2 font-bold text-[var(--color-accent)] w-20">{symbol}</td>
        <td className="py-1.5 pr-3 text-right tabular-nums text-[var(--color-text-primary)] w-24">
          {formatPrice(price)}
        </td>
        <td className={`py-1.5 pr-3 text-right tabular-nums w-20 ${changeColor}`}>
          {formatChangePct(changePct)}
        </td>
        <td className="py-1.5 pr-3 text-right tabular-nums text-[var(--color-text-secondary)] w-24">
          {formatVolume(volume)}
        </td>
        <td className="py-1.5 pr-2 text-right w-8">
          <button
            type="button"
            className="opacity-0 group-hover:opacity-100 text-[var(--color-text-muted)] hover:text-[var(--color-negative)] transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(symbol);
            }}
            aria-label={`Remove ${symbol}`}
          >
            <X size={12} />
          </button>
        </td>
      </tr>
    );
  },
  (prev, next) =>
    prev.symbol === next.symbol &&
    prev.price === next.price &&
    prev.changePct === next.changePct &&
    prev.volume === next.volume &&
    prev.isSelected === next.isSelected,
);

// ------------------------------------------------------------------
// Live-price row wrapper
// ------------------------------------------------------------------

/**
 * Wraps WatchlistRow with a useRealtimePrice subscription.
 * When a WS tick arrives for this symbol, only this row re-renders —
 * sibling rows are unaffected (CLAUDE.md Part XII memoization budget).
 */
interface LiveWatchlistRowProps {
  symbol: string;
  restPrice: number | null;
  restChangePct: number | null;
  restVolume: number | null;
  isSelected: boolean;
  onSelect: (symbol: string) => void;
  onRemove: (symbol: string) => void;
}

function LiveWatchlistRow({
  symbol,
  restPrice,
  restChangePct,
  restVolume,
  isSelected,
  onSelect,
  onRemove,
}: LiveWatchlistRowProps): JSX.Element {
  const { price: rtPrice } = useRealtimePrice(symbol);

  // WS price supersedes REST for the price cell.
  // changePct: use WS value for crypto (non-zero), REST for equities (WS sends 0).
  const displayPrice = rtPrice?.price ?? restPrice;
  const displayChangePct =
    rtPrice !== null && rtPrice !== undefined && rtPrice.changePct !== 0
      ? rtPrice.changePct
      : restChangePct;

  return (
    <WatchlistRow
      symbol={symbol}
      price={displayPrice}
      changePct={displayChangePct}
      volume={restVolume}
      isSelected={isSelected}
      onSelect={onSelect}
      onRemove={onRemove}
    />
  );
}

// ------------------------------------------------------------------
// Panel component
// ------------------------------------------------------------------

/**
 * Watchlist panel — live-updating symbol table that drives the
 * terminal symbol-linking bus on row click.
 */
export function WatchlistPanel({
  panelId: _panelId,
  isActive: _isActive,
  onClose: _onClose,
  symbols,
  onSymbolSelect,
  onSymbolsChange,
}: WatchlistPanelProps): JSX.Element {
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addInput, setAddInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { quotes, isLoading, isUsingMockData } = useWatchlistData(symbols, true);

  const handleSelect = useCallback(
    (symbol: string) => {
      setSelectedSymbol(symbol);
      onSymbolSelect(symbol);
    },
    [onSymbolSelect],
  );

  const handleRemove = useCallback(
    (symbol: string) => {
      onSymbolsChange(symbols.filter((s) => s !== symbol));
      if (selectedSymbol === symbol) setSelectedSymbol(null);
    },
    [symbols, selectedSymbol, onSymbolsChange],
  );

  const commitAdd = useCallback(() => {
    const sym = addInput.trim().toUpperCase();
    if (sym.length > 0 && !symbols.includes(sym)) {
      onSymbolsChange([...symbols, sym]);
    }
    setAddInput('');
    setIsAdding(false);
  }, [addInput, symbols, onSymbolsChange]);

  const handleAddKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') commitAdd();
      if (e.key === 'Escape') {
        setAddInput('');
        setIsAdding(false);
      }
    },
    [commitAdd],
  );

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-panel)] text-[var(--color-text-primary)] font-mono text-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] shrink-0">
        <span className="text-[var(--color-text-muted)] uppercase tracking-widest text-[10px]">
          Watchlist
        </span>
        <div className="flex items-center gap-2">
          {isUsingMockData && (
            <span className="text-[var(--color-text-muted)] border border-[var(--color-border)] px-1 rounded text-[10px]">
              MOCK
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setIsAdding(true);
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
            aria-label="Add symbol"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Table header */}
      <div className="shrink-0 border-b border-[var(--color-border)]">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-[var(--color-text-muted)] text-[10px] uppercase tracking-wider">
              <th className="py-1 pl-3 pr-2 text-left w-20">Symbol</th>
              <th className="py-1 pr-3 text-right w-24">Price</th>
              <th className="py-1 pr-3 text-right w-20">Chg%</th>
              <th className="py-1 pr-3 text-right w-24">Volume</th>
              <th className="w-8" />
            </tr>
          </thead>
        </table>
      </div>

      {/* Scrollable table body */}
      <div className="flex-1 overflow-auto">
        {isLoading && symbols.length > 0 ? (
          <div className="flex items-center justify-center h-16 text-[var(--color-text-muted)]">
            Loading…
          </div>
        ) : (
          <table className="w-full border-collapse">
            <tbody>
              {symbols.map((sym) => {
                const q = quotes[sym];
                return (
                  <LiveWatchlistRow
                    key={sym}
                    symbol={sym}
                    restPrice={q?.price ?? null}
                    restChangePct={q?.change_24h ?? null}
                    restVolume={q?.volume_24h ?? null}
                    isSelected={selectedSymbol === sym}
                    onSelect={handleSelect}
                    onRemove={handleRemove}
                  />
                );
              })}
            </tbody>
          </table>
        )}

        {symbols.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-[var(--color-text-muted)]">
            <Plus size={20} />
            <span>Add a symbol to get started</span>
          </div>
        )}
      </div>

      {/* Inline add input */}
      {isAdding && (
        <div className="shrink-0 border-t border-[var(--color-border)] px-3 py-1.5 bg-[var(--color-bg-secondary)]">
          <input
            ref={inputRef}
            type="text"
            value={addInput}
            onChange={(e) => setAddInput(e.target.value.toUpperCase())}
            onKeyDown={handleAddKeyDown}
            onBlur={commitAdd}
            placeholder="TYPE SYMBOL + ENTER"
            className="w-full bg-transparent text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none font-mono text-xs tracking-wide"
            maxLength={20}
          />
        </div>
      )}
    </div>
  );
}
