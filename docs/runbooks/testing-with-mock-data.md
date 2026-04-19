# Runbook: Testing with Mock Data

**Background:** [ADR-006 — Mock Data Layer](../architecture/decisions/ADR-006-mock-data-layer.md)

The terminal must run end-to-end without any live API keys. This lets contributors onboard instantly and lets CI run deterministic tests against a fixed data set. The switch is a single env var: `USE_MOCK_DATA=true`.

## When to use mock mode

- **First clone** — before registering for FRED, NewsAPI, Finnhub keys
- **Offline development** — no network, still want the terminal running
- **CI jobs** — deterministic fixtures, no rate-limit flakes
- **Integration tests that traverse the full task → repo → DB path** — real ClickHouse + mock data in
- **Demos / screenshots** — stable data across runs

## Enabling mock mode

1. Copy `.env.example` → `.env` if you haven't already
2. Set:
   ```
   USE_MOCK_DATA=true
   ```
3. Optional override for non-standard checkouts:
   ```
   MOCK_DATA_DIR=/abs/path/to/mock_data
   ```
   Leave empty to auto-discover via `.git/` walk (`_find_project_root()`).
4. Restart api + worker containers: `docker compose -f infrastructure/docker-compose.yml restart api worker`

The Docker setup mounts `./mock_data` read-only into both containers at `/mock_data` (`infrastructure/docker-compose.yml`).

## What mock mode covers

| Data type        | Mock source                         | Live source short-circuited                |
| ---------------- | ----------------------------------- | ------------------------------------------ |
| Equity OHLCV     | `mock_data/ohlcv/{SYMBOL}_1D.json`  | yfinance                                   |
| Crypto OHLCV     | `mock_data/ohlcv/{COIN_ID}_1D.json` | CoinGecko                                  |
| Macro series     | `mock_data/macro/{SERIES_ID}.json`  | FRED                                       |
| Quotes snapshot  | `mock_data/quotes.json`             | Finnhub, yfinance                          |
| Instruments list | `mock_data/instruments.json`        | CoinGecko `/coins/markets` + yfinance seed |

EDGAR filings and NewsAPI articles are not yet mocked — Phase 4 adds them.

## Verifying the switch

After enabling, check the worker log on the next Beat tick (or trigger manually):

```bash
docker compose exec worker celery -A src.celery_app call src.tasks.fred_ingest.refresh_macro_series
```

Expected log line:

```
Mock FRED ingest complete: N rows, 0 series failed
```

Key indicator: `mode` in the task return dict is `"mock"`, not `"live"` or `"skipped"`.

## Regenerating mock data

`scripts/generate_mock_data.py` produces all JSON fixtures from a seeded random walk (`seed=42` — reproducible):

```bash
python scripts/generate_mock_data.py
```

Outputs:

- `mock_data/ohlcv/` — 50 OHLCV files (20 crypto + 30 equity), 365 daily bars each
- `mock_data/macro/` — 5 FRED series JSON files
- `mock_data/quotes.json` — latest-bar snapshot per symbol
- `mock_data/instruments.json` — full instrument list

**All mock files are committed to git.** Regenerate only when:

- Adding a new symbol to `YFINANCE_EQUITY_SYMBOLS` / crypto set
- Extending the date range
- Adding a new FRED series

## CI policy

CI jobs run unit tests with `httpx.MockTransport` (in-process) — no mock_data/ involvement. Integration tests that need data load from `mock_data/` directly. Neither path hits a live API.

## Troubleshooting

| Symptom                                               | Cause                                               | Fix                                                                                                                       |
| ----------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `FileNotFoundError: mock_data/ohlcv/AAPL_1D.json`     | Symbol added to config but fixtures not regenerated | Re-run `scripts/generate_mock_data.py`                                                                                    |
| Task logs `mode="live"` with `USE_MOCK_DATA=true` set | Env var not propagated into container               | `docker compose down && docker compose up` — `.env` read on container start                                               |
| `MOCK_DATA_DIR` absolute path ignored                 | Docker mount mismatch                               | Either clear `MOCK_DATA_DIR` (let auto-discovery work inside container) or mount the custom path in `docker-compose.yml`  |
| Loader returns empty list                             | Mock JSON has wrong schema shape                    | Diff against a known-good file under `mock_data/` — schema matches the Pydantic model, not the upstream provider response |

## Switching back to live mode

```
USE_MOCK_DATA=false
```

Then fill in the relevant API keys (`FRED_API_KEY`, `NEWSAPI_KEY`, `FINNHUB_API_KEY`). yfinance and CoinGecko need no keys. Restart api + worker.
