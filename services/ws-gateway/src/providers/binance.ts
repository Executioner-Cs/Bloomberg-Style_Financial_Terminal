/**
 * Binance WebSocket provider — crypto price real-time feed.
 *
 * Uses the Binance combined stream endpoint to subscribe to `<pair>@miniTicker`
 * events (24h rolling window: open, close, volume). No API key required.
 *
 * Routing: symbols mapping to Binance pairs are lowercase coin tickers appended
 * with "usdt" (e.g. "BTC" → "btcusdt", "ETH" → "ethusdt").
 * Detection: isCryptoSymbol() returns true for known crypto tickers.
 *
 * Lifecycle:
 *  - connect() opens the stream and starts publishing to Redis.
 *  - updateSubscriptions() reconstructs the stream URL and reconnects.
 *  - The stream auto-rotates at BINANCE_ROTATE_INTERVAL_MS (23 h) to avoid
 *    Binance's forced 24 h disconnect. See Binance WS docs §Stream Lifespan.
 *  - Exponential backoff on failures (1s → 2s → 4s … 60s cap).
 *
 * Redis contract: publishes JSON-serialised PriceUpdateEvent to channel
 * `prices:<SYMBOL>` (uppercase canonical symbol).
 */
import WebSocket from 'ws';
import type { Redis } from 'ioredis';
import type { Config } from '../config.js';
import type { PriceUpdateEvent } from '@terminal/types';

// ── Crypto symbol detection ────────────────────────────────────────────────────

/**
 * Known crypto tickers that map to Binance USDT pairs.
 * Extend this set as new crypto assets are added to the product.
 * Source: CoinGecko top-50 by market cap as of product launch.
 */
const CRYPTO_TICKERS = new Set([
  'BTC',
  'ETH',
  'BNB',
  'XRP',
  'ADA',
  'SOL',
  'DOGE',
  'DOT',
  'AVAX',
  'SHIB',
  'MATIC',
  'LTC',
  'TRX',
  'UNI',
  'LINK',
  'ATOM',
  'XLM',
  'ETC',
  'NEAR',
  'APT',
  'OP',
  'ARB',
  'PEPE',
  'FIL',
  'INJ',
  'HBAR',
  'IMX',
  'VET',
  'MKR',
  'AAVE',
]);

export function isCryptoSymbol(symbol: string): boolean {
  return CRYPTO_TICKERS.has(symbol.toUpperCase());
}

/** Map terminal symbol to Binance stream name (e.g. "BTC" → "btcusdt"). */
export function toBinancePair(symbol: string): string {
  return `${symbol.toLowerCase()}usdt`;
}

// ── Binance miniTicker payload ─────────────────────────────────────────────────

type BinanceMiniTicker = {
  e: '24hrMiniTicker';
  s: string; // Symbol (e.g. "BTCUSDT")
  c: string; // Close price
  o: string; // Open price
  v: string; // Base asset volume
  q: string; // Quote asset volume
  E: number; // Event time (ms)
};

type BinanceCombinedMessage = {
  stream: string;
  data: BinanceMiniTicker;
};

// ── Provider ───────────────────────────────────────────────────────────────────

const MAX_BACKOFF_MS = 60_000;
const REDIS_CHANNEL_PREFIX = 'prices:';

export class BinanceProvider {
  private ws: WebSocket | null = null;
  private subscribedSymbols = new Set<string>();
  private rotateTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = 1_000;
  private isDestroyed = false;

  constructor(
    private readonly redis: Redis,
    private readonly config: Config,
    private readonly logger: {
      info: (msg: string) => void;
      error: (msg: string, err?: unknown) => void;
      debug: (msg: string) => void;
    },
  ) {}

  /** Add or replace the full set of subscribed symbols and reconnect. */
  updateSubscriptions(symbols: ReadonlySet<string>): void {
    const cryptoSymbols = [...symbols].filter(isCryptoSymbol);
    const changed =
      cryptoSymbols.length !== this.subscribedSymbols.size ||
      cryptoSymbols.some((s) => !this.subscribedSymbols.has(s));

    if (!changed) return;

    this.subscribedSymbols = new Set(cryptoSymbols);
    this.reconnect();
  }

  /** Open the Binance combined stream for all currently subscribed symbols. */
  connect(): void {
    if (this.subscribedSymbols.size === 0) return;
    if (this.isDestroyed) return;

    const streams = [...this.subscribedSymbols]
      .map((s) => `${toBinancePair(s)}@miniTicker`)
      .join('/');

    const url = `${this.config.BINANCE_WS_BASE_URL}/stream?streams=${streams}`;
    this.logger.info(`[Binance] Connecting: ${streams}`);

    const ws = new WebSocket(url);
    this.ws = ws;

    ws.on('open', () => {
      this.logger.info('[Binance] Stream open');
      this.backoffMs = 1_000;
      this.scheduleRotation();
    });

    ws.on('message', (data: Buffer) => {
      this.handleMessage(data);
    });

    ws.on('close', (code: number) => {
      this.logger.info(`[Binance] Stream closed (${code})`);
      this.clearRotation();
      if (!this.isDestroyed && this.subscribedSymbols.size > 0) {
        this.scheduleReconnect();
      }
    });

    ws.on('error', (err: Error) => {
      this.logger.error('[Binance] Stream error', err);
    });
  }

  destroy(): void {
    this.isDestroyed = true;
    this.clearRotation();
    this.clearReconnect();
    this.ws?.close();
    this.ws = null;
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private reconnect(): void {
    this.ws?.close();
    this.clearRotation();
    this.clearReconnect();
    this.connect();
  }

  private handleMessage(data: Buffer): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data.toString());
    } catch {
      this.logger.debug('[Binance] Failed to parse message');
      return;
    }

    const msg = parsed as BinanceCombinedMessage;
    if (!msg.data || msg.data.e !== '24hrMiniTicker') return;

    const ticker = msg.data;
    const close = parseFloat(ticker.c);
    const open = parseFloat(ticker.o);
    if (!isFinite(close) || !isFinite(open) || open === 0) return;

    // Canonical symbol: strip USDT suffix, uppercase (e.g. "BTCUSDT" → "BTC")
    const rawPair = ticker.s; // "BTCUSDT"
    const symbol = rawPair.replace(/USDT$/, '').toUpperCase();

    const changeAbs = close - open;
    const changePct = changeAbs / open;

    const event: PriceUpdateEvent = {
      type: 'price',
      symbol,
      price: close,
      changePct,
      changeAbs,
      volume: parseFloat(ticker.v),
      ts: ticker.E,
    };

    this.redis
      .publish(`${REDIS_CHANNEL_PREFIX}${symbol}`, JSON.stringify(event))
      .catch((err: unknown) => this.logger.error('[Binance] Redis publish error', err));
  }

  private scheduleRotation(): void {
    this.clearRotation();
    this.rotateTimer = setTimeout(() => {
      this.logger.info('[Binance] Rotating stream (23h interval)');
      this.reconnect();
    }, this.config.BINANCE_ROTATE_INTERVAL_MS);
  }

  private clearRotation(): void {
    if (this.rotateTimer !== null) {
      clearTimeout(this.rotateTimer);
      this.rotateTimer = null;
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnect();
    this.reconnectTimer = setTimeout(() => {
      this.logger.info(`[Binance] Reconnecting after ${this.backoffMs}ms`);
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
