# NewsAPI Integration Client

**Module:** `services/api/src/integrations/newsapi.py` (mirrored in worker)
**Pattern:** `BaseIntegrationClient` (HTTP)
**Status:** Phase 1 ✅ client built; Phase 4 activates caching + panel wiring

## Purpose

Fetches top headlines and symbol-specific business news from NewsAPI.org. The worker task `news_ingest` is a stub in Phase 1 — no cache, no persistence. Phase 4 wires it into the news panel with Redis-backed caching.

## API key and free-tier limits

- Free tier: **100 requests/day**. Development use only per NewsAPI ToS.
- Register at https://newsapi.org/register for a free key.
- `NEWSAPI_KEY` must be set in `.env`. An empty key produces `X-Api-Key: ""` and all requests fail — intentional, no silent fallback.

The `/everything` endpoint is paid-only. Phase 4 caching uses `/top-headlines` with a `q=` query, which is free-tier compatible.

## Usage

```python
from src.integrations.newsapi import NewsAPIClient
from src.config import settings

client = NewsAPIClient(
    api_key=settings.newsapi_key,
    timeout_seconds=settings.newsapi_timeout_seconds,
)

# General business headlines
resp = await client.get_top_headlines(page_size=20)

# Symbol-scoped news
resp = await client.get_symbol_news("AAPL", company_name="Apple")
# resp: NewsResponse(articles=[NewsArticle(...)], total=N, page=1)
```

## Article filtering

`_article_from_raw()` drops articles where:

- Title, URL, or `publishedAt` are missing
- Title or URL equals the literal `"[Removed]"` — NewsAPI marks removed articles this way
- `publishedAt` fails ISO-8601 parsing

This is non-negotiable — `NewsArticle` schema requires all three fields.

## Cache policy

Cache TTL is **300s (5 minutes)** per `NEWS_CACHE_TTL_SECONDS`. Rationale:

```
100 req/day ÷ 86400 sec = ~1 req per 864 sec
Cache every 300 sec → worst case 288 calls/day (well under 100-per-top-headline + per-symbol budget)
```

Phase 4 adds cache keys under `cache/keys.py::news_by_symbol(symbol)` and `cache/keys.py::news_top_headlines(query)`.

## Output shape

`NewsArticle` fields: `title`, `description`, `url`, `published_at` (UTC), `source_name`, `symbol` (optional; attached by `get_symbol_news`).

## Configuration

| Setting                   | Default | Meaning                             |
| ------------------------- | ------- | ----------------------------------- |
| `NEWSAPI_KEY`             | `""`    | API key (empty → request fails)     |
| `NEWSAPI_TIMEOUT_SECONDS` | 15.0    | Per-request timeout                 |
| `NEWS_CACHE_TTL_SECONDS`  | 300     | 5 min — budgets 100 req/day cleanly |

## Risks

- **Free tier quota exhaustion.** One burst of uncached requests hits the daily limit fast. Phase 4 must enforce cache-aside before exposing any user-facing endpoint.
- **Source bias.** NewsAPI's `category=business` default covers a narrow English-language set. The client is display-only per ToS — never store or redistribute raw article body.
