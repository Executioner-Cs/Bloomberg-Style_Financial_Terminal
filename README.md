# Bloomberg-Style Financial Terminal

A keyboard-driven, web-first financial terminal built by a solo developer.
Multi-asset market data, TradingView-class charting, news/filings aggregation,
equity screening, and a plugin architecture for quant research tools.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript (strict), Vite 5, TanStack Query/Router, Zustand |
| Charting | TradingView Lightweight Charts (Apache 2.0) |
| Data Grids | AG Grid Community |
| Backend | Python 3.12 + FastAPI, Pydantic v2 |
| WS Gateway | Node.js 20 + Fastify |
| Background Jobs | Celery + Redis |
| Time-Series DB | ClickHouse |
| Relational DB | PostgreSQL 16 |
| Cache | Redis 7 Stack (includes RediSearch) |
| Infrastructure | Docker Compose (dev), AWS ECS Fargate (prod) |

## Data Sources

| Source | Coverage | Latency |
|--------|----------|---------|
| Marketstack | EOD equities, ETFs, indices | EOD |
| Alpha Vantage | Equities, FX (fallback) | EOD / delayed |
| Financial Modeling Prep | Fundamentals, financial statements | Quarterly refresh |
| SEC EDGAR | US company filings (8-K, 10-K, 10-Q), XBRL | Near real-time |
| FRED | Macro series (GDP, CPI, rates, yield curve) | Daily |
| CoinGecko | Crypto market data | Near real-time |
| Binance / Coinbase WS | Live crypto prices | Real-time stream |
| StockData.org | Financial news | 15-min refresh |

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

## Implementation Phases

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Foundation: monorepo, Docker stack, blank terminal shell | In Progress |
| 1 | Data ingestion: EOD prices, crypto, macro → ClickHouse | Planned |
| 2 | Terminal UI: chart + watchlist + command palette | Planned |
| 3 | Real-time prices: Binance WS, live crypto streaming | Planned |
| 4 | Fundamentals + filings: FMP, EDGAR, news | Planned |
| 5 | Screener + alerts | Planned |
| 6 | Macro dashboard + polish | Planned |
| 7 | Auth + multi-user | Planned |
| 8 | Plugin system + production deployment | Planned |

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
