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

  await server.register(fastifyCors, {
    origin: (process.env['CORS_ALLOWED_ORIGINS'] ?? 'http://localhost:5173').split(','),
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
