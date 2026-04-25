/**
 * Finnhub WebSocket provider — equities real-time trade feed.
 *
 * Finnhub WS delivers individual trade events (symbol, price, volume, timestamp).
 * It does NOT provide daily open/previous close, so changePct and changeAbs are
 * set to 0 for WS-sourced updates; the REST quote endpoint provides the daily
 * change on the initial panel load.
 *
 * Auth: `?token=<FINNHUB_API_KEY>` query param on the WS URL.
 * If FINNHUB_API_KEY is absent the provider starts in degraded mode and logs a
 * warning — crypto via Binance still works.
 *
 * Routing: symbols not in CRYPTO_TICKERS go to Finnhub (e.g. "AAPL", "MSFT").
 *
 * Lifecycle:
 *  - updateSubscriptions() diffs the desired set against the current one
 *    and sends subscribe/unsubscribe messages over the open socket.
 *  - Exponential backoff on close/error (1s → 2s → 4s … 60s cap).
 *
 * Redis contract: publishes JSON-serialised PriceUpdateEvent to channel
 * `prices:<SYMBOL>` (uppercase canonical symbol).
 */
import WebSocket from 'ws';
import type { Redis } from 'ioredis';
import type { Config } from '../config.js';
import type { PriceUpdateEvent } from '@terminal/types';

// ── Finnhub message shapes ─────────────────────────────────────────────────────

type FinnhubTrade = {
  p: number; // Last price
  s: string; // Symbol
  t: number; // Unix ms timestamp
  v: number; // Volume
};

type FinnhubTradeMessage = {
  type: 'trade';
  data: FinnhubTrade[];
};

type FinnhubMessage = FinnhubTradeMessage | { type: string };

// ── Provider ───────────────────────────────────────────────────────────────────

const MAX_BACKOFF_MS = 60_000;
const REDIS_CHANNEL_PREFIX = 'prices:';

export class FinnhubProvider {
  private ws: WebSocket | null = null;
  private subscribedSymbols = new Set<string>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = 1_000;
  private isDestroyed = false;
  private isConnected = false;

  constructor(
    private readonly redis: Redis,
    private readonly config: Config,
    private readonly logger: {
      info: (msg: string) => void;
      warn: (msg: string) => void;
      error: (msg: string, err?: unknown) => void;
      debug: (msg: string) => void;
    },
  ) {}

  /**
   * Apply a new desired symbol set. Sends incremental subscribe/unsubscribe
   * messages if the connection is already open, otherwise reconnects.
   */
  updateSubscriptions(symbols: ReadonlySet<string>): void {
    if (!this.config.FINNHUB_API_KEY) {
      this.logger.warn(
        '[Finnhub] FINNHUB_API_KEY not set — equities WS disabled. ' +
          'Set the key in .env to enable real-time equity prices.',
      );
      return;
    }

    const toAdd = [...symbols].filter((s) => !this.subscribedSymbols.has(s));
    const toRemove = [...this.subscribedSymbols].filter((s) => !symbols.has(s));

    for (const s of toAdd) this.subscribedSymbols.add(s);
    for (const s of toRemove) this.subscribedSymbols.delete(s);

    if (!this.isConnected) {
      this.connect();
      return;
    }

    // Socket is open — send incremental diff
    for (const s of toAdd) this.sendSubscribe(s);
    for (const s of toRemove) this.sendUnsubscribe(s);
  }

  /** Open the Finnhub WebSocket. Called internally; use updateSubscriptions() externally. */
  connect(): void {
    if (!this.config.FINNHUB_API_KEY) return;
    if (this.isDestroyed) return;
    if (this.subscribedSymbols.size === 0) return;

    const url = `${this.config.FINNHUB_WS_URL}?token=${this.config.FINNHUB_API_KEY}`;
    this.logger.info('[Finnhub] Connecting');

    const ws = new WebSocket(url);
    this.ws = ws;

    ws.on('open', () => {
      this.logger.info('[Finnhub] Connected');
      this.isConnected = true;
      this.backoffMs = 1_000;
      // Subscribe to all desired symbols after reconnect
      for (const s of this.subscribedSymbols) this.sendSubscribe(s);
    });

    ws.on('message', (data: Buffer) => {
      this.handleMessage(data);
    });

    ws.on('close', (code: number) => {
      this.logger.info(`[Finnhub] Disconnected (${code})`);
      this.isConnected = false;
      if (!this.isDestroyed && this.subscribedSymbols.size > 0) {
        this.scheduleReconnect();
      }
    });

    ws.on('error', (err: Error) => {
      this.logger.error('[Finnhub] Stream error', err);
    });
  }

  destroy(): void {
    this.isDestroyed = true;
    this.clearReconnect();
    this.ws?.close();
    this.ws = null;
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private sendSubscribe(symbol: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe', symbol }));
    }
  }

  private sendUnsubscribe(symbol: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'unsubscribe', symbol }));
    }
  }

  private handleMessage(data: Buffer): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data.toString());
    } catch {
      this.logger.debug('[Finnhub] Failed to parse message');
      return;
    }

    const msg = parsed as FinnhubMessage;
    if (msg.type !== 'trade') return;

    const trades = (msg as FinnhubTradeMessage).data;
    if (!Array.isArray(trades) || trades.length === 0) return;

    // Aggregate trades per symbol — publish only the latest price
    const latestBySymbol = new Map<string, FinnhubTrade>();
    for (const trade of trades) {
      const existing = latestBySymbol.get(trade.s);
      if (existing === undefined || trade.t > existing.t) {
        latestBySymbol.set(trade.s, trade);
      }
    }

    for (const [symbol, trade] of latestBySymbol) {
      const event: PriceUpdateEvent = {
        type: 'price',
        symbol,
        price: trade.p,
        // Finnhub trade events don't include daily open; REST quote provides change on load.
        changePct: 0,
        changeAbs: 0,
        volume: trade.v,
        ts: trade.t,
      };

      this.redis
        .publish(`${REDIS_CHANNEL_PREFIX}${symbol}`, JSON.stringify(event))
        .catch((err: unknown) => this.logger.error('[Finnhub] Redis publish error', err));
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnect();
    this.reconnectTimer = setTimeout(() => {
      this.logger.info(`[Finnhub] Reconnecting after ${this.backoffMs}ms`);
      this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
      this.connect();
    }, this.backoffMs);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
