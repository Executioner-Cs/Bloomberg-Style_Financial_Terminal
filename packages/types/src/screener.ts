export type FilterOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'in' | 'contains';

export type ScreenerFilter = {
  field: string;
  operator: FilterOperator;
  value: number | string | string[];
};

export type ScreenerSort = {
  field: string;
  direction: 'asc' | 'desc';
};

export type ScreenerRequest = {
  filters: ScreenerFilter[];
  sort: ScreenerSort[];
  page: number;
  pageSize: number;
};

export type ScreenerRow = {
  symbol: string;
  name: string;
  exchange: string;
  marketCap: number | null;
  price: number | null;
  changePct: number | null;
  peRatio: number | null;
  pbRatio: number | null;
  evToEbitda: number | null;
  revenueGrowth: number | null;
  grossMargin: number | null;
};

export type ScreenerResponse = {
  rows: ScreenerRow[];
  total: number;
  page: number;
  pageSize: number;
  executedInMs: number;
};
