/**
 * FilingPanel unit tests.
 *
 * useFilingsData is mocked so no backend is required. Tests cover filing
 * list rendering, form type filter segmented control, empty state, loading
 * state, and MOCK badge.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Mock the data hook ────────────────────────────────────────────────────────
const mockUseFilingsData = vi.fn();
vi.mock('./use-filings-data', () => ({
  useFilingsData: (...args: unknown[]): unknown =>
    (mockUseFilingsData as (...a: unknown[]) => unknown)(...args),
}));

import { FilingPanel } from './FilingPanel';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const MOCK_FILINGS = [
  {
    symbol: 'AAPL',
    form_type: '10-K',
    filed_at: '2026-04-18T00:00:00Z',
    period_of_report: '2025-12-31',
    accession_number: '0000320193-26-000100',
    filing_url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=AAPL',
    description: 'Annual Report FY2025',
  },
  {
    symbol: 'AAPL',
    form_type: '10-Q',
    filed_at: '2026-01-10T00:00:00Z',
    period_of_report: '2025-09-30',
    accession_number: '0000320193-26-000050',
    filing_url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=AAPL',
    description: 'Q3 2025 Quarterly Report',
  },
];

const LOADED_STATE = {
  filings: MOCK_FILINGS,
  total: 2,
  isLoading: false,
  isError: false,
  error: null,
  isUsingMockData: true,
  refetch: vi.fn(),
};

function renderFilingPanel(symbol = 'AAPL', isActive = false): ReturnType<typeof render> {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <FilingPanel panelId="test-filing" isActive={isActive} onClose={vi.fn()} symbol={symbol} />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('FilingPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the symbol in the panel header', () => {
    mockUseFilingsData.mockReturnValue(LOADED_STATE);
    renderFilingPanel('AAPL');
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('Filings')).toBeInTheDocument();
  });

  it('renders a row for each filing', () => {
    mockUseFilingsData.mockReturnValue(LOADED_STATE);
    renderFilingPanel();
    expect(screen.getByText('Annual Report FY2025')).toBeInTheDocument();
    expect(screen.getByText('Q3 2025 Quarterly Report')).toBeInTheDocument();
  });

  it('renders form type badges for each filing', () => {
    mockUseFilingsData.mockReturnValue(LOADED_STATE);
    renderFilingPanel();
    // '10-K' appears as both a badge in the filing row and as a filter button label.
    // getAllByText tolerates multiple matches — we assert at least two occurrences
    // (the badge plus the filter button).
    expect(screen.getAllByText('10-K').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('10-Q').length).toBeGreaterThanOrEqual(2);
  });

  it('renders all four filter buttons (ALL, 10-K, 10-Q, 8-K)', () => {
    mockUseFilingsData.mockReturnValue(LOADED_STATE);
    renderFilingPanel();
    expect(screen.getByRole('button', { name: 'ALL' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '10-K' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '10-Q' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '8-K' })).toBeInTheDocument();
  });

  it('passes the selected form type filter to useFilingsData', () => {
    mockUseFilingsData.mockReturnValue(LOADED_STATE);
    renderFilingPanel('AAPL', false);

    // Default filter is ALL — hook called with 'ALL'.
    expect(mockUseFilingsData).toHaveBeenCalledWith('AAPL', 'ALL', false);

    // Click 10-K filter button — hook re-called with '10-K'.
    fireEvent.click(screen.getByRole('button', { name: '10-K' }));
    expect(mockUseFilingsData).toHaveBeenCalledWith('AAPL', '10-K', false);
  });

  it('shows a loading indicator while data is pending', () => {
    mockUseFilingsData.mockReturnValue({ ...LOADED_STATE, filings: [], isLoading: true });
    renderFilingPanel();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows an empty-state message when there are no filings', () => {
    mockUseFilingsData.mockReturnValue({ ...LOADED_STATE, filings: [], total: 0 });
    renderFilingPanel('TSLA');
    expect(screen.getByText(/no filings for TSLA/i)).toBeInTheDocument();
  });

  it('shows an empty-state message scoped to the active filter', () => {
    mockUseFilingsData.mockReturnValue({ ...LOADED_STATE, filings: [], total: 0 });
    renderFilingPanel('TSLA');

    fireEvent.click(screen.getByRole('button', { name: '8-K' }));
    expect(screen.getByText(/no 8-K filings for TSLA/i)).toBeInTheDocument();
  });

  it('shows the MOCK badge when data is from mock layer', () => {
    mockUseFilingsData.mockReturnValue({ ...LOADED_STATE, isUsingMockData: true });
    renderFilingPanel();
    expect(screen.getByText('MOCK')).toBeInTheDocument();
  });

  it('filing row opens EDGAR URL in new tab on click', () => {
    mockUseFilingsData.mockReturnValue(LOADED_STATE);
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderFilingPanel();

    const row = screen.getByText('Annual Report FY2025').closest('[role="link"]');
    expect(row).not.toBeNull();
    fireEvent.click(row!);

    expect(openSpy).toHaveBeenCalledWith(
      MOCK_FILINGS[0]!.filing_url,
      '_blank',
      'noopener,noreferrer',
    );
    openSpy.mockRestore();
  });
});
