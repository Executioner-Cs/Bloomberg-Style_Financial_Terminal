/**
 * SEC EDGAR filings API client functions.
 *
 * Wraps GET /api/v1/filings/{symbol} with an optional form_type filter.
 * ADR-009 documents the 24-hour cache TTL that applies to these responses.
 */
import type { FilingsResponse } from '@terminal/types';

import { apiGet } from './client';
import { API_V1_PREFIX } from './constants';

/** Supported EDGAR form type filters. 'ALL' is a UI-only sentinel — not sent to API. */
export type FilingFormType = 'ALL' | '10-K' | '10-Q' | '8-K';

/**
 * Fetch SEC EDGAR filings for a symbol.
 *
 * @param symbol   - Equity ticker, e.g. "AAPL"
 * @param formType - Optional form type filter; omit or pass 'ALL' for all types
 * @param limit    - Maximum number of filings to return (default 20)
 */
export async function fetchFilings(
  symbol: string,
  formType: FilingFormType = 'ALL',
  limit = 20,
): Promise<FilingsResponse> {
  const params: Record<string, string> = { limit: String(limit) };
  if (formType !== 'ALL') params['form_type'] = formType;

  return apiGet<FilingsResponse>(`${API_V1_PREFIX}/filings/${encodeURIComponent(symbol)}`, params);
}
