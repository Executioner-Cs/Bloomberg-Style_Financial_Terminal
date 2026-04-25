/**
 * QuotePanel unit tests.
 *
 * useQuoteData is mocked so no running backend or TanStack Query
 * infrastructure is needed — the tests exercise the component's
 * rendering logic, tab keyboard navigation, and state indicators.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Mock the data hook ────────────────────────────────────────────────────────
const mockUseQuoteData = vi.fn();
vi.mock('./use-quote-data', () => ({
  useQuoteData: (...args: unknown[]): unknown =>
    (mockUseQuoteData as (...a: unknown[]) => unknown)(...args),
}));

import { QuotePanel } from './QuotePanel';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

type RenderQuotePanelOptions = {
  symbol?: string;
  isActive?: boolean;
};

function renderQuotePanel({
  symbol = 'AAPL',
  isActive = false,
}: RenderQuotePanelOptions = {}): ReturnType<typeof render> {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <QuotePanel panelId="test-quote" isActive={isActive} onClose={vi.fn()} symbol={symbol} />
    </QueryClientProvider>,
  );
}

const LOADED_QUOTE = {
  quote: {
    symbol: 'AAPL',
    price: 182.36,
    change_24h: 0.0079,
    volume_24h: 45_230_000,
    ts: '2026-04-24T14:30:00Z',
  },
  isLoading: false,
  isError: false,
  error: null,
  isUsingMockData: false,
  refetch: vi.fn(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('QuotePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the symbol in the header strip', () => {
    mockUseQuoteData.mockReturnValue(LOADED_QUOTE);
    renderQuotePanel({ symbol: 'NVDA' });
    expect(screen.getByText('NVDA')).toBeInTheDocument();
  });

  it('shows a loading placeholder while data is pending', () => {
    mockUseQuoteData.mockReturnValue({
      ...LOADED_QUOTE,
      quote: null,
      isLoading: true,
    });
    renderQuotePanel();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders price and change when data is available', () => {
    mockUseQuoteData.mockReturnValue(LOADED_QUOTE);
    renderQuotePanel();
    // Price appears in the header strip and in the Current tab detail grid.
    // getAllByText tolerates both occurrences — we just assert at least one exists.
    expect(screen.getAllByText(/182/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows the MOCK badge when data is from mock layer', () => {
    mockUseQuoteData.mockReturnValue({ ...LOADED_QUOTE, isUsingMockData: true });
    renderQuotePanel();
    expect(screen.getByText('MOCK')).toBeInTheDocument();
  });

  it('does not show the MOCK badge on live data', () => {
    mockUseQuoteData.mockReturnValue({ ...LOADED_QUOTE, isUsingMockData: false });
    renderQuotePanel();
    expect(screen.queryByText('MOCK')).toBeNull();
  });

  it('renders all four tab buttons', () => {
    mockUseQuoteData.mockReturnValue(LOADED_QUOTE);
    renderQuotePanel();
    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.getByText('Historical')).toBeInTheDocument();
    expect(screen.getByText('Matrix')).toBeInTheDocument();
    expect(screen.getByText('Ownership')).toBeInTheDocument();
  });

  it('shows Current tab content by default', () => {
    mockUseQuoteData.mockReturnValue(LOADED_QUOTE);
    renderQuotePanel();
    // Current tab has a Price row in the detail grid.
    expect(screen.getByText('Price')).toBeInTheDocument();
  });

  it('switches to Historical tab on click', () => {
    mockUseQuoteData.mockReturnValue(LOADED_QUOTE);
    renderQuotePanel();
    fireEvent.click(screen.getByText('Historical'));
    expect(screen.getByText(/Historical — Phase 3/i)).toBeInTheDocument();
  });

  it('switches tabs via keyboard 1–4 when panel is active', () => {
    mockUseQuoteData.mockReturnValue(LOADED_QUOTE);
    renderQuotePanel({ isActive: true });

    // Press "2" — should switch to Historical.
    fireEvent.keyDown(window, { key: '2' });
    expect(screen.getByText(/Historical — Phase 3/i)).toBeInTheDocument();

    // Press "1" — back to Current.
    fireEvent.keyDown(window, { key: '1' });
    expect(screen.getByText('Price')).toBeInTheDocument();
  });

  it('does not switch tabs via keyboard when panel is not active', () => {
    mockUseQuoteData.mockReturnValue(LOADED_QUOTE);
    renderQuotePanel({ isActive: false });

    fireEvent.keyDown(window, { key: '2' });
    // Should still be on Current tab.
    expect(screen.getByText('Price')).toBeInTheDocument();
  });

  it('passes symbol and isActive to useQuoteData', () => {
    mockUseQuoteData.mockReturnValue(LOADED_QUOTE);
    renderQuotePanel({ symbol: 'MSFT', isActive: true });
    expect(mockUseQuoteData).toHaveBeenCalledWith('MSFT', true);
  });
});
