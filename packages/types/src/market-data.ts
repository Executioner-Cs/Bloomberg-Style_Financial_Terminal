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
  changePct: number | null;
  changeAbs: number | null;
  volume: number | null;
  ts: number | null; // Unix ms
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
