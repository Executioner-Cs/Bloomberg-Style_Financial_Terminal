# yfinance Integration Client

**Module:** `services/api/src/integrations/yfinance.py` (mirrored in worker)
**Pattern:** Library-based (async wrapper over `yf.Ticker`)
**Status:** Phase 1 ✅ operational

## Purpose

Primary source for equity OHLCV bars. Covers the top 30 S&P constituents defined in `settings.yfinance_equity_symbols`. Scheduled daily at 21:30 UTC (30 min after NYSE close) via the `ingest_yfinance_ohlcv` Celery task.

## Why a library wrapper, not HTTP

yfinance scrapes Yahoo Finance internally. There is no public HTTP API and no contract to build against. The library ships its own retry logic and session handling — wrapping it in a `BaseIntegrationClient` would duplicate work without any configurability upside. Instead, the blocking `yf.Ticker().history()` call is dispatched to the default thread pool executor via `asyncio.get_running_loop().run_in_executor()`.

## Usage

```python
from src.integrations.yfinance import YFinanceClient
from src.config import settings

client = YFinanceClient(timeout_seconds=settings.yfinance_timeout_seconds)

# Fetch last 365 days of daily bars
bars: list[OHLCVRow] = await client.get_ohlcv("AAPL", days=365)

# Fetch bars since a specific date (for incremental ingest)
from datetime import date
bars = await client.get_ohlcv_since("AAPL", since=date(2026, 1, 1))
```

## Period mapping

`get_ohlcv(days=N)` maps N to the smallest yfinance period token that covers it:

| `days` | yfinance `period`       |
| ------ | ----------------------- |
| ≤ 2    | `5d`                    |
| ≤ 90   | `3mo`                   |
| ≤ 365  | `1y`                    |
| ≤ 730  | `2y`                    |
| > 730  | `1y` (default fallback) |

Period tokens are the only values yfinance accepts — free-form date ranges are not supported.

## Output shape

Each bar becomes an `OHLCVRow` (`services/api/src/models/ch/ohlcv.py`) with `source="yfinance"`, `timeframe="1D"`, UTC-aware `ts`, and `adj_close` populated when Yahoo provides it. Splits/dividends are preserved separately (`auto_adjust=False`).

## Configuration

Sourced from `settings` (see `services/api/src/config.py`, `services/worker/src/config.py`):

| Setting                        | Default        | Meaning                                          |
| ------------------------------ | -------------- | ------------------------------------------------ |
| `YFINANCE_REQUESTS_PER_MINUTE` | 60             | Self-imposed rate cap (Yahoo publishes no limit) |
| `YFINANCE_TIMEOUT_SECONDS`     | 30.0           | Per-request timeout                              |
| `YFINANCE_EQUITY_SYMBOLS`      | 30 S&P symbols | Comma-separated tickers to ingest daily          |
| `YFINANCE_INGEST_HOUR_UTC`     | 21             | Beat schedule hour                               |
| `YFINANCE_INGEST_MINUTE_UTC`   | 30             | Beat schedule minute (21:30 UTC = 4:30 PM ET)    |

## Risks

- **Unofficial API.** Yahoo can block scraping at any time without notice. ADR-005 documents this risk and directs `USE_MOCK_DATA=true` as the fallback for dev; production monitoring must alert on a sustained 0-bar result streak.
- **Symbol drift.** Yahoo symbol ≠ exchange symbol for some ADRs and foreign listings. Validate against the seeded instruments table before adding to `YFINANCE_EQUITY_SYMBOLS`.

## Testing

Unit tests live in `services/api/tests/unit/` but **yfinance itself is not HTTP-mockable** (the library owns its session). Tests cover the period-mapping logic and the sync→async wrapping; live-path coverage comes from integration tests guarded by a `RUN_YFINANCE_INTEGRATION=1` env flag (opt-in, not run in CI).
