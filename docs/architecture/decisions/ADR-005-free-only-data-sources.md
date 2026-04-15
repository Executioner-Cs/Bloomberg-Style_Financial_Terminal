# ADR-005: Free-Only External Data Source Policy

**Status:** Accepted
**Date:** 2026-04-15
**Author:** Mayank Khandelwal

---

## Context

This project is a solo-developer financial terminal built for learning, research, and
personal use. Budget for external services is zero. Some APIs originally planned in
ADR-001 have free tiers so restricted (100 req/month for Marketstack; 25 req/day for
Alpha Vantage; 250 req/day for FMP) that they cannot serve even a 500-symbol
watchlist without immediately exhausting quotas. Using them would require a paid plan
before the first meaningful feature is complete.

The original data source selection prioritised data quality and matched a team-budget
assumption. That assumption is corrected here.

## Decision

**All external data sources in this project must be permanently and unconditionally
free, with no credit card required to obtain or maintain access.**

A source is acceptable if and only if:

1. The free tier is usable at the scale this project requires (500 equities, 50 crypto,
   5 macro series, daily ingestion).
2. No payment instrument is required to sign up or maintain the API key.
3. The ToS permits personal/non-commercial use without attribution fees.

A source is **not** acceptable if:

- The free tier is too limited to be practically useful (e.g. < 1000 requests/month
  for a multi-symbol historical ingest job).
- The provider requires a credit card even for the free tier.
- Free access can be revoked at will without a grace period.

## Replacement Data Sources

| Replaced                         | Reason removed                          | Replacement                      |
| -------------------------------- | --------------------------------------- | -------------------------------- |
| Marketstack (100 req/month free) | Exhausted by first historical ingest    | yfinance (Yahoo Finance library) |
| Alpha Vantage (25 req/day free)  | Exhausted by single symbol full history | yfinance (Yahoo Finance library) |
| FMP (250 req/day free)           | Exhausted before S&P 500 fundamentals   | SEC EDGAR XBRL (already planned) |
| StockData.org (100 req/day free) | Low quota; marginal news quality        | NewsAPI (free: 100 req/day)      |

### Approved Free Data Sources (post-ADR)

| Provider             | Data                               | Free Tier                            | API Key |
| -------------------- | ---------------------------------- | ------------------------------------ | ------- |
| yfinance (Yahoo)     | EOD OHLCV, splits, dividends,      | Unlimited (unofficial, no key)       | No      |
|                      | income stmt, balance sheet, ratios |                                      |         |
| SEC EDGAR            | Filings (10-K, 10-Q, 8-K), XBRL    | Unlimited (US govt API, free)        | No      |
| FRED                 | Macro series (GDP, CPI, rates)     | Unlimited (free API key)             | Yes     |
| CoinGecko            | Crypto OHLCV, market data          | 30 req/min, 10k req/month (demo key) | No      |
| Binance WebSocket    | Live crypto tick data              | Unlimited (free)                     | No      |
| Coinbase Advanced WS | Live crypto tick data (fallback)   | Unlimited (free)                     | No      |
| NewsAPI              | Financial news aggregation         | 100 req/day (free developer key)     | Yes     |
| Finnhub              | Supplemental news + quotes         | 60 req/min (free API key)            | Yes     |

### yfinance Notes

`yfinance` wraps Yahoo Finance's unofficial API. Key characteristics:

- No API key. No registration. No rate limit documented (self-throttle to be safe).
- Covers: full OHLCV history for any ticker, fundamental financials, splits, dividends.
- Unofficial: Yahoo can change the underlying API without notice. Monitor for breakage.
- Mitigation: cache aggressively (1-hour TTL for quotes, 24-hour for daily OHLCV,
  7-day for financial statements). One breakage does not down the terminal — stale
  data is served from ClickHouse and PostgreSQL until repaired.
- Self-rate-limit: `YFINANCE_REQUESTS_PER_MINUTE` (default: 60) sourced from settings.

### NewsAPI Notes

NewsAPI free developer tier provides 100 requests/day and article headlines with
summaries. Historical articles are available for up to 1 month on the free tier.
API key required; free registration, no credit card.

### Finnhub Notes

Finnhub free tier: 60 API calls/minute. Provides: real-time US stock quotes,
basic financial statements, company news, analyst recommendations.
Used as a supplemental source when yfinance data is unavailable (e.g. OTC symbols).
API key required; free registration, no credit card.

## Consequences

**Positive:**

- Zero ongoing infrastructure cost for data.
- No risk of surprise billing if usage spikes.
- yfinance covers more data types than Marketstack + FMP combined.
- SEC EDGAR XBRL is higher quality than FMP for fundamental data.

**Negative:**

- yfinance is unofficial. Yahoo Finance reserves the right to block scraping.
  Mitigated by aggressive caching and fallback to stale ClickHouse data.
- NewsAPI free tier limits historical lookback to 1 month.
  Acceptable for a real-time terminal; historical news is a paid-tier feature deferred.
- No intraday equities data (yfinance provides 1D as smallest free timeframe for history
  beyond 7 days; 1m/5m available for recent 7-day window only).
  This is documented as a known limitation. Phase 1 targets daily EOD only.

## Supersedes

No previous ADR. This constrains the data source choices described in ADR-001.
