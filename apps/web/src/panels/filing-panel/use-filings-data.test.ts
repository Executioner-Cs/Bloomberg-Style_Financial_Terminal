/**
 * Unit tests for useFilingsData.
 *
 * Covers: API happy path, mock-filings fallback, isUsingMockData flag,
 * enabled-gate (empty symbol / not visible), formType='ALL' mock branch.
 *
 * All network calls are mocked — no real HTTP (CLAUDE.md Part XI).
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ── Mock the API module ───────────────────────────────────────────────────────
vi.mock('@/lib/api/filings.api', () => ({
  fetchFilings: vi.fn(),
}));

import { fetchFilings } from '@/lib/api/filings.api';
import { useFilingsData } from './use-filings-data';

const mockFetchFilings = fetchFilings as Mock;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWrapper(): React.ComponentType<{ children: React.ReactNode }> {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }): React.ReactElement {
    return React.createElement(QueryClientProvider, { client }, children);
  }
  return Wrapper;
}

const LIVE_FILING = {
  symbol: 'AAPL',
  form_type: '10-K',
  filed_at: '2026-01-15T00:00:00.000Z',
  period_of_report: '2025-12-31',
  accession_number: '0000320193-26-000001',
  filing_url: 'https://sec.gov/filing/1',
  description: 'Annual report',
};

const LIVE_RESPONSE = {
  symbol: 'AAPL',
  filings: [LIVE_FILING],
  total: 1,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useFilingsData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns filings from API on happy path', async () => {
    mockFetchFilings.mockResolvedValue(LIVE_RESPONSE);

    const { result } = renderHook(() => useFilingsData('AAPL', '10-K'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.filings).toHaveLength(1);
    expect(result.current.filings[0]?.form_type).toBe('10-K');
    expect(result.current.total).toBe(1);
    expect(result.current.isUsingMockData).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it('falls back to mock filings when fetchFilings throws', async () => {
    mockFetchFilings.mockRejectedValue(new Error('EDGAR down'));

    const { result } = renderHook(() => useFilingsData('AAPL', '10-K'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.filings.length).toBeGreaterThan(0);
    expect(result.current.isUsingMockData).toBe(true);
    expect(result.current.isError).toBe(false);
  });

  it('generates multiple form types when formType is ALL', async () => {
    mockFetchFilings.mockRejectedValue(new Error('down'));

    const { result } = renderHook(() => useFilingsData('AAPL', 'ALL'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // ALL → 3 form types × 3 filings each = 9 filings
    expect(result.current.filings).toHaveLength(9);
    const formTypes = new Set(result.current.filings.map((f) => f.form_type));
    expect(formTypes).toContain('10-K');
    expect(formTypes).toContain('10-Q');
    expect(formTypes).toContain('8-K');
  });

  it('stays idle when symbol is empty string', async () => {
    const { result } = renderHook(() => useFilingsData('', 'ALL'), {
      wrapper: makeWrapper(),
    });

    await new Promise((r) => setTimeout(r, 50));

    expect(mockFetchFilings).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.filings).toEqual([]);
  });

  it('stays idle when isVisible is false', async () => {
    const { result } = renderHook(() => useFilingsData('AAPL', 'ALL', false), {
      wrapper: makeWrapper(),
    });

    await new Promise((r) => setTimeout(r, 50));

    expect(mockFetchFilings).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });
});
