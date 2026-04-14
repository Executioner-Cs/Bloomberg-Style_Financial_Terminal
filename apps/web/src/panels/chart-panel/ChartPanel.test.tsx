/**
 * ChartPanel unit tests.
 *
 * lightweight-charts requires a real canvas and DOM measurement APIs
 * (getBoundingClientRect, ResizeObserver) that jsdom does not provide.
 * The entire module is mocked so we can test the React component behaviour
 * — loading states, error states, toolbar rendering — without a real chart.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Mock lightweight-charts ─────────────────────────────────────────────────
vi.mock('lightweight-charts', () => ({
  createChart: vi.fn(() => ({
    addCandlestickSeries: vi.fn(() => ({
      setData: vi.fn(),
    })),
    applyOptions: vi.fn(),
    timeScale: vi.fn(() => ({ fitContent: vi.fn() })),
    remove: vi.fn(),
  })),
}));

// ── Mock ResizeObserver (not in jsdom) ──────────────────────────────────────
const mockResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
}));
vi.stubGlobal('ResizeObserver', mockResizeObserver);

// ── Mock use-chart-data hook ────────────────────────────────────────────────
const mockUseChartData = vi.fn();
vi.mock('./use-chart-data', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useChartData: (...args: unknown[]): unknown =>
    (mockUseChartData as (...a: unknown[]) => unknown)(...args),
}));

import { ChartPanel } from './ChartPanel';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

type RenderChartPanelOptions = {
  symbol?: string;
  onClose?: Mock;
};

function renderChartPanel({
  symbol = 'bitcoin',
  onClose = vi.fn(),
}: RenderChartPanelOptions = {}): ReturnType<typeof render> {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <ChartPanel panelId="test-chart" isActive={false} onClose={onClose} symbol={symbol} />
    </QueryClientProvider>,
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ChartPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the symbol in the header', () => {
    mockUseChartData.mockReturnValue({
      chartBars: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    renderChartPanel({ symbol: 'ethereum' });

    expect(screen.getByText('ETHEREUM')).toBeInTheDocument();
  });

  it('should show PanelSkeleton while loading', () => {
    mockUseChartData.mockReturnValue({
      chartBars: [],
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    renderChartPanel();

    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });

  it('should show PanelError when query fails', () => {
    const testError = new Error('Network timeout');
    mockUseChartData.mockReturnValue({
      chartBars: [],
      isLoading: false,
      isError: true,
      error: testError,
      refetch: vi.fn(),
    });

    renderChartPanel();

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Network timeout')).toBeInTheDocument();
  });

  it('should render timeframe selector buttons', () => {
    mockUseChartData.mockReturnValue({
      chartBars: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    renderChartPanel();

    expect(screen.getByRole('button', { name: '1D' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1W' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1M' })).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn();
    mockUseChartData.mockReturnValue({
      chartBars: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    renderChartPanel({ onClose });

    fireEvent.click(screen.getByRole('button', { name: /close chart panel/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('should call retry when error retry button is clicked', () => {
    const mockRefetch = vi.fn().mockResolvedValue(undefined);
    mockUseChartData.mockReturnValue({
      chartBars: [],
      isLoading: false,
      isError: true,
      error: new Error('Failed'),
      refetch: mockRefetch,
    });

    renderChartPanel();

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(mockRefetch).toHaveBeenCalledOnce();
  });

  it('should pass symbol and timeframe to useChartData', () => {
    mockUseChartData.mockReturnValue({
      chartBars: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    renderChartPanel({ symbol: 'solana' });

    expect(mockUseChartData).toHaveBeenCalledWith('solana', '1D');
  });
});
