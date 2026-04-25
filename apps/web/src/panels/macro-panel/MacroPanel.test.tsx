/**
 * MacroPanel unit tests.
 *
 * useMacroData is mocked so no backend is required. Tests cover
 * series selector rendering, data table rows, loading state, and
 * empty state when a series has no observations.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Mock the data hook ────────────────────────────────────────────────────────
const mockUseMacroData = vi.fn();
vi.mock('./use-macro-data', () => ({
  useMacroData: (...args: unknown[]): unknown =>
    (mockUseMacroData as (...a: unknown[]) => unknown)(...args),
}));

import { MacroPanel } from './MacroPanel';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const MOCK_SERIES = {
  series_id: 'GDP',
  name: 'Gross Domestic Product',
  unit: 'Billions of Dollars',
  bars: [
    { ts: '2026-01-01T00:00:00Z', value: 28456.0 },
    { ts: '2025-10-01T00:00:00Z', value: 28100.5 },
    { ts: '2025-07-01T00:00:00Z', value: 27800.2 },
  ],
  source: 'mock',
};

const LOADED_STATE = {
  series: MOCK_SERIES,
  isLoading: false,
  isError: false,
  error: null,
  isUsingMockData: true,
  refetch: vi.fn(),
};

type RenderOptions = {
  seriesId?: string;
  onSeriesChange?: (id: string) => void;
};

function renderMacroPanel({
  seriesId = 'GDP',
  onSeriesChange = vi.fn(),
}: RenderOptions = {}): ReturnType<typeof render> {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MacroPanel
        panelId="test-macro"
        isActive={false}
        onClose={vi.fn()}
        seriesId={seriesId}
        onSeriesChange={onSeriesChange}
      />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MacroPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the series name when data is loaded', () => {
    mockUseMacroData.mockReturnValue(LOADED_STATE);
    renderMacroPanel();
    expect(screen.getByText('Gross Domestic Product')).toBeInTheDocument();
  });

  it('renders the series unit in the header', () => {
    mockUseMacroData.mockReturnValue(LOADED_STATE);
    renderMacroPanel();
    expect(screen.getByText('Billions of Dollars')).toBeInTheDocument();
  });

  it('renders a data row for each observation (newest first)', () => {
    mockUseMacroData.mockReturnValue(LOADED_STATE);
    renderMacroPanel();
    // Three bars — three rows with a value
    expect(screen.getByText('28,456.00')).toBeInTheDocument();
  });

  it('shows a loading indicator while data is pending', () => {
    mockUseMacroData.mockReturnValue({ ...LOADED_STATE, series: null, isLoading: true });
    renderMacroPanel();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows an empty-state message when series has no bars', () => {
    mockUseMacroData.mockReturnValue({
      ...LOADED_STATE,
      series: { ...MOCK_SERIES, bars: [] },
    });
    renderMacroPanel({ seriesId: 'GDP' });
    expect(screen.getByText(/no data for GDP/i)).toBeInTheDocument();
  });

  it('shows the MOCK badge when data is from mock layer', () => {
    mockUseMacroData.mockReturnValue({ ...LOADED_STATE, isUsingMockData: true });
    renderMacroPanel();
    expect(screen.getByText('MOCK')).toBeInTheDocument();
  });

  it('renders the series selector with all available series options', () => {
    mockUseMacroData.mockReturnValue(LOADED_STATE);
    renderMacroPanel();
    const select = screen.getByRole('combobox', { name: /select macro series/i });
    expect(select).toBeInTheDocument();
    // The 5 default series should be available as options
    expect(screen.getByRole('option', { name: 'GDP' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'CPI' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Fed Funds' })).toBeInTheDocument();
  });

  it('calls onSeriesChange when a different series is selected', () => {
    mockUseMacroData.mockReturnValue(LOADED_STATE);
    const onSeriesChange = vi.fn();
    renderMacroPanel({ onSeriesChange });

    const select = screen.getByRole('combobox', { name: /select macro series/i });
    fireEvent.change(select, { target: { value: 'FEDFUNDS' } });

    expect(onSeriesChange).toHaveBeenCalledWith('FEDFUNDS');
  });

  it('passes seriesId and isVisible to useMacroData', () => {
    mockUseMacroData.mockReturnValue(LOADED_STATE);
    renderMacroPanel({ seriesId: 'UNRATE' });
    expect(mockUseMacroData).toHaveBeenCalledWith('UNRATE', true);
  });
});
