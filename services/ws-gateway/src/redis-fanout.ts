/**
 * RedisFanout — subscribes to Redis pub/sub price channels and forwards
 * price updates to all browser WebSocket clients subscribed to each symbol.
 *
 * Design:
 *  - One Redis subscriber connection (deduplicated from the publisher).
 *  - Throttle: max 1 update/sec/symbol/client (PRICE_THROTTLE_MS from config).
 *    Implemented via a `Map<clientKey, lastSentMs>` keyed on `<clientId>:<symbol>`.
 *  - Stale detection: if no Redis message arrives for a symbol within
 *    STALE_THRESHOLD_SECONDS, a StaleEvent is pushed to all subscribers.
 *    The stale timer resets on every incoming tick.
 *  - Channel pattern: `prices:<SYMBOL>` — provider publishes, fanout subscribes.
 *
 * Thread model: single-threaded Node.js event loop — no locking required.
 */
import type { Redis } from 'ioredis';
import type { WebSocket } from 'ws';
import type { SubscriptionManager } from './subscription-manager.js';
import type { Config } from './config.js';
import type { PriceUpdateEvent, StaleEvent } from '@terminal/types';

const CHANNEL_PREFIX = 'prices:';

export class RedisFanout {
  /** Throttle state: `<clientRef>:<symbol>` → last-forwarded timestamp (ms) */
  private readonly throttleMap = new Map<string, number>();

  /** Last tick timestamp per symbol — used for stale detection */
  private readonly lastTickMs = new Map<string, number>();

  /** Active stale-detection timers per symbol */
  private readonly staleTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /** Monotonically increasing client ID for stable throttle keys */
  private clientIdCounter = 0;
  private readonly clientIds = new WeakMap<WebSocket, number>();

  constructor(
    private readonly subscriber: Redis,
    private readonly subscriptions: SubscriptionManager,
    private readonly config: Config,
    private readonly logger: {
      info: (msg: string) => void;
      error: (msg: string, err?: unknown) => void;
      debug: (msg: string) => void;
    },
  ) {}

  /** Subscribe to all `prices:*` channels and begin forwarding. */
  start(): void {
    // psubscribe uses pattern matching — one subscribe covers all symbols.
    // The promise return is intentionally not awaited: psubscribe() fires the
    // callback on completion; the promise resolves to the same result. We use
    // the callback form and suppress the floating promise with void.
    void this.subscriber.psubscribe(`${CHANNEL_PREFIX}*`, (err) => {
      if (err) {
        this.logger.error('[Fanout] Redis psubscribe failed', err);
        return;
      }
      this.logger.info('[Fanout] Subscribed to prices:* channels');
    });

    this.subscriber.on('pmessage', (_pattern: string, channel: string, message: string) => {
      const symbol = channel.slice(CHANNEL_PREFIX.length);
      this.handlePriceMessage(symbol, message);
    });
  }

  /**
   * Assign a stable numeric ID to a client (used as a throttle key component).
   * Must be called when the client connects.
   */
  registerClient(client: WebSocket): void {
    if (!this.clientIds.has(client)) {
      this.clientIds.set(client, ++this.clientIdCounter);
    }
  }

  /**
   * Clean up throttle state for a disconnected client.
   * Stale timers are per-symbol (not per-client) — they fire when the last
   * subscriber of a symbol disconnects, the timer is cleaned by resetStaleTimer.
   */
  unregisterClient(client: WebSocket): void {
    const id = this.clientIds.get(client);
    if (id === undefined) return;

    // Remove throttle entries for this client
    for (const key of this.throttleMap.keys()) {
      if (key.startsWith(`${id}:`)) {
        this.throttleMap.delete(key);
      }
    }
  }

  destroy(): void {
    for (const timer of this.staleTimers.values()) clearTimeout(timer);
    this.staleTimers.clear();
    this.subscriber.punsubscribe(`${CHANNEL_PREFIX}*`).catch(() => undefined);
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private handlePriceMessage(symbol: string, message: string): void {
    let event: PriceUpdateEvent;
    try {
      event = JSON.parse(message) as PriceUpdateEvent;
    } catch {
      this.logger.debug(`[Fanout] Failed to parse message for ${symbol}`);
      return;
    }

    // Reset stale timer for this symbol
    this.resetStaleTimer(symbol, event.ts);

    const clients = this.subscriptions.getClientsForSymbol(symbol);
    const now = Date.now();

    for (const client of clients) {
      if (!this.canSend(client, symbol, now)) continue;
      this.sendToClient(client, message);
      this.markSent(client, symbol, now);
    }
  }

  /** Returns true if enough time has elapsed since the last forwarded update. */
  private canSend(client: WebSocket, symbol: string, now: number): boolean {
    const id = this.clientIds.get(client);
    if (id === undefined) return false;
    const key = `${id}:${symbol}`;
    const lastSent = this.throttleMap.get(key) ?? 0;
    return now - lastSent >= this.config.PRICE_THROTTLE_MS;
  }

  private markSent(client: WebSocket, symbol: string, now: number): void {
    const id = this.clientIds.get(client);
    if (id === undefined) return;
    this.throttleMap.set(`${id}:${symbol}`, now);
  }

  private sendToClient(client: WebSocket, payload: string): void {
    try {
      if ((client.readyState as number) === 1 /* OPEN */) {
        client.send(payload);
      }
    } catch (err) {
      this.logger.error('[Fanout] send error', err);
    }
  }

  private resetStaleTimer(symbol: string, tickTs: number): void {
    this.lastTickMs.set(symbol, tickTs);

    const existing = this.staleTimers.get(symbol);
    if (existing !== undefined) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.emitStale(symbol);
    }, this.config.STALE_THRESHOLD_SECONDS * 1_000);

    this.staleTimers.set(symbol, timer);
  }

  private emitStale(symbol: string): void {
    const lastTickTs = this.lastTickMs.get(symbol) ?? 0;
    const event: StaleEvent = { type: 'stale', symbol, lastTickTs };
    const payload = JSON.stringify(event);

    this.logger.info(
      `[Fanout] Stale: ${symbol} (no tick for ${this.config.STALE_THRESHOLD_SECONDS}s)`,
    );

    const clients = this.subscriptions.getClientsForSymbol(symbol);
    for (const client of clients) {
      this.sendToClient(client, payload);
    }
  }
}
