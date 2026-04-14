/** Instrument — a tradeable security in the system */
export type AssetClass = 'equity' | 'fx' | 'crypto' | 'index' | 'etf' | 'futures';

export type Instrument = {
  id: string;
  symbol: string;
  exchange: string;
  name: string;
  assetClass: AssetClass;
  currency: string;
  isin: string | null;
  cusip: string | null;
  cik: string | null;
  isActive: boolean;
};

export type InstrumentSearchResult = Pick<Instrument, 'id' | 'symbol' | 'exchange' | 'name' | 'assetClass' | 'currency'>;
