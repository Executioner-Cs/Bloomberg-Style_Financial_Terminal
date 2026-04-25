/**
 * WS Gateway configuration — validated at startup via Zod.
 *
 * Every value originates from an environment variable. The server refuses to
 * start if a required variable is absent or fails validation (CLAUDE.md Rule 1).
 * See .env.example for documentation on each variable.
 */
import { z } from 'zod';

const ConfigSchema = z.object({
  // ── Server ─────────────────────────────────────────────────────────────────
  /** Port 3001 per CLAUDE.md Part III Port Registry — Node.js service range */
  WS_GATEWAY_PORT: z.coerce.number().int().min(1024).max(65535).default(3001),

  /** Comma-separated list of allowed CORS origins — empty string blocks all */
  CORS_ALLOWED_ORIGINS: z.string().min(1, 'CORS_ALLOWED_ORIGINS must contain at least one origin'),

  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // ── Redis ──────────────────────────────────────────────────────────────────
  /** Redis URL — pub/sub fan-out backbone (Redis 6379 per CLAUDE.md Part III) */
  REDIS_URL: z.string().url(),

  // ── Upstream providers ─────────────────────────────────────────────────────
  /**
   * Binance combined stream base URL.
   * Public endpoint, no key required. Documented at:
   * https://binance-docs.github.io/apidocs/spot/en/#websocket-market-streams
   */
  BINANCE_WS_BASE_URL: z.string().url().default('wss://stream.binance.com:9443'),

  /**
   * Finnhub WebSocket URL — equities real-time trades.
   * Free tier, API key required. Documented at: https://finnhub.io/docs/api/websocket-trades
   */
  FINNHUB_WS_URL: z.string().url().default('wss://ws.finnhub.io'),

  /**
   * Finnhub API key — required for WS auth query param `?token=<key>`.
   * Optional: if absent, Finnhub provider starts in degraded mode (crypto only).
   */
  FINNHUB_API_KEY: z.string().optional(),

  // ── Subscription limits ────────────────────────────────────────────────────
  /**
   * Max symbol subscriptions per browser connection.
   * 50 matches CLAUDE.md Part XIII rate limit table and prevents runaway fan-out.
   */
  MAX_SUBSCRIPTIONS_PER_CONNECTION: z.coerce.number().int().min(1).max(500).default(50),

  // ── Throttle ───────────────────────────────────────────────────────────────
  /**
   * Minimum milliseconds between price updates forwarded to each client per symbol.
   * 1000 ms = max 1 update/sec/symbol/client — CLAUDE.md Part XII real-time budget.
   */
  PRICE_THROTTLE_MS: z.coerce.number().int().min(100).max(60_000).default(1_000),

  // ── Stale detection ────────────────────────────────────────────────────────
  /**
   * Seconds without a tick before a symbol is declared stale.
   * 10 s per CLAUDE.md Part III Phase 3 plan; fires a StaleEvent to all subscribers.
   */
  STALE_THRESHOLD_SECONDS: z.coerce.number().int().min(1).max(300).default(10),

  // ── Binance rotation ───────────────────────────────────────────────────────
  /**
   * Milliseconds between Binance stream reconnects.
   * 82 800 000 ms = 23 h. Binance disconnects all streams at 24 h; rotating at
   * 23 h avoids the forced disconnect race. See Binance WS docs §Stream Lifespan.
   */
  BINANCE_ROTATE_INTERVAL_MS: z.coerce.number().int().default(82_800_000),

  // ── Mock mode ──────────────────────────────────────────────────────────────
  /**
   * When true the gateway skips upstream WS connections and publishes synthetic
   * price ticks from a deterministic mock generator. Used in dev without API keys.
   */
  USE_MOCK_DATA: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Load and validate config from process.env.
 * Calls process.exit(1) on validation failure — startup must be clean or not at all.
 */
export function loadConfig(): Config {
  const result = ConfigSchema.safeParse(process.env);
  if (!result.success) {
    console.error('[ws-gateway] Config validation failed:');
    console.error(result.error.format());
    process.exit(1);
  }
  return result.data;
}
