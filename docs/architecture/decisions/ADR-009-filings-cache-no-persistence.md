# ADR-009 — Filings Cache: In-Memory Only, No ClickHouse Persistence

**Status:** Accepted  
**Date:** 2026-04-19  
**Deciders:** Mayank Khandelwal

---

## Context

The Filings panel fetches SEC EDGAR full-text search results via the EDGAR
EFTS (full-text search) endpoint. Each response is a list of filing metadata
objects (no raw document content — EDGAR ToS prohibits redistribution of full
filing text).

Two storage strategies were considered:

1. **Cache only (Redis TTL)** — store API responses in Redis with a TTL matching
   the EDGAR rate limit window. No ClickHouse table. Responses expire and are
   re-fetched on cache miss.

2. **Cache + ClickHouse persistence** — write filing metadata to a ClickHouse
   table on every fetch; use the cache as a write-through layer. Supports
   historical filing queries and offline access.

---

## Decision

**Cache only (Redis TTL). No ClickHouse persistence for filing search results.**

The 24-hour Redis TTL (sourced from `settings.edgar_cache_ttl_seconds = 86400`)
is sufficient for the terminal's filing search use case.

---

## Rationale

**Filing search results are query-specific, not symbol-specific.**  
EDGAR search returns results for a (symbol, form_type, date_range) tuple.
There is no natural primary key to persist by — the same filing may appear in
multiple searches with different ranking scores. ClickHouse's columnar storage
is optimized for time-series OHLCV data with stable primary keys, not
free-text search result sets.

**The data already lives in EDGAR's index.**  
SEC EDGAR maintains its own full-text search index (EFTS). Re-persisting the
results in our ClickHouse is redundant storage with no retrieval advantage.
The terminal is a read-only consumer of EDGAR data, not an archive.

**EDGAR ToS limits caching scope.**  
The SEC requires that EDGAR data not be used for bulk extraction or redistribution.
Persisting all search results indefinitely in ClickHouse creates a secondary
derivative index that could be interpreted as bulk extraction. A TTL-bounded
cache respects the spirit of these terms.

**ClickHouse table would be empty in practice.**  
The terminal's filing panel is interactive: users search, read, and navigate.
They do not run historical backtests against filing metadata. Persisting results
for offline access serves a use case that does not exist in this product tier.

---

## Consequences

**Positive:**

- No ClickHouse schema migration required for the Filings panel
- Simpler worker architecture: no filing ingestion Celery task
- Reduced storage costs (filing metadata can be large)
- EDGAR ToS compliance is easier to verify (short-lived cache)

**Negative:**

- Filing search results are lost on Redis flush (e.g., memory pressure, restart)
- No historical query capability (cannot retrieve past search results)
- Cache miss on fresh deployment — first query per (symbol, form_type) hits EDGAR

**Accepted trade-off:**  
The terminal's filing workflow is interactive and stateless — no feature in
Phase 2 or Phase 3 requires persistent historical filing search results.
If a ClickHouse filings table becomes necessary (e.g., for an AI filing
summarizer that needs bulk access), this decision should be superseded with a
new ADR documenting the specific requirements.

---

## Alternatives Considered

**ClickHouse filing_events table (rejected):**  
Would store `(cik, accession_number, form_type, filed_at, period_of_report,
filing_url)` as append-only rows. Rejected because:

- Adds a recurring ingestion Celery task with no query workload to justify it
- Filing URLs already encode the accession number — EDGAR is always the source of truth
- Primary key design is non-obvious (accession numbers are globally unique but string-heavy)

**No cache, direct EDGAR on every request (rejected):**  
EDGAR free tier: 10 requests/second, no daily cap but subject to IP throttling.
Without caching, the terminal would hit rate limits during active use sessions
with multiple users or repeated searches.
