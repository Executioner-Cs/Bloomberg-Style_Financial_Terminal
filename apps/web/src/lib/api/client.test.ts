/**
 * API client unit tests.
 *
 * Covers:
 *   - ApiError is thrown on non-2xx responses (status, statusText, message)
 *   - Query params are correctly encoded (single values, array values)
 *   - AbortController signals a timeout when the request hangs
 *
 * Uses vi.stubGlobal to mock fetch — no real HTTP calls.
 *
 * Plan ref: M4 audit item.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiGet, ApiError } from './client';

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

/** Create a mock Response with a given status and optional JSON body. */
function mockResponse(status: number, body: unknown = {}, statusText = 'OK'): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

// ------------------------------------------------------------------
// Setup: replace global fetch with a vi.fn() before each test.
// ------------------------------------------------------------------

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ------------------------------------------------------------------
// Successful requests
// ------------------------------------------------------------------

describe('apiGet — successful response', () => {
  it('returns parsed JSON on 200', async () => {
    const payload = { symbol: 'AAPL', price: 190.5 };
    vi.mocked(fetch).mockResolvedValue(mockResponse(200, payload));

    const result = await apiGet<typeof payload>('/api/v1/quote/AAPL');
    expect(result).toEqual(payload);
  });
});

// ------------------------------------------------------------------
// ApiError — non-2xx responses
// ------------------------------------------------------------------

describe('ApiError — thrown on non-2xx', () => {
  it('throws ApiError with status 404', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse(404, {}, 'Not Found'));

    await expect(apiGet('/api/v1/instruments/UNKNOWN')).rejects.toThrow(ApiError);
  });

  it('ApiError carries the correct status code', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse(500, {}, 'Internal Server Error'));

    let caught: ApiError | null = null;
    try {
      await apiGet('/api/v1/ohlcv');
    } catch (err) {
      if (err instanceof ApiError) caught = err;
    }

    expect(caught).not.toBeNull();
    expect(caught?.status).toBe(500);
    expect(caught?.statusText).toBe('Internal Server Error');
  });

  it('ApiError message includes the path', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse(403, {}, 'Forbidden'));

    let caught: ApiError | null = null;
    try {
      await apiGet('/api/v1/admin');
    } catch (err) {
      if (err instanceof ApiError) caught = err;
    }

    expect(caught?.message).toContain('/api/v1/admin');
  });

  it('ApiError name is "ApiError"', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse(401, {}, 'Unauthorized'));

    let caught: ApiError | null = null;
    try {
      await apiGet('/api/v1/protected');
    } catch (err) {
      if (err instanceof ApiError) caught = err;
    }

    expect(caught?.name).toBe('ApiError');
  });
});

// ------------------------------------------------------------------
// Query parameter encoding
// ------------------------------------------------------------------

describe('apiGet — query parameter encoding', () => {
  it('appends single string params to the URL', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse(200, []));

    await apiGet('/api/v1/news', { q: 'inflation' });

    const calledUrl = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain('q=inflation');
  });

  it('appends multiple different params', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse(200, []));

    await apiGet('/api/v1/instruments', { page: '1', page_size: '20' });

    const calledUrl = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain('page=1');
    expect(calledUrl).toContain('page_size=20');
  });

  it('appends array params as multiple entries with the same key', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse(200, []));

    await apiGet('/api/v1/ohlcv', { symbols: ['AAPL', 'MSFT', 'GOOGL'] });

    const calledUrl = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    const url = new URL(calledUrl, 'http://localhost');
    const symbols = url.searchParams.getAll('symbols');
    expect(symbols).toEqual(['AAPL', 'MSFT', 'GOOGL']);
  });

  it('sends the request without query string when params is undefined', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse(200, {}));

    await apiGet('/api/v1/health');

    const calledUrl = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(calledUrl).toBe('/api/v1/health');
  });
});

// ------------------------------------------------------------------
// Timeout / abort
// ------------------------------------------------------------------

describe('apiGet — AbortController timeout', () => {
  it('calls abort() after the timeout expires', async () => {
    vi.useFakeTimers();

    // Stub AbortController to track abort() calls without triggering jsdom's
    // internal error-reporting path (jsdom fires an abort event synchronously
    // and logs any associated errors as unhandled even when the promise chain
    // catches them — stubbing avoids this environment-specific noise).
    const abortSpy = vi.fn();
    class MockAbortController {
      signal = { addEventListener: vi.fn() } as unknown as AbortSignal;
      abort = abortSpy;
    }
    vi.stubGlobal('AbortController', MockAbortController);

    vi.mocked(fetch).mockReturnValue(new Promise(() => {}));

    // Fire and forget — we only care that abort() is called after the timeout.
    void apiGet('/api/v1/slow-endpoint').catch(() => {});
    await vi.advanceTimersByTimeAsync(31_000);

    expect(abortSpy).toHaveBeenCalledOnce();

    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});
