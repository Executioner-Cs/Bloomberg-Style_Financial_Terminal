/**
 * Market data API client functions.
 *
 * Each function maps 1-to-1 to a FastAPI endpoint and returns typed response
 * shapes from @terminal/types. The API client layer is the only place that
 * knows endpoint paths — nothing above this layer constructs URLs.
 */
import type { BulkQuotesResponse, OHLCVResponse, Timeframe } from '@terminal/types';

import { apiGet } from './client';
import { API_V1_PREFIX } from './constants';

/**
 * Fetch OHLCV bars for a symbol and timeframe.
 *
 * @param symbol    - CoinGecko coin id, e.g. "bitcoin"
 * @param timeframe - Bar resolution — defaults to '1D'
 * @param from      - ISO 8601 start date (optional)
 * @param to        - ISO 8601 end date (optional)
 */
export async function fetchOHLCV(
  symbol: string,
  timeframe: Timeframe = '1D',
  from?: string,
  to?: string,
): Promise<OHLCVResponse> {
  const params: Record<string, string> = { timeframe };
  if (from !== undefined) params['from_date'] = from;
  if (to !== undefined) params['to_date'] = to;

  return apiGet<OHLCVResponse>(
    `${API_V1_PREFIX}/market-data/${encodeURIComponent(symbol)}/ohlcv`,
    params,
  );
}

/**
 * Fetch quotes for multiple symbols in a single request.
 *
 * @param symbols - Array of CoinGecko coin ids
 */
export async function fetchBulkQuotes(symbols: string[]): Promise<BulkQuotesResponse> {
  return apiGet<BulkQuotesResponse>(`${API_V1_PREFIX}/market-data/quotes/bulk`, {
    symbols: symbols.join(','),
  });
}
