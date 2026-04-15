/**
 * useInstruments — TanStack Query hook for the instrument list.
 *
 * Fetches all tradeable instruments from the API and builds a Fuse.js
 * search index for client-side fuzzy matching in the CommandPalette.
 *
 * Falls back to a curated set of placeholder instruments when the backend
 * is not reachable (e.g. local dev without the API running), so the
 * command palette is always functional.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import Fuse from 'fuse.js';
import type { InstrumentListResponse, InstrumentResponse } from '@terminal/types';

import { fetchInstruments } from '@/lib/api/instruments.api';

/** 5 minutes — instrument list is stable; changes require a backend deployment. */
const INSTRUMENTS_STALE_TIME_MS = 5 * 60_000;

/**
 * Placeholder instruments shown while the backend is unreachable.
 * Covers the top crypto assets tracked by this terminal via CoinGecko.
 * Symbol values are CoinGecko coin IDs, matching what the OHLCV endpoint expects.
 */
const PLACEHOLDER_INSTRUMENTS: InstrumentResponse[] = [
  { symbol: 'bitcoin', name: 'Bitcoin', asset_class: 'crypto', exchange: null, currency: 'USD' },
  { symbol: 'ethereum', name: 'Ethereum', asset_class: 'crypto', exchange: null, currency: 'USD' },
  { symbol: 'solana', name: 'Solana', asset_class: 'crypto', exchange: null, currency: 'USD' },
  { symbol: 'binancecoin', name: 'BNB', asset_class: 'crypto', exchange: null, currency: 'USD' },
  { symbol: 'ripple', name: 'XRP', asset_class: 'crypto', exchange: null, currency: 'USD' },
  { symbol: 'cardano', name: 'Cardano', asset_class: 'crypto', exchange: null, currency: 'USD' },
  {
    symbol: 'avalanche-2',
    name: 'Avalanche',
    asset_class: 'crypto',
    exchange: null,
    currency: 'USD',
  },
  { symbol: 'polkadot', name: 'Polkadot', asset_class: 'crypto', exchange: null, currency: 'USD' },
  {
    symbol: 'chainlink',
    name: 'Chainlink',
    asset_class: 'crypto',
    exchange: null,
    currency: 'USD',
  },
  { symbol: 'uniswap', name: 'Uniswap', asset_class: 'crypto', exchange: null, currency: 'USD' },
  { symbol: 'dogecoin', name: 'Dogecoin', asset_class: 'crypto', exchange: null, currency: 'USD' },
  { symbol: 'litecoin', name: 'Litecoin', asset_class: 'crypto', exchange: null, currency: 'USD' },
  { symbol: 'stellar', name: 'Stellar', asset_class: 'crypto', exchange: null, currency: 'USD' },
  {
    symbol: 'the-open-network',
    name: 'Toncoin',
    asset_class: 'crypto',
    exchange: null,
    currency: 'USD',
  },
  {
    symbol: 'shiba-inu',
    name: 'Shiba Inu',
    asset_class: 'crypto',
    exchange: null,
    currency: 'USD',
  },
];

const PLACEHOLDER_LIST: InstrumentListResponse = {
  instruments: PLACEHOLDER_INSTRUMENTS,
  total: PLACEHOLDER_INSTRUMENTS.length,
  limit: PLACEHOLDER_INSTRUMENTS.length,
  offset: 0,
};

export type InstrumentsResult = {
  instruments: InstrumentResponse[];
  fuse: Fuse<InstrumentResponse>;
};

export function useInstruments(): UseQueryResult<InstrumentsResult, Error> {
  return useQuery({
    queryKey: ['instruments'],
    queryFn: async (): Promise<InstrumentListResponse> => {
      try {
        return await fetchInstruments({ limit: 500, offset: 0 });
      } catch {
        // Backend not reachable in local dev — return placeholder data so the
        // command palette remains functional without the API running.
        return PLACEHOLDER_LIST;
      }
    },
    staleTime: INSTRUMENTS_STALE_TIME_MS,
    select: (data): InstrumentsResult => {
      const fuse = new Fuse<InstrumentResponse>(data.instruments, {
        keys: ['symbol', 'name'],
        // 0.35 threshold: close matches only — avoids noise in short queries.
        threshold: 0.35,
        includeScore: true,
      });
      return { instruments: data.instruments, fuse };
    },
  });
}
