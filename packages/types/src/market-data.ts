/** OHLCV bar for a given timeframe */
export type OHLCVBar = {
  ts: number;    // Unix timestamp in milliseconds (UTC)
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
  price: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  changePct: number;
  changeAbs: number;
  ts: number;
};

export type OHLCVResponse = {
  symbol: string;
  timeframe: Timeframe;
  bars: OHLCVBar[];
  from: string;
  to: string;
};
