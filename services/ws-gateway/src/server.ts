/**
 * WebSocket Gateway — Fastify server entry point.
 *
 * Why Node.js: Python asyncio struggles with C10K WebSocket connections
 * under sustained load. Node.js event loop handles this natively.
 * This service routes price messages between Redis Pub/Sub and browser
 * WebSocket clients. Single responsibility: subscription routing + fan-out.
 *
 * Startup sequence:
 *  1. Validate config (exits on failure).
 *  2. Connect two Redis clients: one for publish (providers), one for subscribe (fanout).
 *  3. Start BinanceProvider + FinnhubProvider (upstream data → Redis).
 *  4. Start RedisFanout (Redis → browser WS).
 *  5. Open Fastify HTTP+WS server.
 *
 * Client message protocol (ClientEvent union from @terminal/types):
 *  { type: "subscribe",   symbols: string[] }
 *  { type: "unsubscribe", symbols: string[] }
 *  { type: "ping" }
 *
 * Server message protocol (ServerEvent union from @terminal/types):
 *  { type: "connected",  connectionId, serverTs }
 *  { type: "price",      symbol, price, changePct, changeAbs, volume, ts }
 *  { type: "stale",      symbol, lastTickTs }
 *  { type: "pong" }
 *  { type: "error",      code, message }
 */
import crypto from 'node:crypto';
import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyCors from '@fastify/cors';
import { Redis } from 'ioredis';
import type { WebSocket } from 'ws';
import type { ClientEvent, ConnectedEvent, PongEvent, WsErrorEvent } from '@terminal/types';
import { loadConfig } from './config.js';
import { SubscriptionManager } from './subscription-manager.js';
import { BinanceProvider, isCryptoSymbol } from './providers/binance.js';
import { FinnhubProvider } from './providers/finnhub.js';
import { RedisFanout } from './redis-fanout.js';

// ── Bootstrap ──────────────────────────────────────────────────────────────────

const config = loadConfig();

const publisherRedis = new Redis(config.REDIS_URL);
const subscriberRedis = new Redis(config.REDIS_URL);

publisherRedis.on('error', (err: Error) => console.error('[Redis/pub]', err.message));
subscriberRedis.on('error', (err: Error) => console.error('[Redis/sub]', err.message));

const subscriptions = new SubscriptionManager(config.MAX_SUBSCRIPTIONS_PER_CONNECTION);

const server = Fastify({ logger: { level: config.LOG_LEVEL } });

const binance = new BinanceProvider(publisherRedis, config, server.log);
const finnhub = new FinnhubProvider(publisherRedis, config, server.log);
const fanout = new RedisFanout(subscriberRedis, subscriptions, config, server.log);

// ── Server setup ───────────────────────────────────────────────────────────────

async function buildServer(): Promise<void> {
  const corsOrigins = config.CORS_ALLOWED_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  await server.register(fastifyCors, { origin: corsOrigins, credentials: true });
  await server.register(fastifyWebsocket);

  // Health check — used by Docker and load balancers
  server.get('/health', () => ({
    status: 'ok',
    service: 'ws-gateway',
    connections: subscriptions.connectionCount,
  }));

  // WebSocket endpoint
  server.get('/ws', { websocket: true }, (socket: WebSocket) => {
    const connectionId = crypto.randomUUID();
    server.log.info({ connectionId }, '[Gateway] Client connected');

    subscriptions.addClient(socket);
    fanout.registerClient(socket);

    // Send connected handshake
    sendEvent(socket, {
      type: 'connected',
      connectionId,
      serverTs: Date.now(),
    } satisfies ConnectedEvent);

    socket.on('message', (raw: Buffer) => {
      handleClientMessage(socket, raw);
    });

    socket.on('close', () => {
      server.log.info({ connectionId }, '[Gateway] Client disconnected');
      const removedSymbols = subscriptions.removeClient(socket);
      fanout.unregisterClient(socket);

      // Update providers: drop any symbols with zero remaining subscribers
      syncProviders(removedSymbols);
    });

    socket.on('error', (err: Error) => {
      server.log.error({ connectionId, err }, '[Gateway] WebSocket error');
    });
  });

  fanout.start();

  if (!config.USE_MOCK_DATA) {
    // Providers connect on-demand when first symbol is subscribed
    server.log.info('[Gateway] Live mode — providers start on first subscription');
  } else {
    server.log.info('[Gateway] Mock mode — upstream WS disabled');
  }

  await server.listen({ port: config.WS_GATEWAY_PORT, host: '0.0.0.0' });
}

