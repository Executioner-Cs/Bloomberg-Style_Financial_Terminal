# Bloomberg-Style Financial Terminal — Roadmap

**Canonical 9-phase plan.** Supersedes scattered phase references in README, ADRs, and old plan files. Every phase here is the single source of truth for its scope.

- Last updated: 2026-04-18
- Governance: [CLAUDE.md](./CLAUDE.md) Parts I–XXI apply to every phase without exception.
- Capability tiers: the product evolves across four tiers — **terminal core** (workspace + first panels), **power features** (screener/movers/alerts/portfolio), **AI analyst** (why-moving, filing summarizer, ask terminal), and a **Rust performance layer** (stream/screener/risk). Each roadmap phase names the tier it advances.
- Change control: phases may be re-scoped only via ADR. Out-of-scope items are explicit and must reference the phase that owns them.

---

## Phase Summary

| Phase | Status      | Theme                                                                                 | Exit signal                                               | Capability tier        |
| ----- | ----------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------- |
| 0     | ✅ Complete | Foundation                                                                            | Terminal shell loads, Docker stack healthy                | pre-core               |
| 1     | ✅ Complete | Data ingestion + mock layer                                                           | 6 integrations operational, 134 tests green               | pre-core               |
| 2     | ✅ Complete | Workspace shell + REST endpoints + first panel apps                                   | User opens Equities workspace, symbol-linking bus works   | Terminal core          |
| 3     | Planned     | Real-time WS streaming + Screener + Movers + Earnings + Calendar + Alerts + Portfolio | Live ticks; screener < 2s; alert fires within 1 min       | Power features         |
| 4     | Planned     | AI analyst (Why Moving / Compare / Summarizer / Brief / Ask Terminal)                 | Every panel has a one-click AI context action             | AI analyst             |
| 5     | Planned     | Rust performance layer (stream/screener/risk/replay)                                  | WS fan-out P99 < 50ms, screener engine 10× throughput     | Rust performance       |
| 6     | Planned     | Macro dashboard polish + accessibility + Lighthouse ≥ 90                              | Yield curve panel + full keyboard-only E2E                | Terminal core (polish) |
| 7     | Planned     | Auth + multi-user + monetisation tiers                                                | JWT rotation; Free/Pro/Institutional rate limits enforced | Platform               |
| 8     | Planned     | Plugin system + production deployment (ECS/CloudFront/OTel)                           | One sample plugin; rolling deploy green                   | Platform               |

---

## Phase 0 — Foundation ✅

**Intent:** Monorepo scaffold, Docker stack, blank terminal shell that renders.

**Scope (delivered):**

- pnpm workspaces: `apps/web`, `packages/types`, `packages/ui-components`, `services/api`, `services/ws-gateway`, `services/worker`
- Docker Compose: PostgreSQL 16, ClickHouse, Redis 7 Stack, api, worker, ws-gateway
- FastAPI application factory with CORS + request ID middleware
- Celery + Redis broker with Beat scheduler
- Node.js 20 + Fastify WS gateway skeleton
- React 18 + Vite 5 SPA with TanStack Query/Router + Zustand
- CI pipeline: typecheck, lint, unit, integration, security audit
- ADR-001 (tech stack), ADR-002 (ClickHouse for OHLCV), ADR-003 (split WS gateway), ADR-004 (local dev TLS)
- Base integration client with retry/backoff/timeout

**Exit criteria (met):** `docker compose up` starts all services healthy; `pnpm dev` renders blank terminal at `localhost:5173`; health endpoints return 200.

---

## Phase 1 — Data Ingestion ✅

**Intent:** All EOD and macro data reaches ClickHouse on a schedule; terminal runs offline via a mock toggle.

**Scope (delivered):**

- Integration clients: `yfinance`, `fred`, `coingecko`, `edgar`, `newsapi`, `finnhub` (`services/api/src/integrations/`, mirrored in worker)
- `MacroRepository` + `macro_series` ClickHouse table
- Worker tasks: `ingest_ohlcv_coingecko`, `ingest_yfinance_ohlcv`, `refresh_macro_series`; stubs for `edgar_ingest`, `news_ingest`, `alert_evaluator`
- Celery Beat schedule: crypto daily 00:05 UTC, equities daily 21:30 UTC, macro weekly Monday 08:00 UTC
- Mock data layer (ADR-006): `USE_MOCK_DATA=true`, committed `mock_data/`, `scripts/generate_mock_data.py`, Docker volume mount
- Pydantic schemas: `MacroBar`, `MacroSeriesResponse`, `NewsArticle`, `NewsResponse`, `Filing`, `FilingsResponse`
- ADR-005 (free-only data sources), ADR-006 (mock data layer)
- 42 new unit tests (newsapi, finnhub, macro_repository); total 134 green; coverage 72.93%

