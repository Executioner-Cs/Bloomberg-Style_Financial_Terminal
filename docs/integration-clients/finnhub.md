# Finnhub Integration Client

**Module:** `services/api/src/integrations/finnhub.py` (mirrored in worker)
**Pattern:** `BaseIntegrationClient` (HTTP)
**Status:** Phase 1 ✅ operational as supplemental quote source

## Purpose

Real-time equity quote data. Used as a fallback when yfinance is unavailable or returns stale prices (yfinance is EOD; Finnhub is real-time during market hours).

Phase 3 will additionally use Finnhub's real-time stream (WebSocket) for live ticks — the current client covers the REST `/quote` endpoint only.

## API key

Free tier: **60 requests/minute**. Register at https://finnhub.io/dashboard. Set `FINNHUB_API_KEY` in `.env`. The key is sent as a query param (`token=...`), not a header — Finnhub's convention.

## Usage

```python
from src.integrations.finnhub import FinnhubClient
from src.config import settings

client = FinnhubClient(
    api_key=settings.finnhub_api_key,
    timeout_seconds=settings.finnhub_timeout_seconds,
)

quote = await client.get_quote("AAPL")
if quote is not None:
    print(quote.price, quote.change_24h, quote.ts)
```

Returns `None` when Finnhub has no data for the symbol (Finnhub returns `c=0.0` as its unknown-symbol signal — the client maps this to `None` explicitly).

## Field translation

Finnhub `/quote` returns short-key fields. The client maps them to `QuoteResponse`:

| Finnhub key         | Meaning                             | `QuoteResponse` field                     |
| ------------------- | ----------------------------------- | ----------------------------------------- |
| `c`                 | Current price                       | `price`                                   |
| `d`                 | Absolute change                     | (discarded — `change_24h` uses percent)   |
| `dp`                | Percent change (e.g. `1.5` = +1.5%) | `change_24h` (**divided by 100** → 0.015) |
| `h`, `l`, `o`, `pc` | Day high/low/open/prev close        | (discarded — not needed for Phase 1)      |
| `t`                 | UNIX epoch timestamp                | `ts` (UTC-aware datetime)                 |
| —                   | (Finnhub `/quote` has no volume)    | `volume_24h = None`                       |

**Critical:** `dp` is a percent, not a decimal fraction. The `/100` conversion is tested (`test_finnhub_integration.py::test_get_quote_converts_dp_to_decimal_fraction`). Breaking this silently inflates change-display 100×.

## Configuration

| Setting                   | Default | Meaning             |
| ------------------------- | ------- | ------------------- |
| `FINNHUB_API_KEY`         | `""`    | API key             |
| `FINNHUB_TIMEOUT_SECONDS` | 15.0    | Per-request timeout |

## Risks

- **No volume in REST quote.** `/quote` returns zero volume. For intraday volume use `/stock/candle` (Phase 3).
- **Market-hours only.** Outside US equity trading hours, `t` reflects last-trade timestamp; the client surfaces this as `ts` — downstream must check staleness before displaying as "real-time."
