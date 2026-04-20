# Changelog

All notable changes to the Bloomberg Terminal project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added — Phase 2 (in progress, 2026-04-18): Workspace Shell + Panel Apps

Delivers the **terminal core** capability tier — workspace shell plus the first
six panels (Chart, Quote, Watchlist, Macro, News, Filings).

**User-facing additions:**

- Workspace shell: open, close, and rearrange panels by dragging tiles (powered by dockview)
- Chart panel: interactive OHLCV candlestick chart with timeframe switcher (1m → 1M); keyboard shortcuts D/W/M change resolution when the panel is focused
- Command palette (Ctrl+K): fuzzy-search all registered panels and instruments; open any panel directly from the keyboard
- Symbol-linking bus: changing the active symbol in one panel propagates to all linked panels automatically
- Three layout presets (Equities, Macro, Filings Research) accessible from the command palette
- Workspace state persisted to `localStorage` — layout survives browser close and reopen
- URL deep-linking: `?ws=equities` loads the named preset on first visit (useful for shared links)
- Status bar: connection status badge and UTC clock in the bottom bar

**Audit fixes (this sprint):**

- Real health-check endpoint (`/health`) now pings Postgres, ClickHouse, and Redis; returns `"degraded"` or `"error"` on failures
- API request timeout configurable via `VITE_API_TIMEOUT_MS` env var (was hardcoded 30 s)
- `isChartPanelProps` type guard added — `JSON.parse` output validated before use
- Workspace constants centralised into a single source of truth (`constants.ts`)
- Four ADRs: ADR-007 (workspace shell), ADR-008 (command palette), ADR-009 (filings cache), ADR-010 (CSS design tokens)
- CI enforcement scripts: `check-hardcoding.sh`, `check-port-registry.sh`, `check-adr-required.sh`
- EDGAR user-agent validated at startup — rejects `@example.com` placeholders (SEC ToS)
- News query input validated with regex + min-length (OWASP A03 input validation)
- Unit test suite: API client (10 tests), chart panel adapter (18), terminal-context store (9), workspace API ref (10)

**Backend (Stage A, shipped):**

- `MacroService` + `/macro`, `/macro/{series_id}` routers with cache-first pattern (Redis)
- `NewsService` + `/news`, `/news/{symbol}` routers with 5-min TTL (NewsAPI 100 req/day budget)
- `FilingsService` + `/filings/{symbol}` router with 24-hour TTL (ADR-009)
- `settings.filings_cache_ttl_seconds` (default 86400) + `cache:filings:{symbol}:{form_type}` key
- `MockDataLoader.get_news()` + `.get_filings()` — zero-network mock path (ADR-006 extension)
- Integration smoke tests for all 3 endpoints (`tests/integration/test_phase2_endpoints.py`)
- FRED macro ingest schedule now settings-driven (`fred_ingest_day_of_week/hour_utc/minute_utc`) — removed hardcoded crontab

**Frontend workspace foundation (Stage B, in progress):**

- `dockview-react@5.2.0` + `zustand@4.5.7` added as direct web deps
- `terminal-context.store` — activeSymbol + theme (symbol-linking bus)
- `workspace.store` — panel instance map + opaque dockview layout JSON
- `PanelApp<Props>` contract + module-scoped registry (`panel-registry.ts`) with write-then-freeze semantics
- `lucide-react` added for icon provider (used by `PanelApp.icon`)
- Public workspace barrel: `@/workspace` re-exports stores + registry + types

**Governance:**

- CLAUDE.md Part XII extended with **workspace interaction budgets** (panel focus < 50ms, symbol link < 150ms, workspace restore < 500ms, drag/resize ≥ 60fps, command palette instant)
- CLAUDE.md Part XII extended with **panel data discipline** (pause polling when hidden, selector subscriptions only, virtualized tables ≥ 100 rows, memoized dense rows)
- CLAUDE.md governing principle extended with the four-tier capability vision (terminal core → power features → AI analyst → Rust performance layer)

**Docs:**

- README phase table rewritten with a capability-tier column (pre-core → terminal core → power features → AI analyst → Rust performance → platform)
- ROADMAP Phase 2 rescoped to the full terminal-core panel set (Chart + Quote + Watchlist + Macro + News + Filings, not just chart+watchlist)
- ROADMAP phase 3+ mapped to the power-features, AI-analyst, and Rust-performance tiers

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