**Exit criteria (met):** Beat scheduler fires 7 tasks; ClickHouse populated; all tests green; mypy strict clean.

**Out of scope (deferred):** UI panels for new data types (→ Phase 2+); real-time WebSocket (→ Phase 3); auth (→ Phase 7). EDGAR/NewsAPI live ingestion (→ Phase 4).

---

## Phase 2 — Workspace Shell + First Panel Apps ✅

**Intent:** The first shippable increment of the terminal. A workspace of docked, tabbed, resizable panels with saved layouts, symbol-linking, keyboard command palette, and six working panels (Chart, Quote, Watchlist, Macro, News, Filings) rendering from live or mock data. Delivers the **terminal core** capability tier.

**Scope:**

_Backend (Stage A, done):_

- `MacroService`, `NewsService`, `FilingsService` + routers (cache-first, no DB persistence for news/filings in this phase — ADR-009)
- `MockDataLoader` extended with `get_news` + `get_filings`
- Integration smoke tests for all 3 endpoints

_Frontend workspace foundation (Stage B):_

- `dockview-react` + `zustand` added as first-class deps
- `terminal-context.store` (activeSymbol, theme) + `workspace.store` (panel instances, layoutJson)
- `PanelApp<Props>` registry contract + runtime (`registerPanelApp`, `getPanelApp`, `listPanelApps`)
- `WorkspaceShell` wrapping dockview; layout serializer (`localStorage:terminal.workspace.v1` + `?ws=` URL query); default layout presets (Equities, Macro, Filings Research)
- Command palette: open/close/switch panel, switch workspace preset

_Panel apps (Stage C):_

- `ChartPanel` refactored as a workspace app
- `QuotePanel` — Bloomberg-style dense header strip + numbered tabs (`1) Current 2) Historical 3) Matrix 4) Ownership`)
- `WatchlistPanel` — virtualized table, live price + Δ%, add/remove, localStorage-backed (Phase 7 moves to server)
- `MacroPanel` — table with full-cell Δ bands
- `NewsPanel` — timestamp-left layout
- `FilingPanel` + `use-filings` hook
- Symbol-linking bus wired across all panels with `linkable: true`
- Panels pause TanStack Query polling when hidden (CLAUDE.md Part XII)

_Visual language (Stage D, ADR-010):_

- Design tokens in `apps/web/tailwind.config.ts`: shell `#050505`, panel `#0c0c0f`, divider `#242428`, amber `#F59E0B`, green `#10B981`, red `#EF4444`, cyan `#22D3EE`, white `#F8F8F8`, gray `#9CA3AF`
- `font-variant-numeric: tabular-nums` globally on numeric cells
- Zero border-radius, no shadows, Inter for UI / JetBrains Mono for numbers
- Keyboard-first UX: `1/2/3` switch tabs, `/` search, `Esc` blur, arrows for row nav

**Out of scope:** Real-time price ticks (→ Phase 3); indicators beyond basic volume (→ Phase 6); alerts (→ Phase 3); auth/server-side watchlist (→ Phase 7).

**Exit criteria:**

- `docker compose up` boots full stack; default Equities workspace renders Chart + Quote + Watchlist + News tiled
- Clicking NVDA in Quote updates Chart via symbol-linking bus
- Layout saves to localStorage and restores across reload
- `?ws=macro` URL loads Macro preset
- All CLAUDE.md Part XII workspace-interaction budgets met (panel focus < 50ms, symbol link < 150ms, workspace restore < 500ms)
- Lighthouse score ≥ 85 on the terminal shell
- Every panel passes the "keyboard-only navigation" E2E test

**Dependencies:** Phase 1 ingestion running (or `USE_MOCK_DATA=true`).

**Risks:** Dockview bundle size (~40 KB gzipped) → lazy-load `WorkspaceShell`; layout JSON forward compat → `version` field in serialiser with reset-to-default fallback; symbol-bus re-render storms → Zustand selector-based subscriptions, never whole-store.

---

## Phase 3 — Real-Time Prices 🚧

