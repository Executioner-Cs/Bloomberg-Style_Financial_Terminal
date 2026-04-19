# FRED Integration Client

**Module:** `services/api/src/integrations/fred.py` (mirrored in worker)
**Pattern:** Library-based (async wrapper over `fredapi.Fred`)
**Status:** Phase 1 ✅ operational

## Purpose

Macro series ingestion from the Federal Reserve Economic Data API. Scheduled weekly Monday 08:00 UTC via the `refresh_macro_series` Celery task. Idempotent: filters fetched observations by latest stored `ts` before insert.

## Why a library wrapper, not HTTP

`fredapi` is the canonical Python client for FRED. It manages its own `requests` session, handles pagination, and returns `pd.Series` directly. Wrapping it in `asyncio.run_in_executor()` is cheaper and safer than re-implementing FRED's observation-list pagination.

## API key

FRED requires a free API key. Register once at https://fred.stlouisfed.org/docs/api/api_key.html.

- Set `FRED_API_KEY=...` in `.env`
- If the key is empty at task dispatch, `refresh_macro_series` logs a warning and returns `mode="skipped"`. Set `USE_MOCK_DATA=true` to run without a key.

## Usage

```python
from src.integrations.fred import FredClient
from src.config import settings

client = FredClient(
    api_key=settings.fred_api_key,
    timeout_seconds=settings.fred_timeout_seconds,
)

# Full series (oldest-first)
bars: list[MacroBar] = await client.get_series("GDP")

# Incremental fetch since last stored observation
from datetime import datetime, UTC
since = datetime(2026, 1, 1, tzinfo=UTC)
bars = await client.get_series_since("CPIAUCSL", since=since)
```

## Default series

`FRED_SERIES_IDS` ingests five core macro series:

| Series ID  | Description                               | Release frequency |
| ---------- | ----------------------------------------- | ----------------- |
| `GDP`      | Gross Domestic Product                    | Quarterly         |
| `CPIAUCSL` | Consumer Price Index, All Urban Consumers | Monthly           |
| `FEDFUNDS` | Effective Federal Funds Rate              | Monthly           |
| `DGS10`    | 10-Year Treasury Constant Maturity Rate   | Daily             |
| `UNRATE`   | Civilian Unemployment Rate                | Monthly           |

Weekly schedule is conservative — most of these release monthly at most. Adding an intraday series would require an ADR.

## Adding a new series

1. Find the series ID at https://fred.stlouisfed.org/ (e.g., `PAYEMS` for nonfarm payrolls)
2. Append to `FRED_SERIES_IDS` in `.env.example` and `.env`
3. Optionally add display metadata to `src/schemas/macro.py` (`FRED_SERIES_NAMES`, `FRED_SERIES_UNITS`)
4. Trigger `refresh_macro_series` manually once to backfill: `celery -A src.celery_app call src.tasks.fred_ingest.refresh_macro_series`

## Output shape

Each observation becomes a `MacroBar` (`src/schemas/macro.py`) with UTC-aware `ts` and numeric `value`. NaN observations (unreleased future dates) are skipped. Repository conversion to `MacroRow` happens inside the task, not the client.

## Configuration

| Setting                   | Default       | Meaning                                           |
| ------------------------- | ------------- | ------------------------------------------------- |
| `FRED_API_KEY`            | `""`          | FRED API key (empty → skipped unless mock mode)   |
| `FRED_TIMEOUT_SECONDS`    | 30.0          | Per-call timeout (fredapi has no published limit) |
| `FRED_SERIES_IDS`         | 5 core series | Comma-separated IDs to ingest weekly              |
| `FRED_INGEST_DAY_OF_WEEK` | 1             | Beat: 1 = Monday                                  |
| `FRED_INGEST_HOUR_UTC`    | 8             | Beat hour (08:00 UTC = weekday AM)                |
| `FRED_INGEST_MINUTE_UTC`  | 0             | Beat minute                                       |

## Risks

- **No published timeout.** `fredapi` does not expose a request timeout. Long-tail requests can hang; 30s is the self-imposed ceiling applied via the underlying requests session. Documented in the module docstring.
- **Data revisions.** FRED publishes revised values that overwrite older dates. The `macro_series` ReplacingMergeTree engine dedupes on `(series_id, ts)`, so re-ingest picks up revisions naturally.
