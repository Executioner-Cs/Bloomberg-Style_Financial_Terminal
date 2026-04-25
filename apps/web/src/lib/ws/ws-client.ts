/**
 * WsClient — singleton WebSocket connection to the WS gateway.
 *
 * One connection per SPA. All useRealtimePrice hook instances share this client.
 * When no symbols are subscribed the connection remains open (cheap idle cost).
 *
 * URL: VITE_WS_URL (build-time env). If unset → disabled; panels fall back to
 * REST polling from TanStack Query's refetchInterval.
 *
 * Reconnect: exponential backoff 1s → 2s → 4s … 30s cap. Resets on successful open.
 *
 * Heartbeat: sends { type: "ping" } every PING_INTERVAL_MS and expects { type: "pong" }.
 * If no pong arrives within PONG_TIMEOUT_MS the connection is force-closed to trigger
 * a reconnect (detects dead TCP connections that have no close frame).
 */
import type { ServerEvent } from '@terminal/types';

/**
 * Base delay before the first reconnect attempt.
 * Doubles on each consecutive failure up to MAX_RECONNECT_DELAY_MS.
 */
const BASE_RECONNECT_DELAY_MS = 1_000;

/**
 * Upper bound on reconnect delay — avoids holding a client offline indefinitely
 * during long backend outages while still backing off enough to avoid hammering.
 */
const MAX_RECONNECT_DELAY_MS = 30_000;

/**
 * Ping interval — keeps the connection alive and detects dead TCP sessions.
 * 30 s is below most NAT/proxy idle-connection timeouts (typically 60 s+).
 */
const PING_INTERVAL_MS = 30_000;

/**
 * Time to wait for a pong response before declaring the connection dead.
 * 5 s gives the server time to respond even under moderate load.
 */
const PONG_TIMEOUT_MS = 5_000;

// ── Handler registry types ─────────────────────────────────────────────────────

export type PriceHandler = (event: ServerEvent & { type: 'price' }) => void;
export type StaleHandler = (event: ServerEvent & { type: 'stale' }) => void;

type SymbolHandlers = {
  price: Set<PriceHandler>;
  stale: Set<StaleHandler>;
};

// ── WsClient ───────────────────────────────────────────────────────────────────

/**
 * WsClient — exported for unit testing with injected URLs.
 * Production code uses the `wsClient` singleton at the bottom of this file.
 */
export class WsClient {
  private ws: WebSocket | null = null;
  private readonly handlers = new Map<string, SymbolHandlers>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setTimeout> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = BASE_RECONNECT_DELAY_MS;
  private destroyed = false;

  /**
   * @param wsUrl - WebSocket gateway URL. Pass undefined to disable WS entirely.
   *                Production singleton reads from VITE_WS_URL at module load time.
   */
  constructor(private readonly wsUrl: string | undefined) {}

  get isEnabled(): boolean {
    return typeof this.wsUrl === 'string' && this.wsUrl.length > 0;
  }

  /**
   * Register a handler for price updates for a specific symbol.
   * Returns an unsubscribe function — call it in the hook's cleanup.
   */
  subscribePriceUpdates(symbol: string, handler: PriceHandler): () => void {
    this.ensureHandlers(symbol).price.add(handler);
    this.ensureConnected();
    this.sendSubscribe([symbol]);

    return () => {
      const h = this.handlers.get(symbol);
      if (h) {
        h.price.delete(handler);
        if (h.price.size === 0 && h.stale.size === 0) {
          this.handlers.delete(symbol);
          this.sendUnsubscribe([symbol]);
        }
      }
    };
  }

  /**
   * Register a handler for stale notifications for a specific symbol.
   * Returns an unsubscribe function.
   */
  subscribeStale(symbol: string, handler: StaleHandler): () => void {
    this.ensureHandlers(symbol).stale.add(handler);
    this.ensureConnected();

    return () => {
      const h = this.handlers.get(symbol);
      if (h) {
        h.stale.delete(handler);
        if (h.price.size === 0 && h.stale.size === 0) {
          this.handlers.delete(symbol);
          this.sendUnsubscribe([symbol]);
        }
      }
    };
  }