**Intent:** Chart and watchlist tick in real time for crypto (Binance WS) and equities during market hours (Finnhub stream).

**Scope:**

- WS gateway (`services/ws-gateway/`) subscribes to Binance public streams (free) and Finnhub real-time channel
- Redis pub/sub fan-out: one upstream connection per provider, N downstream SSE/WS clients
- Browser client: `useRealtimePrice(symbol)` hook backed by a single SPA-wide WS connection
- Throttling: max 1 update/sec/symbol/client (CLAUDE.md Part XII budget)
- Reconnect + replay-gap handling; stale-price indicator after 10s without tick

**Out of scope:** Alerts firing on real-time updates (→ Phase 5); historical tick data (→ later, not scoped).

**Exit criteria:**

- BTC chart shows candles updating live
- P99 fan-out latency (upstream receive → browser receive) < 50ms on localhost
- WS gateway survives upstream reconnect without client disconnect
- Max 50 subscriptions per connection enforced

**Dependencies:** Phase 2 chart panel exists.

**Risks:** Provider rate limits on burst subscribes; Binance disconnects after 24h → auto-rotate.

---

## Phase 4 — Fundamentals + Filings + News

**Intent:** Research panels for company analysis. Routers `filings.py`, `fundamentals.py`, `news.py` graduate from stubs to real endpoints.

**Scope:**

- Fundamentals panel: income statement, balance sheet, cash flow from FMP (free tier) or EDGAR XBRL; quarterly refresh task
- Filings panel: latest 10-K/10-Q/8-K per symbol from EDGAR; full-text search + summary; task `edgar_ingest` activated
- News panel: NewsAPI top headlines scoped to symbol; `news_ingest` task activated; 5-min cache per symbol (100 req/day budget)
- `FundamentalsRepository`, `FilingsRepository`, `NewsRepository`
- New schemas: `IncomeStatement`, `BalanceSheet`, `CashFlow` (if not already covered)

**Out of scope:** XBRL parsing beyond already-filed facts; premium data (Bloomberg, Refinitiv) — ADR-005 forbids.

**Exit criteria:**

- User on AAPL chart → opens Filings panel → sees last 10 filings with links
- Fundamentals panel shows quarterly income statement
- News panel shows 10 most recent AAPL headlines

**Dependencies:** Phase 2 (panel infrastructure); Phase 1 EDGAR + NewsAPI clients (already built as stubs).

**Risks:** EDGAR HTML parsing fragility → use their structured JSON endpoints where possible; NewsAPI 100 req/day limit → aggressive caching.

---

## Phase 5 — Screener + Alerts

**Intent:** User-driven queries (screener) and push notifications on price conditions (alerts). Both require a non-trivial query/rules engine.

**Scope:**

- Screener router + panel: build filter (market cap, P/E, RSI, etc.), sort, export; translates to ClickHouse SQL
- Max 10 filters, max 5 sort fields per query (CLAUDE.md Part XIII)
- Alerts engine: `alert_evaluator` task (every minute), evaluates price-threshold + indicator-cross rules, writes to `alerts` table
- Notification delivery: browser push (web) + email (via free SMTP relay, TBD ADR in-phase)
- `AlertRepository`, `ScreenerService`, `RuleEvaluator`

**Out of scope:** Complex multi-leg option alerts; intraday alert evaluation frequency < 1 minute (latency cost).

**Exit criteria:**

- User builds a filter ("P/E < 20 AND market_cap > 10B") → results render < 2s P99
- User creates alert "AAPL > $200" → browser notification fires within 1 minute of condition met
- Alert evaluator processes 1000 rules/sec on dev hardware

**Dependencies:** Phase 1 ingestion (screener needs data); Phase 2 UI (panel for screener/alerts); Phase 3 optional (real-time alerts benefit).

**Risks:** ClickHouse query cost on complex filters → use materialized views for hot metrics; notification deliverability for email.

---

## Phase 6 — Macro Dashboard + Polish

**Intent:** The macro panel, yield curve chart, and the quality bar every piece of the terminal must clear before any production deployment.

**Scope:**

- Macro panel: live charts for GDP, CPI, FEDFUNDS, DGS10, UNRATE (data already ingested in Phase 1)
- Yield curve chart: 1M, 3M, 6M, 1Y, 2Y, 5Y, 10Y, 30Y treasuries; historical slider
- UI polish: consistent spacing, focus indicators, loading skeletons, error boundaries per panel
- Performance: Lighthouse ≥ 90 across the whole app; bundle < 200KB initial, < 1MB total (CLAUDE.md budget)
- Accessibility: keyboard-only workflow documented + tested end-to-end
- Documentation polish: every panel has a runbook entry; every public API endpoint has OpenAPI description

