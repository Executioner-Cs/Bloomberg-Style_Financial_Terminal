/**
 * WebSocket Gateway — Fastify server entry point.
 *
 * Why Node.js: Python asyncio struggles with C10K WebSocket connections
 * under sustained load. Node.js event loop handles this natively.
 * This service does ONE thing: route price/alert messages between
 * Redis Pub/Sub and browser WebSocket clients.
 */
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyCors from '@fastify/cors';

const PORT = parseInt(process.env['WS_GATEWAY_PORT'] ?? '3001', 10);

async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
    },
  });

  // CORS_ALLOWED_ORIGINS is required — no localhost fallback. The server refuses to
  // start if unset to prevent silent permissive CORS in staging or production.
  // Set in .env: CORS_ALLOWED_ORIGINS=https://localhost:5173,http://localhost:5173
  const rawCorsOrigins = process.env['CORS_ALLOWED_ORIGINS'];
  if (!rawCorsOrigins) {
    throw new Error(
      'CORS_ALLOWED_ORIGINS env var is required. ' +
        'Set it in your .env file, e.g.: CORS_ALLOWED_ORIGINS=https://localhost:5173',
    );
  }
  const corsOrigins = rawCorsOrigins
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  await server.register(fastifyCors, {
    origin: corsOrigins,
    credentials: true,
  });

  await server.register(fastifyWebsocket);

  // Health check — used by Docker and load balancers
  server.get('/health', () => {
    return { status: 'ok', service: 'ws-gateway' };
  });

  // WebSocket endpoint — all client connections handled here
  server.get('/ws', { websocket: true }, (connection) => {
    server.log.info('Client connected');

    connection.on('message', (rawMessage: Buffer) => {
      // TODO(#5): Route client subscribe/unsubscribe events
      server.log.debug({ message: rawMessage.toString() }, 'Client message');
    });

    connection.on('close', () => {
      server.log.info('Client disconnected');
      // TODO(#5): Clean up subscriptions for this connection
    });

    connection.on('error', (err: Error) => {
      server.log.error({ err }, 'WebSocket error');
    });
  });

  return server;
}

// Bootstrap
buildServer()
  .then((server) => {
    server.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
      if (err) {
        server.log.error(err);
        process.exit(1);
      }
    });
  })
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
