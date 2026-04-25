/**
 * useRealtimePrice — subscribe to live price updates for one symbol.
 *
 * Wraps the WS client singleton (wsClient) in a React hook:
 *  - Subscribes on mount; unsubscribes on unmount or symbol change.
 *  - Returns the latest PriceUpdateEvent for the symbol (null until first tick).
 *  - Sets isStale = true when no tick arrives for STALE_THRESHOLD_SECONDS
 *    (the gateway sends a StaleEvent); resets to false on next tick.
 *  - If WS is disabled (VITE_WS_URL not set) always returns { price: null, isStale: false }.
 *
 * Panels should continue to display REST-fetched data from TanStack Query and
 * overlay the WS price on top — WS price supersedes the REST snapshot for the
 * "last price" field only.
 */
import { useState, useEffect, useRef } from 'react';
import type { PriceUpdateEvent } from '@terminal/types';
import { wsClient } from '@/lib/ws/ws-client';

export type RealtimePriceResult = {
  /** Latest price tick, or null if no tick received since mount. */
  price: PriceUpdateEvent | null;
  /** True after a StaleEvent; resets to false on the next price tick. */
  isStale: boolean;
};

/**
 * Subscribe to real-time price updates for a symbol.
 *
 * @param symbol - Ticker or coin id (e.g. "AAPL", "BTC"). Pass empty string to disable.
 */
export function useRealtimePrice(symbol: string): RealtimePriceResult {
  const [price, setPrice] = useState<PriceUpdateEvent | null>(null);
  const [isStale, setIsStale] = useState(false);

  // Track the previous symbol to reset state on symbol change
  const prevSymbolRef = useRef(symbol);

  useEffect(() => {
    if (prevSymbolRef.current !== symbol) {
      // Symbol changed — clear stale data from prior symbol
      setPrice(null);
      setIsStale(false);
      prevSymbolRef.current = symbol;
    }

    if (!symbol || !wsClient.isEnabled) return;

    const unsubPrice = wsClient.subscribePriceUpdates(symbol, (event) => {
      setPrice(event);
      setIsStale(false);
    });

    const unsubStale = wsClient.subscribeStale(symbol, () => {
      setIsStale(true);
    });

    return (): void => {
      unsubPrice();
      unsubStale();
    };
  }, [symbol]);

  return { price, isStale };
}
