# SEC EDGAR Integration Client

**Module:** `services/api/src/integrations/edgar.py` (mirrored in worker)
**Pattern:** `BaseIntegrationClient` (HTTP)
**Status:** Phase 1 ✅ client built; Phase 4 activates full filings ingest

## Purpose

Fetches recent SEC filings (10-K, 10-Q, 8-K) from the EDGAR Full-Text Search API (EFTS). The worker task `edgar_ingest` is a stub in Phase 1 — it imports the client but does not yet persist filings to a repository. Phase 4 builds the `FilingsRepository` and activates ingest.

## User-Agent requirement

**SEC ToS mandates a User-Agent header on every request.** The format is `"CompanyName/Version contact@email.com"`. Requests without one may be rate-limited or blocked.

Set `EDGAR_USER_AGENT` in `.env` to a string that identifies you with a real contact email. The default `.env.example` value is a placeholder — replace it before any production deployment.

## Endpoints used

| Endpoint                                               | Purpose                                  |
| ------------------------------------------------------ | ---------------------------------------- |
| `/LATEST/search-index`                                 | Full-text search across filings metadata |
| `/Archives/edgar/data/{cik}/{accession}/...-index.htm` | Filing index page (link target)          |

EFTS caps results at 10 per page. For historical bulk loads use EDGAR's daily XBRL dumps instead (Phase 4+).

## Usage

```python
from src.integrations.edgar import EDGARClient
from src.config import settings

client = EDGARClient(
    user_agent=settings.edgar_user_agent,
    timeout_seconds=settings.edgar_timeout_seconds,
)

response = await client.get_recent_filings(
    symbol="AAPL",
    form_types=["10-K", "10-Q"],  # subset of SUPPORTED_FORM_TYPES
    limit=10,
)
# response: FilingsResponse(symbol="AAPL", filings=[Filing(...), ...], total=N)
```

Unsupported form types raise `ValueError` — the whitelist is `schemas/filings.py::SUPPORTED_FORM_TYPES` (10-K, 10-Q, 8-K).

## Output shape

Each hit becomes a `Filing` (`src/schemas/filings.py`) with:

- `form_type`, `filed_at` (UTC-aware datetime), `period_of_report` (date)
- `accession_number` (dashed format, e.g. `0000320193-26-000001`)
- `filing_url` built from CIK + accession via `_build_filing_url()` — the index HTM page on EDGAR, not the raw document

Hits with missing `file_date` or `period_of_report` are skipped (logged at debug).

## Configuration

| Setting                   | Default                                           | Meaning                             |
| ------------------------- | ------------------------------------------------- | ----------------------------------- |
| `EDGAR_USER_AGENT`        | `"Bloomberg-Terminal/1.0 your-email@example.com"` | **Replace before production**       |
| `EDGAR_TIMEOUT_SECONDS`   | 30.0                                              | Per-request timeout                 |
| `EDGAR_CACHE_TTL_SECONDS` | 86400                                             | 24h — filings don't change intraday |

## Rate limits

EDGAR's published fair-use limit is 10 requests/second. The client uses `BaseIntegrationClient` retry with exponential backoff on 429; sustained high-frequency use without the User-Agent risks a global IP block (documented on SEC developer page).

## Risks

- **HTML fragility.** The `filing_url` points to an index page, not the structured document. Phase 4 will add an extractor that parses the index to find the primary filing document link.
- **Entity disambiguation.** Symbol-based search can match multiple CIKs for companies with name collisions. The stub does not yet reconcile against a CIK map; Phase 4 will ingest the canonical company-tickers.json mapping.
