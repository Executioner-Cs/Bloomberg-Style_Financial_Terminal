/**
 * WatchlistPanel unit tests.
 *
 * useWatchlistData is mocked so no backend is required. The tests cover
 * row rendering, symbol selection (symbol-linking bus), add-symbol flow,
 * and remove-symbol flow.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Mock the data hook ────────────────────────────────────────────────────────
const mockUseWatchlistData = vi.fn();
vi.mock('./use-watchlist-data', () => ({
  useWatchlistData: (...args: unknown[]): unknown =>
    (mockUseWatchlistData as (...a: unknown[]) => unknown)(...args),
}));

import { WatchlistPanel } from './WatchlistPanel';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const DEFAULT_SYMBOLS = ['AAPL', 'MSFT', 'NVDA'];

const LOADED_QUOTES = {
  quotes: {
    AAPL: {
      symbol: 'AAPL',
      price: 182.36,
      change_24h: 0.0079,
      volume_24h: 45_230_000,
      ts: '2026-04-24T14:30:00Z',
    },
    MSFT: {
      symbol: 'MSFT',
      price: 415.22,
      change_24h: -0.0021,
      volume_24h: 22_100_000,
      ts: '2026-04-24T14:30:00Z',
    },
    NVDA: {
      symbol: 'NVDA',
      price: 875.0,
      change_24h: 0.015,
      volume_24h: 38_000_000,
      ts: '2026-04-24T14:30:00Z',
    },
  },
  isLoading: false,
  isError: false,
  error: null,
  isUsingMockData: false,
  refetch: vi.fn(),
};

type RenderOptions = {
  symbols?: string[];
  onSymbolSelect?: (symbol: string) => void;
  onSymbolsChange?: (symbols: string[]) => void;
};

function renderWatchlist({
  symbols = DEFAULT_SYMBOLS,
  onSymbolSelect = vi.fn(),
  onSymbolsChange = vi.fn(),
}: RenderOptions = {}): ReturnType<typeof render> {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <WatchlistPanel
        panelId="test-watchlist"
        isActive={false}
        onClose={vi.fn()}
        symbols={symbols}
        onSymbolSelect={onSymbolSelect}
        onSymbolsChange={onSymbolsChange}
      />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('WatchlistPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a row for each symbol', () => {
    mockUseWatchlistData.mockReturnValue(LOADED_QUOTES);
    renderWatchlist();
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('MSFT')).toBeInTheDocument();
    expect(screen.getByText('NVDA')).toBeInTheDocument();
  });

  it('shows an empty-state prompt when symbols list is empty', () => {
    mockUseWatchlistData.mockReturnValue({ ...LOADED_QUOTES, quotes: {} });
    renderWatchlist({ symbols: [] });
    expect(screen.getByText(/add a symbol to get started/i)).toBeInTheDocument();
  });

  it('shows loading indicator while data is pending', () => {
    mockUseWatchlistData.mockReturnValue({ ...LOADED_QUOTES, isLoading: true });
    renderWatchlist();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows the MOCK badge when data is from mock layer', () => {
    mockUseWatchlistData.mockReturnValue({ ...LOADED_QUOTES, isUsingMockData: true });
    renderWatchlist();
    expect(screen.getByText('MOCK')).toBeInTheDocument();
  });

  it('calls onSymbolSelect when a row is clicked', () => {
    mockUseWatchlistData.mockReturnValue(LOADED_QUOTES);
    const onSymbolSelect = vi.fn();
    renderWatchlist({ onSymbolSelect });

    fireEvent.click(screen.getByText('MSFT'));
    expect(onSymbolSelect).toHaveBeenCalledWith('MSFT');
  });

  it('calls onSymbolsChange without removed symbol when remove button clicked', () => {
    mockUseWatchlistData.mockReturnValue(LOADED_QUOTES);
    const onSymbolsChange = vi.fn();
    renderWatchlist({ onSymbolsChange });

    // Each remove button has aria-label="Remove <SYMBOL>"
    const removeNvda = screen.getByRole('button', { name: /remove nvda/i });
    fireEvent.click(removeNvda);

    expect(onSymbolsChange).toHaveBeenCalledWith(['AAPL', 'MSFT']);
  });

  it('opens inline add input when the + button is clicked', () => {
    mockUseWatchlistData.mockReturnValue(LOADED_QUOTES);
    renderWatchlist();

    fireEvent.click(screen.getByRole('button', { name: /add symbol/i }));
    expect(screen.getByPlaceholderText(/type symbol/i)).toBeInTheDocument();
  });

  it('calls onSymbolsChange with new symbol on Enter in add input', () => {
    mockUseWatchlistData.mockReturnValue(LOADED_QUOTES);
    const onSymbolsChange = vi.fn();
    renderWatchlist({ onSymbolsChange });

    fireEvent.click(screen.getByRole('button', { name: /add symbol/i }));
    const input = screen.getByPlaceholderText(/type symbol/i);
    fireEvent.change(input, { target: { value: 'GOOG' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSymbolsChange).toHaveBeenCalledWith([...DEFAULT_SYMBOLS, 'GOOG']);
  });

  it('cancels the add input on Escape without changing symbols', () => {
    mockUseWatchlistData.mockReturnValue(LOADED_QUOTES);
    const onSymbolsChange = vi.fn();
    renderWatchlist({ onSymbolsChange });

    fireEvent.click(screen.getByRole('button', { name: /add symbol/i }));
    const input = screen.getByPlaceholderText(/type symbol/i);
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onSymbolsChange).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText(/type symbol/i)).toBeNull();
  });

  it('does not add a duplicate symbol', () => {
    mockUseWatchlistData.mockReturnValue(LOADED_QUOTES);
    const onSymbolsChange = vi.fn();
    renderWatchlist({ onSymbolsChange });

    fireEvent.click(screen.getByRole('button', { name: /add symbol/i }));
    const input = screen.getByPlaceholderText(/type symbol/i);
    fireEvent.change(input, { target: { value: 'AAPL' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // AAPL already in list — onSymbolsChange must not be called with a duplicate.
    expect(onSymbolsChange).not.toHaveBeenCalled();
  });
});
