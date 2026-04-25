/**
 * Macro data types — mirrors services/api/src/schemas/macro.py.
 *
 * Source: FRED (Federal Reserve Economic Data).
 * These types are the frontend contract for GET /api/v1/macro endpoints.
 */

export type MacroBar = {
  /** Observation date — ISO 8601 UTC string from the API (JSON-serialised datetime). */
  ts: string;
  /** Observation value. Units depend on the series (see `unit` in MacroSeriesResponse). */
  value: number;
};

export type MacroSeriesResponse = {
  /** FRED series identifier, e.g. 'GDP', 'CPIAUCSL'. */
  series_id: string;
  /** Human-readable series name. */
  name: string;
  /** Measurement unit, e.g. 'Percent', 'Billions of Dollars'. */
  unit: string;
  /** Ordered observations, oldest first. */
  bars: MacroBar[];
  /** Data provider that sourced these observations. */
  source: string;
};

export type MacroSeriesMeta = {
  series_id: string;
  name: string;
  unit: string;
  /** Most recent observation value — null when no data is available. */
  latest_value: number | null;
  /** Most recent observation date — ISO 8601 UTC string — null when no data. */
  latest_ts: string | null;
};

export type MacroSeriesListResponse = {
  /** All available macro series metadata (no bar data). */
  series: MacroSeriesMeta[];
};
