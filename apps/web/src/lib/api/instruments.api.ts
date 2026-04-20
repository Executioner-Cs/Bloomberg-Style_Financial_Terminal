/**
 * Instruments API client functions.
 *
 * Fetches instrument metadata from the FastAPI /instruments endpoints.
 * No business logic — pure data access.
 */
import type { InstrumentListResponse, InstrumentResponse } from '@terminal/types';

import { apiGet } from './client';
import { API_V1_PREFIX } from './constants';

export type FetchInstrumentsParams = {
  assetClass?: string;
  limit?: number;
  offset?: number;
};

/**
 * List instruments with optional filtering and pagination.
 */
export async function fetchInstruments(
  params: FetchInstrumentsParams = {},
): Promise<InstrumentListResponse> {
  const queryParams: Record<string, string> = {};
  if (params.assetClass !== undefined) queryParams['asset_class'] = params.assetClass;
  if (params.limit !== undefined) queryParams['limit'] = String(params.limit);
  if (params.offset !== undefined) queryParams['offset'] = String(params.offset);

  return apiGet<InstrumentListResponse>(`${API_V1_PREFIX}/instruments`, queryParams);
}

/**
 * Fetch a single instrument by symbol.
 *
 * @throws {ApiError} with status 404 if the symbol does not exist.
 */
export async function fetchInstrument(symbol: string): Promise<InstrumentResponse> {
  return apiGet<InstrumentResponse>(`${API_V1_PREFIX}/instruments/${encodeURIComponent(symbol)}`);
}
