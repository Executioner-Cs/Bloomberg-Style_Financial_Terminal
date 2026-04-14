# ADR-003: Separate Node.js WebSocket Gateway

**Status:** Accepted  
**Date:** 2026-04-13  
**Author:** Mayank Khandelwal

---

## Context

The terminal requires real-time price updates pushed to browser clients via WebSocket.
Initial design considered handling WebSockets directly in FastAPI (Python asyncio).

Concerns with FastAPI WebSockets at scale:
- Python's GIL limits true parallelism; asyncio works but under C10K sustained load
  with fan-out patterns (one Redis message → N client frames), Python shows latency spikes
- Python WebSocket libraries (`websockets`, `starlette`) are less battle-tested at high
  connection counts than Node.js `ws` or `fastify-websocket`
- TA-Lib, numpy, pandas imports in the same process as WS routing create GC pressure

## Decision

**Separate Node.js 20 + Fastify service** for ALL WebSocket client connections.

The gateway is intentionally thin:
1. Accept client connections + authenticate JWT
2. Receive subscribe/unsubscribe messages
3. Subscribe to Redis Pub/Sub channels for requested symbols
4. Fan-out Redis messages to subscribed WebSocket clients
5. No business logic, no database access

Python (FastAPI/Celery) remains the source of truth — it writes to Redis Pub/Sub.
Node.js only reads and routes.

## Architecture

```
[Binance/Coinbase WS] → [Node.js ws-gateway] → [Redis Pub/Sub]
                                                      ↓
                               [Celery Worker] → [Redis Pub/Sub]
                                                      ↓
                                             [Node.js ws-gateway]
                                                      ↓
                                          [Browser WebSocket clients]
```

## Consequences

**Positive:**
- Node.js event loop handles 10,000+ concurrent WebSocket connections efficiently
- Gateway code is < 300 lines — easy to understand, test, and maintain
- Clear separation: Python for data logic, Node.js for connection routing

**Negative:**
- Two runtimes to deploy and monitor (Docker image, logs, health checks)
- Shared JWT secret between Python and Node.js services

**Mitigations:**
- Gateway has health check endpoint and Dockerfile — same as other services
- JWT secret sourced from same `JWT_SECRET_KEY` env var in both services
- Gateway is intentionally kept stateless — no DB access, no state beyond subscriptions