// ── Message handling ───────────────────────────────────────────────────────────

function handleClientMessage(socket: WebSocket, raw: Buffer): void {
  let event: ClientEvent;
  try {
    event = JSON.parse(raw.toString()) as ClientEvent;
  } catch {
    sendError(socket, 'PARSE_ERROR', 'Invalid JSON');
    return;
  }

  switch (event.type) {
    case 'subscribe':
      handleSubscribe(socket, event.symbols);
      break;
    case 'unsubscribe':
      handleUnsubscribe(socket, event.symbols);
      break;
    case 'ping':
      sendEvent(socket, { type: 'pong' } satisfies PongEvent);
      break;
    default: {
      sendError(socket, 'UNKNOWN_EVENT', 'Unknown event type');
      server.log.warn({ event }, '[Gateway] Unknown client event');
    }
  }
}

function handleSubscribe(socket: WebSocket, symbols: string[]): void {
  if (!Array.isArray(symbols) || symbols.length === 0) {
    sendError(socket, 'INVALID_SYMBOLS', 'symbols must be a non-empty array');
    return;
  }

  // Validate symbol format (CLAUDE.md Part XIII) — dash at end of char class, no escape needed
  const symbolPattern = /^[A-Z0-9./-]{1,20}$/;
  const validSymbols = symbols.filter((s) => typeof s === 'string' && symbolPattern.test(s));

  if (validSymbols.length === 0) {
    sendError(socket, 'INVALID_SYMBOLS', 'No valid symbols provided');
    return;
  }

  const { added, rejected } = subscriptions.subscribe(socket, validSymbols);

  if (rejected.length > 0) {
    sendError(
      socket,
      'SUBSCRIPTION_CAP',
      `Subscription cap (${config.MAX_SUBSCRIPTIONS_PER_CONNECTION}) reached. Rejected: ${rejected.join(', ')}`,
    );
  }

  if (added.length > 0 && !config.USE_MOCK_DATA) {
    syncProviders(new Set(added));
  }
}

function handleUnsubscribe(socket: WebSocket, symbols: string[]): void {
  if (!Array.isArray(symbols)) return;
  subscriptions.unsubscribe(socket, symbols);
  syncProviders(new Set(symbols));
}

/**
 * Update provider subscriptions after a change.
 * Only symbols that now have zero subscribers are unsubscribed upstream.
 * New symbols with one or more subscribers are subscribed upstream.
 */
function syncProviders(changedSymbols: ReadonlySet<string>): void {
  if (config.USE_MOCK_DATA) return;

  const allActive = subscriptions.getAllSubscribedSymbols();

  const cryptoActive = new Set([...allActive].filter(isCryptoSymbol));
  const equityActive = new Set([...allActive].filter((s) => !isCryptoSymbol(s)));

  binance.updateSubscriptions(cryptoActive);

  // Finnhub: only update if changed symbols include equities
  const equityChanged = [...changedSymbols].some((s) => !isCryptoSymbol(s));
  if (equityChanged) {
    finnhub.updateSubscriptions(equityActive);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function sendEvent(socket: WebSocket, event: object): void {
  try {
    if ((socket.readyState as number) === 1 /* OPEN */) {
      socket.send(JSON.stringify(event));
    }
  } catch (err) {
    server.log.error({ err }, '[Gateway] send error');
  }
}

function sendError(socket: WebSocket, code: string, message: string): void {
  sendEvent(socket, { type: 'error', code, message } satisfies WsErrorEvent);
}

// ── Entry point ────────────────────────────────────────────────────────────────

buildServer().catch((err: unknown) => {
  console.error('[Gateway] Failed to start:', err);
  process.exit(1);
});

// Graceful shutdown
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    server.log.info(`[Gateway] ${signal} received — shutting down`);
    binance.destroy();
    finnhub.destroy();
    fanout.destroy();
    server.close(() => process.exit(0));
  });
}
