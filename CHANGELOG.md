# Changelog

All notable changes to the Bloomberg Terminal project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added — Phase 1 (2026-04-18): Data Ingestion Layer

**Integration clients** (`services/api/src/integrations/`, mirrored in worker):

- `yfinance.py` — async wrapper around the yfinance library; equity OHLCV for top 30 S&P constituents
- `fred.py` — async wrapper around fredapi; macro series ingestion (GDP, CPIAUCSL, FEDFUNDS, DGS10, UNRATE)
- `edgar.py` — SEC EDGAR full-text search client; stub wiring for 10-K/10-Q/8-K filings
- `newsapi.py` — NewsAPI.org client; cache TTL respects 100 req/day free tier
- `finnhub.py` — Finnhub quote client; supplemental real-time source, converts dp percent → decimal
- `mock_loader.py` — unified offline loader for all providers; reads committed JSON fixtures

**Persistence**:

- `MacroRepository` + `macro_series` ClickHouse table (ReplacingMergeTree on `(series_id, ts)`)
- `MacroRow` ClickHouse dataclass model

**Pydantic schemas**: `MacroBar`, `MacroSeriesResponse`, `NewsArticle`, `NewsResponse`, `Filing`, `FilingsResponse`

**Worker tasks** (Celery Beat schedule in `services/worker/src/celery_app.py`):

- `refresh_macro_series` — weekly Monday 08:00 UTC, idempotent via `get_latest_ts` filter
- `ingest_yfinance_ohlcv` — daily 21:30 UTC (30 min after NYSE close)
- `ingest_ohlcv_coingecko` — mock-mode guard added; live path unchanged
- `edgar_ingest`, `news_ingest`, `alert_evaluator` — stubs registered for Phase 4/5
- `market_data_ingest.report_api_quotas` — daily quota monitor

**Mock data layer** (ADR-006):

- `USE_MOCK_DATA=true` toggle short-circuits all integration HTTP calls to `mock_data/`
- `mock_data/` committed to git: 50 OHLCV JSON files, 5 macro series, `instruments.json`, `quotes.json`
- `scripts/generate_mock_data.py` — deterministic seeded random walk; reproducible output
- `infrastructure/docker-compose.yml` — mounts `mock_data/` read-only into api + worker containers

**Tests**: 134 passing, 72.93% coverage (≥ 70% CI threshold). 42 new unit tests (`test_newsapi_integration`, `test_finnhub_integration`, `test_macro_repository`), all `httpx.MockTransport`-based, zero real HTTP.

**Decisions**:

- ADR-004 — Local dev TLS via `@vitejs/plugin-basic-ssl`
- ADR-005 — Free-only data source policy (no paid tiers, no credit card)
- ADR-006 — Mock data layer architecture (USE_MOCK_DATA toggle, project-root auto-discovery)

### Added — Phase 0 Foundation

- Complete project architecture and monorepo scaffold
- CLAUDE.md — AI coding rules governing all code generation
- Docker Compose stack: PostgreSQL 16, ClickHouse, Redis 7 Stack
- FastAPI application factory with CORS, request ID middleware
- Celery worker with Beat schedule for all ingestion tasks
- Node.js WebSocket gateway (Fastify)
- React SPA shell (blank terminal screen, Phase 0)
- Shared TypeScript types package (`@terminal/types`)
- CI/CD pipeline (GitHub Actions): typecheck, lint, test, security audit
- Architecture Decision Records: ADR-001, ADR-002, ADR-003
- Runbooks: adding data source, adding UI panel, plugin development
- `.env.example` with all 40+ environment variables documented
- Base integration client with retry/backoff for all external APIs
- Centralized cache key constants

---

## [0.0.1] — 2026-04-13

### Added

- Initial repository with placeholder README
