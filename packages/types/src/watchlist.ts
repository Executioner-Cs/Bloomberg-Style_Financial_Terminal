export type WatchlistItem = {
  symbol: string;
  name: string;
  price: number | null;
  changePct: number | null;
  changeAbs: number | null;
  volume: number | null;
  marketCap: number | null;
  position: number;
};

export type Watchlist = {
  id: string;
  name: string;
  isDefault: boolean;
  items: WatchlistItem[];
  createdAt: string;
};
