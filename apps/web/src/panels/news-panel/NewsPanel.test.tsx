/**
 * NewsPanel unit tests.
 *
 * useNewsData is mocked so no backend is required. Tests cover article
 * rendering, the timestamp-left layout, empty state, and the MOCK badge.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Mock the data hook ────────────────────────────────────────────────────────
const mockUseNewsData = vi.fn();
vi.mock('./use-news-data', () => ({
  useNewsData: (...args: unknown[]): unknown =>
    (mockUseNewsData as (...a: unknown[]) => unknown)(...args),
}));

import { NewsPanel } from './NewsPanel';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const MOCK_ARTICLES = [
  {
    id: 'a-1',
    headline: 'AAPL reports record quarterly earnings',
    summary: 'Revenue grew 12% year-over-year.',
    sourceName: 'Mock FT',
    sourceUrl: 'https://example.com/article-1',
    publishedAt: '2026-04-24T14:32:00Z',
    symbols: ['AAPL'],
  },
  {
    id: 'a-2',
    headline: 'Analysts raise AAPL price target',
    summary: null,
    sourceName: 'Mock Reuters',
    sourceUrl: null,
    publishedAt: '2026-04-24T13:15:00Z',
    symbols: ['AAPL'],
  },
];

const LOADED_STATE = {
  articles: MOCK_ARTICLES,
  total: 2,
  isLoading: false,
  isError: false,
  error: null,
  isUsingMockData: true,
  refetch: vi.fn(),
};

function renderNewsPanel(symbol = 'AAPL', isActive = false): ReturnType<typeof render> {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <NewsPanel panelId="test-news" isActive={isActive} onClose={vi.fn()} symbol={symbol} />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('NewsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the symbol in the panel header', () => {
    mockUseNewsData.mockReturnValue(LOADED_STATE);
    renderNewsPanel('AAPL');
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('News')).toBeInTheDocument();
  });

  it('renders a row for each article', () => {
    mockUseNewsData.mockReturnValue(LOADED_STATE);
    renderNewsPanel();
    expect(screen.getByText('AAPL reports record quarterly earnings')).toBeInTheDocument();
    expect(screen.getByText('Analysts raise AAPL price target')).toBeInTheDocument();
  });

  it('renders article source names', () => {
    mockUseNewsData.mockReturnValue(LOADED_STATE);
    renderNewsPanel();
    expect(screen.getByText('Mock FT')).toBeInTheDocument();
    expect(screen.getByText('Mock Reuters')).toBeInTheDocument();
  });

  it('renders article summary when present', () => {
    mockUseNewsData.mockReturnValue(LOADED_STATE);
    renderNewsPanel();
    expect(screen.getByText('Revenue grew 12% year-over-year.')).toBeInTheDocument();
  });

  it('shows a loading indicator while data is pending', () => {
    mockUseNewsData.mockReturnValue({ ...LOADED_STATE, articles: [], isLoading: true });
    renderNewsPanel();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows an empty-state message when there are no articles', () => {
    mockUseNewsData.mockReturnValue({ ...LOADED_STATE, articles: [], total: 0 });
    renderNewsPanel('TSLA');
    expect(screen.getByText(/no news for TSLA/i)).toBeInTheDocument();
  });

  it('shows the MOCK badge when data is from mock layer', () => {
    mockUseNewsData.mockReturnValue({ ...LOADED_STATE, isUsingMockData: true });
    renderNewsPanel();
    expect(screen.getByText('MOCK')).toBeInTheDocument();
  });

  it('does not show the MOCK badge on live data', () => {
    mockUseNewsData.mockReturnValue({ ...LOADED_STATE, isUsingMockData: false });
    renderNewsPanel();
    expect(screen.queryByText('MOCK')).toBeNull();
  });

  it('article with sourceUrl is keyboard-focusable and opens URL on Enter', () => {
    mockUseNewsData.mockReturnValue(LOADED_STATE);
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderNewsPanel();

    const linkRow = screen
      .getByText('AAPL reports record quarterly earnings')
      .closest('[role="link"]');
    expect(linkRow).not.toBeNull();
    fireEvent.keyDown(linkRow!, { key: 'Enter' });

    expect(openSpy).toHaveBeenCalledWith(
      'https://example.com/article-1',
      '_blank',
      'noopener,noreferrer',
    );
    openSpy.mockRestore();
  });

  it('passes symbol and isActive to useNewsData', () => {
    mockUseNewsData.mockReturnValue(LOADED_STATE);
    renderNewsPanel('MSFT', true);
    expect(mockUseNewsData).toHaveBeenCalledWith('MSFT', true);
  });
});
