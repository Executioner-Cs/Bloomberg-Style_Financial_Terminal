# ADR-001: Technology Stack Selection

**Status:** Accepted  
**Date:** 2026-04-13  
**Author:** Mayank Khandelwal

---

## Context

Building a Bloomberg-style financial terminal as a solo developer. Need a technology
stack that:
1. Can handle real-time data (WebSocket streams for crypto, price updates)
2. Stores time-series OHLCV data efficiently at scale
3. Supports future quant plugins (backtesting, ML, risk models)
4. Is maintainable by one person over 2–3 years
5. Has a path to production without a DevOps team

## Decision

### Frontend: React 18 + TypeScript (strict)
**Rationale:** Over Svelte — richest financial UI ecosystem (AG Grid, TanStack Query,
Lightweight Charts all have React-first APIs). Better TypeScript tooling maturity.
Larger community means more financial component examples.

### Backend: Python 3.12 + FastAPI
**Rationale:** Python is the lingua franca for quantitative finance. Future quant plugins
(backtesting, ML, risk models) will be written in Python. FastAPI gives async performance
comparable to Node.js for REST APIs. Pydantic v2 is Rust-backed and fast.

### WebSocket Gateway: Node.js 20 + Fastify
**Rationale:** Python asyncio struggles with C10K WebSocket connections under sustained load.
Node.js event loop handles this pattern natively. ws/socket.io ecosystem is mature.
Node.js used ONLY for WS routing — no business logic.

### Time-Series Database: ClickHouse
**Rationale over TimescaleDB:** Better compression (10–50x vs 3–5x), faster analytical
queries at scale, proven in financial contexts. TimescaleDB was considered but is slower
for multi-year OHLCV queries. InfluxDB v3 proprietary clustering ruled it out.

### Relational Database: PostgreSQL 16
**Rationale:** JSONB for flexible fundamentals storage, pgvector for future semantic
search, row-level security for multi-user, battle-tested Python ecosystem.

### Cache/Queue: Redis 7 Stack
**Rationale over Kafka:** Kafka is justified at 10M+ events/day with multiple consumer
groups. Redis Pub/Sub handles WebSocket fan-out perfectly for our scale.
Redis Stack adds RediSearch for instrument autocomplete — no additional service needed.

## Consequences

**Positive:**
- Single language (Python) for all server-side business logic and future quant modules
- Proven financial data stack used by institutions for real-time analytics
- `docker compose up` starts everything locally

**Negative:**
- Two backend runtimes (Python + Node.js) increase operational complexity
- ClickHouse has a steeper learning curve than SQLite/Postgres for time-series

**Mitigations:**
- Node.js WS gateway is kept intentionally thin (<200 lines) — easy to understand
- ClickHouse runbook documents all common query patterns
