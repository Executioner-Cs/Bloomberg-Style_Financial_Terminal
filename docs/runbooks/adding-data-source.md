# Runbook: Adding a New Data Source

Every new external data provider must follow this checklist exactly.
Do NOT skip steps — each step prevents a class of production failures.

---

## Step 1: Read the Terms of Service

Before writing a single line of code, answer these questions:

- What is the rate limit? (per second / minute / day / month?)
- Is commercial usage allowed on your plan?
- Are there caching requirements? (min/max TTL for cached responses?)
- Is attribution required? (logo, text, link?)
- Can you redistribute data? (usually NO — keep data server-side)
- Is a User-Agent header required? (SEC EDGAR requires this)

Document findings. If any policy affects architecture, create an ADR in `docs/architecture/decisions/`.

---

## Step 2: Create the Integration Client

File: `services/api/src/integrations/<provider_name>.py`

Requirements:
- Subclass `BaseIntegrationClient` from `integrations/base.py`
- All methods must have full type annotations (mypy --strict will catch violations)
- Return Pydantic schemas, not raw dicts
- Include required User-Agent header (SEC EDGAR mandates this in `EDGAR_USER_AGENT` env var)
- Implement rate limit tracking using Redis counter

```python
from __future__ import annotations
from .base import BaseIntegrationClient
from ..schemas.market_data import OHLCVBar

class ExampleProviderClient(BaseIntegrationClient):
    provider_name = "example_provider"
    base_url = "https://api.example.com/v1"

    def __init__(self, api_key: str) -> None:
        super().__init__(api_key=api_key)

    def _build_headers(self) -> dict[str, str]:
        return {
            **super()._build_headers(),
            "X-API-Key": self._api_key or "",
        }

    async def get_eod(self, symbol: str, date: str) -> list[OHLCVBar]:
        """Fetch EOD OHLCV data for a symbol on a given date."""
        data = await self.get("/eod", params={"symbol": symbol, "date": date})
        # Parse data into OHLCVBar schema
        ...
```

Unit tests with httpx mock transport (ZERO real HTTP calls):
```python
import pytest
import httpx
from unittest.mock import AsyncMock
from src.integrations.example_provider import ExampleProviderClient

@pytest.mark.asyncio
async def test_get_eod_returns_parsed_bars() -> None:
    client = ExampleProviderClient(api_key="test-key")
    # Mock the HTTP transport
    ...
```

---

## Step 3: Add Environment Variables

Add to `.env.example`:
```bash
# Example Provider — market data for X
# Sign up: https://example.com/api
# Free tier: 100 req/day
EXAMPLE_PROVIDER_API_KEY=REPLACE_WITH_KEY

# Example Provider rate limits (free tier)
EXAMPLE_PROVIDER_DAILY_LIMIT=100
```

Add to `services/api/src/config.py` as `pydantic-settings` fields:
```python
example_provider_api_key: str = ""
example_provider_daily_limit: int = 100
```

---

## Step 4: Create the Ingestion Task

File: `services/worker/src/tasks/<provider>_ingest.py`

Requirements:
- Explicit task name (not auto-generated)
- `max_retries` set (default: 3)
- `time_limit` set (default: 300 seconds)
- Idempotent: re-running the same task must not create duplicate rows
- Log quota usage after each batch

```python
from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded

@shared_task(
    name="src.tasks.example_ingest.ingest_daily",
    max_retries=3,
    time_limit=300,
    soft_time_limit=240,
)
def ingest_daily() -> dict[str, int]:
    """Ingest daily OHLCV from Example Provider."""
    ...
```

Add to schedule in `services/worker/src/celery_app.py`:
```python
"example-daily-ingest": {
    "task": "src.tasks.example_ingest.ingest_daily",
    "schedule": crontab(hour=22, minute=30, day_of_week="1-5"),
    "options": {"queue": "ingestion"},
},
```

---

## Step 5: Add Cache Layer

Add cache key to `services/api/src/cache/keys.py`:
```python
def example_data(instrument_id: str, date: str) -> str:
    """Cache key for Example Provider data."""
    return f"cache:example:{instrument_id}:{date}"
```

Determine TTL — respect ToS. If ToS says "don't cache longer than 1 hour", set TTL=3600.

Pattern in service:
```python
cached = await redis.get(keys.example_data(instrument_id, date))
if cached:
    return parse_cached(cached)
data = await client.get_eod(symbol, date)
await redis.setex(keys.example_data(instrument_id, date), 3600, serialize(data))
return data
```

---

## Step 6: Expose via REST Endpoint

Add to the appropriate router in `services/api/src/routers/`.
Follow existing router patterns — no business logic in routers.

---

## Step 7: Add Integration Test

Use VCR cassette pattern: record the real HTTP response once, replay in CI.
This avoids rate limit consumption in CI and makes tests deterministic.

```python
# Record: set RECORD_CASSETTES=1 to make real HTTP calls and save response
# Replay: cassette file is checked into git, CI uses it
```

---

## Step 8: Update This Runbook

Add a section to this file documenting:
- Provider name and URL
- Rate limits and caching rules
- Which instruments/asset classes it covers
- Any gotchas or known issues discovered during integration

---

## Existing Data Sources

| Provider | File | Asset Classes | Rate Limit | Cache TTL |
|----------|------|---------------|------------|-----------|
| Marketstack | `marketstack.py` | Equities/ETFs/Indices | 100/month (free) | 24h (EOD) |
| Alpha Vantage | `alpha_vantage.py` | Equities/FX/Crypto | 25/day (free) | 24h (EOD) |
| Financial Modeling Prep | `fmp.py` | Fundamentals | 250/day (free) | 24h |
| SEC EDGAR | `edgar.py` | Filings/XBRL | 10/sec | 1h (index) |
| FRED | `fred.py` | Macro series | 500/day (soft) | 24h |
| CoinGecko | `coingecko.py` | Crypto | 30/min (demo) | 5min (prices) |
| StockData.org | `stockdata.py` | News | 100/day (free) | 15min |
