/**
 * FRED macro data API client functions.
 *
 * Wraps GET /api/v1/macro and GET /api/v1/macro/{series_id}.
 * Source: Federal Reserve Economic Data (FRED) — see ADR-005.
 */
import type { MacroSeriesListResponse, MacroSeriesResponse } from '@terminal/types';

import { apiGet } from './client';
import { API_V1_PREFIX } from './constants';

/**
 * Fetch all available macro series metadata (no bar data).
 *
 * Used by the MacroPanel series selector to populate the series list.
 */
export async function fetchMacroSeriesList(): Promise<MacroSeriesListResponse> {
  return apiGet<MacroSeriesListResponse>(`${API_V1_PREFIX}/macro`);
}

/**
 * Fetch bar data for a single FRED macro series.
 *
 * @param seriesId - FRED series ID, e.g. 'GDP', 'CPIAUCSL', 'FEDFUNDS'
 * @param limit    - Maximum number of observations to return (default 60)
 */
export async function fetchMacroSeries(seriesId: string, limit = 60): Promise<MacroSeriesResponse> {
  return apiGet<MacroSeriesResponse>(`${API_V1_PREFIX}/macro/${encodeURIComponent(seriesId)}`, {
    limit: String(limit),
  });
}
