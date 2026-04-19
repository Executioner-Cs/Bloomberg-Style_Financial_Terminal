# Integration Clients

All external data providers live under `services/api/src/integrations/` (mirrored in `services/worker/src/integrations/`). Every client adheres to one of two patterns, short-circuits through the mock layer when `USE_MOCK_DATA=true`, and sources all configuration from `settings` (never hardcoded — CLAUDE.md Rule 1).

## Provider matrix

| Provider  | Module                           | API key    | Rate limit (free tier)  | Cache TTL           | ToS                                                           |
| --------- | -------------------------------- | ---------- | ----------------------- | ------------------- | ------------------------------------------------------------- |
| yfinance  | [`yfinance.py`](./yfinance.md)   | No         | Self-imposed 60 req/min | n/a (EOD)           | [Yahoo](https://legal.yahoo.com/us/en/yahoo/terms/index.html) |
| CoinGecko | [`coingecko.py`](./coingecko.md) | No         | 10–30 req/min           | TBD (Phase 2)       | [CoinGecko](https://www.coingecko.com/en/api_terms)           |
| FRED      | [`fred.py`](./fred.md)           | Yes (free) | None published          | n/a (weekly ingest) | [FRED](https://fred.stlouisfed.org/legal/)                    |
| SEC EDGAR | [`edgar.py`](./edgar.md)         | No         | 10 req/sec (fair-use)   | 24h                 | [SEC](https://www.sec.gov/developer)                          |
| NewsAPI   | [`newsapi.py`](./newsapi.md)     | Yes (free) | 100 req/day             | 300s (5 min)        | [NewsAPI](https://newsapi.org/terms)                          |
| Finnhub   | [`finnhub.py`](./finnhub.md)     | Yes (free) | 60 req/min              | n/a (real-time)     | [Finnhub](https://finnhub.io/terms)                           |

All providers are on the ADR-005 free-only approved list.

## Two client patterns

### Pattern A — HTTP-based (`BaseIntegrationClient` subclass)

Used when the provider exposes a REST API. Inherits retry/backoff/timeout, centralized error handling, and `httpx.AsyncClient` lifecycle. Override `_build_headers()` for auth and `_get_client()` for custom timeouts.

**Providers using this pattern:** CoinGecko, EDGAR, NewsAPI, Finnhub.

### Pattern B — Library-based (async wrapper over sync library)

Used when the provider's official/canonical client is a Python library with its own HTTP session and no configurable surface. Wrapping in `asyncio.get_running_loop().run_in_executor()` keeps the event loop unblocked.

**Providers using this pattern:** yfinance (`yf.Ticker().history()`), FRED (`fredapi.Fred().get_series()`).

Do not force Pattern A on library-based providers — duplicating their internal HTTP retry logic adds complexity without benefit. ADR-005 documents this trade-off.

## Mock mode

When `USE_MOCK_DATA=true`, integration methods short-circuit to `MockDataLoader` (`services/api/src/integrations/mock_loader.py`) which reads committed JSON from `mock_data/`. The toggle is checked at task dispatch level (see `services/worker/src/tasks/*`) rather than inside each client, so live clients remain pure and testable.

See [../runbooks/testing-with-mock-data.md](../runbooks/testing-with-mock-data.md) for setup.

## Adding a new provider

Follow the full checklist in [../runbooks/adding-data-source.md](../runbooks/adding-data-source.md). At minimum:

1. Read the ToS — document rate limits, cache minimums, attribution requirements
2. Pick Pattern A or B based on whether the provider has a canonical library
3. Add config fields to `services/api/src/config.py` (mirror in worker)
4. Create `services/api/src/integrations/<provider>.py` (mirror in worker — CLAUDE.md forbids cross-service imports)
5. Add unit tests with `httpx.MockTransport` (never real HTTP)
6. Document here with a new `<provider>.md` file
