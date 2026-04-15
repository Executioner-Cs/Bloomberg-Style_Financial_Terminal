/** OHLCV bar for a given timeframe — ts is an ISO 8601 string as returned by the API */
export type OHLCVBar = {
  ts: string; // ISO 8601 UTC string — convert to Unix ms via new Date(ts).getTime()
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjClose: number | null;
};

export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1H' | '4H' | '1D' | '1W' | '1M';

export type Quote = {
  symbol: string;
  price: number | null;
  /** 24-hour price change as a decimal fraction. e.g. 0.03 = +3%. */
  change_24h: number | null;
  volume_24h: number | null;
  /** ISO 8601 UTC string from JSON serialization of datetime. */
  ts: string | null;
};

export type OHLCVResponse = {
  symbol: string;
  timeframe: Timeframe;
  bars: OHLCVBar[];
  source: string;
};

export type BulkQuotesResponse = {
  quotes: Record<string, Quote>;
};

/** Instrument as returned by the REST API */
export type InstrumentResponse = {
  symbol: string;
  name: string;
  asset_class: string;
  exchange: string | null;
  currency: string;
};

export type InstrumentListResponse = {
  instruments: InstrumentResponse[];
  total: number;
  limit: number;
  offset: number;
};