**Out of scope:** New data sources beyond Phase 1; mobile layout (deferred).

**Exit criteria:**

- Macro dashboard renders all 5 series; yield curve reshapes with date slider
- Lighthouse performance ≥ 90, accessibility ≥ 95
- Bundle analyzer report shows no accidental duplicate deps
- Every panel has skeleton + error states tested

**Dependencies:** Phase 1 data (done); Phase 2 layout engine.

**Risks:** Performance regressions from accumulated panels → baseline now, compare each PR.

---

## Phase 7 — Auth + Multi-User

**Intent:** Per-user watchlists, alerts, and preferences. Server-side identity.

**Scope:**

- JWT access (15 min) + refresh (7 day, rotating, httpOnly cookie) per CLAUDE.md Part XIII
- `users`, `sessions`, `api_keys` tables + Alembic migrations
- `UserRepository`, `AuthService`, login/register/logout endpoints
- Watchlists, alerts, portfolios move from `localStorage` to `user_id`-scoped server storage
- Rate limits per user tier (anonymous 60/hr, free 300/hr, pro 3000/hr) — values already in `config.py`
- CSRF protection on refresh endpoint; bcrypt cost ≥ 12
- Password reset via email

**Out of scope:** SSO/OAuth (optional later); billing/subscription management.

**Exit criteria:**

- User registers → logs in → adds symbol to watchlist → logs out → logs in on second browser → watchlist present
- Rate limits enforced and tested
- All OWASP Top 10:2025 checks pass (`/owasp-security` skill)

**Dependencies:** Phase 5 (alerts/watchlists storage migration target).

**Risks:** Refresh token rotation race conditions; bcrypt cost impact on auth endpoint P99 → measure.

---

## Phase 8 — Plugin System + Production Deployment

**Intent:** Third-party quant research plugins run safely inside the terminal; the whole stack deploys to AWS ECS Fargate.

**Scope:**

- Plugin runtime: iframe or Web Worker sandbox with declared permissions (CLAUDE.md Part XVII)
- Plugin manifest: `id`, `version`, `minApiVersion`, `permissions[]`, entry point, asset bundle
- Host permission enforcement: plugin cannot read/write outside declared scope
- Plugin error boundary: crash isolation — plugin fault never crashes terminal
- One reference plugin: "RSI screener" demonstrating data access + UI embedding
- Production deployment: ECS Fargate task definitions, ALB, Route53, Secrets Manager for API keys, CloudWatch logs
- CDN: CloudFront in front of `apps/web` build
- Observability: OpenTelemetry traces, Prometheus metrics, Grafana dashboards

**Out of scope:** Paid plugin marketplace; plugin code signing + attestation (later).

**Exit criteria:**

- Sample plugin installs, runs, hits rate limits gracefully, survives crash without taking down host
- Production deploy succeeds with zero downtime on rolling update
- All performance budgets met in production environment
- All security headers live (CLAUDE.md Part XIII)

**Dependencies:** Phase 7 (auth needed for per-user plugin state); all prior phases for the data surface plugins consume.

**Risks:** Cold-start latency on Fargate; plugin permission model edge cases → extensive fuzz testing before shipping.

---

## Cross-Cutting Requirements (All Phases)

Every phase must, without exception:

- Pass CLAUDE.md Parts I–XXI without waiver
- Add ADRs for every new architectural decision
- Update CHANGELOG.md with user-facing changes
- Maintain ≥ 70% overall coverage; ≥ 80% on services; ≥ 90% on utilities
- Keep mypy strict + ruff + black + TypeScript strict green
- Require one PR per branch, one branch per plan, `plan-approved` label
- Respect performance budgets (CLAUDE.md Part XII) — measure, don't guess

---

## How to Execute the Next Phase

1. Read this file's section for the phase
2. Confirm Phase N-1 exit criteria are fully met
3. Open a plan session (plan mode) and draft the plan against this roadmap
4. Cut a feature branch from `develop`
5. Work the plan commit-by-commit (CLAUDE.md Part IX)
6. Merge when CI green + PR template filled + label applied
7. Update README.md phase table and CHANGELOG.md under `[Unreleased]`
8. Mark the phase ✅ in this file; move on to the next