  /** Tear down all connections and timers. Called on app unmount. */
  destroy(): void {
    this.destroyed = true;
    this.clearReconnect();
    this.clearPing();
    this.ws?.close();
    this.ws = null;
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private ensureHandlers(symbol: string): SymbolHandlers {
    const existing = this.handlers.get(symbol);
    if (existing) return existing;
    const created: SymbolHandlers = { price: new Set(), stale: new Set() };
    this.handlers.set(symbol, created);
    return created;
  }

  private ensureConnected(): void {
    if (!this.isEnabled) return;
    if (this.ws !== null && this.ws.readyState <= 1 /* CONNECTING | OPEN */) return;
    this.connect();
  }

  private connect(): void {
    if (!this.isEnabled || this.destroyed) return;

    // isEnabled guarantees wsUrl is a non-empty string
    const ws = new WebSocket(this.wsUrl as string);
    this.ws = ws;

    ws.addEventListener('open', () => {
      this.backoffMs = BASE_RECONNECT_DELAY_MS;
      this.schedulePing();
      // Re-subscribe to all currently tracked symbols after reconnect
      const symbols = [...this.handlers.keys()];
      if (symbols.length > 0) this.sendSubscribe(symbols);
    });

    ws.addEventListener('message', (ev: MessageEvent<string>) => {
      this.handleMessage(ev.data);
    });

    ws.addEventListener('close', () => {
      this.clearPing();
      if (!this.destroyed) this.scheduleReconnect();
    });

    ws.addEventListener('error', () => {
      // 'error' always precedes 'close' — reconnect is handled in the close handler
    });
  }

  private handleMessage(raw: string): void {
    let event: ServerEvent;
    try {
      event = JSON.parse(raw) as ServerEvent;
    } catch {
      return;
    }

    switch (event.type) {
      case 'price': {
        this.clearPongTimer(); // any message confirms liveness
        const h = this.handlers.get(event.symbol);
        if (h) {
          for (const handler of h.price) handler(event);
        }
        break;
      }
      case 'stale': {
        const h = this.handlers.get(event.symbol);
        if (h) {
          for (const handler of h.stale) handler(event);
        }
        break;
      }
      case 'pong':
        this.clearPongTimer();
        break;
      case 'connected':
      case 'error':
      case 'alert':
      case 'news':
        // Other event types — no-op at the client layer
        break;
      default: {
        // Exhaustiveness guard — future event types are silently ignored
        const _exhaustive: never = event;
        void _exhaustive;
      }
    }
  }

  private sendSubscribe(symbols: string[]): void {
    this.send(JSON.stringify({ type: 'subscribe', symbols }));
  }

  private sendUnsubscribe(symbols: string[]): void {
    this.send(JSON.stringify({ type: 'unsubscribe', symbols }));
  }

  private send(payload: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
    }
  }

  private schedulePing(): void {
    this.clearPing();
    this.pingTimer = setTimeout(() => {
      this.send(JSON.stringify({ type: 'ping' }));
      this.pongTimer = setTimeout(() => {
        // No pong received — dead connection, force close to trigger reconnect
        this.ws?.close();
      }, PONG_TIMEOUT_MS);
    }, PING_INTERVAL_MS);
  }

  private clearPing(): void {
    if (this.pingTimer !== null) {
      clearTimeout(this.pingTimer);
      this.pingTimer = null;
    }
    this.clearPongTimer();
  }

  private clearPongTimer(): void {
    if (this.pongTimer !== null) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnect();
    this.reconnectTimer = setTimeout(() => {
      this.backoffMs = Math.min(this.backoffMs * 2, MAX_RECONNECT_DELAY_MS);
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

/**
 * Singleton WS client — shared across the entire SPA.
 * URL is read once at module load from the Vite build-time env.
 */
export const wsClient = new WsClient(import.meta.env['VITE_WS_URL'] as string | undefined);
