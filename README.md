# Bloomberg-Style Financial Terminal

A keyboard-driven, web-first financial terminal built by a solo developer.
Multi-asset market data, TradingView-class charting, news/filings aggregation,
equity screening, and a plugin architecture for quant research tools.

The long-term product evolves across four capability tiers: **terminal core**
(workspace + first panels), **power features** (screener, movers, earnings,
calendar, alerts, portfolio), **AI analyst** (why-is-it-moving, filing
summarizer, earnings brief, ask terminal), and a **Rust performance layer**
(stream gateway, screener engine, risk engine) for hot paths where latency
rules. ROADMAP.md tracks phase-by-phase execution.

**Design principles:**

1. **Workspace-first** — the product is not pages; it is workspaces of
   docked, tabbed, resizable panels with saved layouts.
2. **Information-dense** — no wasted pixels; 11–12px rows, tabular
   numerics, zero SaaS fluff.
3. **Keyboard-first** — mouse is optional; every panel action is
   keyboard-addressable.
4. **Instant feel** — panel focus < 50ms, symbol link < 150ms, resize
   at 60fps (CLAUDE.md Part XII).
5. **Modular** — every feature is a registered panel app
   (`apps/web/src/workspace/panel-registry.ts`).

---

## Tech Stack

| Layer           | Technology                                                             |
| --------------- | ---------------------------------------------------------------------- |
| Frontend        | React 18 + TypeScript (strict), Vite 5, TanStack Query/Router, Zustand |
| Charting        | TradingView Lightweight Charts (Apache 2.0)                            |
| Data Grids      | AG Grid Community                                                      |
| Backend         | Python 3.12 + FastAPI, Pydantic v2                                     |
| WS Gateway      | Node.js 20 + Fastify                                                   |
| Background Jobs | Celery + Redis                                                         |
| Time-Series DB  | ClickHouse                                                             |
| Relational DB   | PostgreSQL 16                                                          |
| Cache           | Redis 7 Stack (includes RediSearch)                                    |
| Infrastructure  | Docker Compose (dev), AWS ECS Fargate (prod)                           |

## Data Sources

All sources are permanently free (ADR-005). No paid tiers, no credit card required.

| Source                | Coverage                                         | Latency          | Phase       |
| --------------------- | ------------------------------------------------ | ---------------- | ----------- |
| yfinance              | EOD equities, ETFs, indices (top 30 S&P)         | EOD              | 1 ✅        |
| CoinGecko             | Crypto market data (top 20 coins)                | Near real-time   | 1 ✅        |
| FRED                  | Macro series (GDP, CPI, FEDFUNDS, DGS10, UNRATE) | Weekly           | 1 ✅        |
| SEC EDGAR             | US company filings (8-K, 10-K, 10-Q)             | Daily            | 1 (stub), 4 |
| NewsAPI               | Financial news (100 req/day free)                | 15-min refresh   | 1 (stub), 4 |
| Finnhub               | Supplemental real-time quotes (60 req/min)       | Real-time        | 1 ✅        |
| Binance / Coinbase WS | Live crypto prices                               | Real-time stream | 3           |

---

## Quick Start (Local Development)

### Prerequisites

- Docker Desktop
- Node.js 20 + pnpm 9
- Python 3.12

### 1. Clone and install

```bash
git clone https://github.com/Executioner-Cs/Bloomberg-Style_Financial_Terminal.git
cd Bloomberg-Style_Financial_Terminal
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in API keys (see .env.example for documentation of every variable)
# Or set USE_MOCK_DATA=true to run fully offline against mock_data/ (ADR-006)
```

### 3. Start all services

```bash
docker compose -f infrastructure/docker-compose.yml up -d
```

### 4. Run migrations

```bash
cd services/api && alembic upgrade head
```

### 5. Start development servers

```bash
pnpm dev
```

Open `http://localhost:5173` — you should see the terminal shell.

---

## Project Structure

```
bloomberg-terminal/
├── apps/web/               # React SPA
├── packages/types/         # Shared TypeScript types
├── packages/ui-components/ # Shared terminal UI primitives
├── services/api/           # FastAPI REST API (Python)
├── services/ws-gateway/    # WebSocket gateway (Node.js)
├── services/worker/        # Celery background workers (Python)
├── plugins/                # Quant extension plugins
├── infrastructure/         # Docker, Terraform
├── docs/
│   ├── architecture/decisions/  # Architecture Decision Records
│   └── runbooks/                # How-to guides
├── CLAUDE.md               # AI coding rules (read before contributing)
└── CHANGELOG.md
```

---

## What's Working Today

As of 2026-04-18 (Phase 1 complete):

- **Ingestion**: CoinGecko crypto OHLCV (daily 00:05 UTC), yfinance equity OHLCV (daily 21:30 UTC), FRED macro series (weekly Monday 08:00 UTC) — all idempotent, all writing to ClickHouse
- **Mock mode**: `USE_MOCK_DATA=true` serves everything from committed `mock_data/` JSON — zero live API calls, zero keys required (ADR-006)
- **Integration clients**: yfinance, FRED, CoinGecko, EDGAR, NewsAPI, Finnhub — all behind a uniform async interface with mock fallback
- **Persistence**: PostgreSQL (instruments + metadata), ClickHouse (OHLCV + macro_series), Redis (cache + Celery broker)
- **Terminal shell**: React SPA loads at `http://localhost:5173`, renders blank workspace (panels land in Phase 2)
- **Tests**: 134 passing, 72.93% coverage, mypy strict clean on both api and worker

## Implementation Phases

See [ROADMAP.md](./ROADMAP.md) for the full phase-by-phase plan with scope, exit criteria, and dependencies.

| Phase | Scope                                                                                               | Status         | Capability tier  |
| ----- | --------------------------------------------------------------------------------------------------- | -------------- | ---------------- |
| 0     | Foundation: monorepo, Docker stack, blank terminal shell                                            | ✅ Complete    | pre-core         |
| 1     | Data ingestion: mock layer + 6 integrations + workers → ClickHouse                                  | ✅ Complete    | pre-core         |
| 2     | Workspace shell + REST endpoints + first panel apps (Chart, Quote, Watchlist, Macro, News, Filings) | 🚧 In Progress | Terminal core    |
| 3     | Real-time WS streams + Screener + Movers + Earnings + Economic Calendar + Alerts + Portfolio        | Planned        | Power features   |
| 4     | AI analyst: Why Is It Moving, Compare Companies, Filing Summarizer, Earnings Brief, Ask Terminal    | Planned        | AI analyst       |
| 5     | Rust performance layer: Stream Gateway, Screener Engine, Risk Engine, Replay                        | Planned        | Rust performance |
| 6     | Auth + multi-user + monetisation tiers (Free/Pro/Institutional)                                     | Planned        | Platform         |
| 7     | Plugin system + production deployment + cloud sync                                                  | Planned        | Platform         |

---

## Development Rules

All code in this project — including AI-generated code — is governed by **CLAUDE.md**.
Read it before writing anything. Key highlights:

- TypeScript: `strict: true`, `noUncheckedIndexedAccess: true`, NEVER use `any`
- Python: `mypy --strict` must pass, Pydantic v2 for all validation, `ruff` + `black`
- Commits: Conventional Commits format, enforced by commitlint
- Tests: unit + integration + E2E required for every new feature
- Architecture: router → service → repository (no skipping layers)

---

## License

Private — all rights reserved.
