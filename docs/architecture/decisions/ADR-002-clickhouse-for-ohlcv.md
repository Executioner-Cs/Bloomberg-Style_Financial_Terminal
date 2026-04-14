# ADR-002: ClickHouse for OHLCV Time-Series Storage

**Status:** Accepted  
**Date:** 2026-04-13  
**Author:** Mayank Khandelwal

---

## Context

The terminal needs to store and query OHLCV (Open/High/Low/Close/Volume) price data for:
- ~500 equities × 2 years × 252 trading days = ~252,000 daily bars
- ~50 crypto pairs × streaming tick data
- Future: intraday 1-min bars = potentially billions of rows

Queries include:
- "Give me 1 year of daily AAPL bars" (most common, must be < 100ms P50)
- "Calculate VWAP for the last N days across S&P 500" (screener/factor use case)
- "Rolling 20-day SMA across all instruments" (factor calculation)

## Options Considered

| Option | Read Latency | Compression | Solo-dev ops burden |
|--------|-------------|-------------|---------------------|
| PostgreSQL + TimescaleDB | Good | 3–5x | Low |
| ClickHouse | Excellent | 10–50x | Medium |
| InfluxDB v3 | Good | 5–10x | High (proprietary cluster) |
| DuckDB (file-based) | Excellent for offline | 10–30x | Very Low |
| QuestDB | Excellent | Good | Medium |

## Decision

**ClickHouse** for production real-time serving.
**DuckDB** (future, Phase V2) for offline research notebooks and backtesting.

ClickHouse wins because:
1. Sub-second queries on billions of rows proven in production at financial institutions
2. `MergeTree` engine with `ORDER BY (symbol, timeframe, ts)` makes per-symbol queries ~O(log N)
3. Native `toStartOfInterval()`, `argMax()`, `lagInFrame()` functions for time-series analytics
4. Column-store compression: OHLCV is highly repetitive data — 10–50x compression typical
5. Single-node Docker deployment is sufficient for initial scale

## Table Design

```sql
CREATE TABLE ohlcv (
    symbol       LowCardinality(String),
    timeframe    LowCardinality(String),
    ts           DateTime64(3, 'UTC'),
    open         Float64,
    high         Float64,
    low          Float64,
    close        Float64,
    volume       Float64,
    adj_close    Nullable(Float64),
    source       LowCardinality(String)
) ENGINE = MergeTree()
PARTITION BY (toYYYYMM(ts), timeframe)
ORDER BY (symbol, timeframe, ts)
TTL ts + INTERVAL 10 YEAR;
```

## Consequences

**Positive:**
- OHLCV queries for 1Y daily data return in < 100ms P50
- Compression saves significant storage costs at scale
- Can scale to billions of rows on a single node (t3.medium EC2)

**Negative:**
- ClickHouse is append-optimized — updates and deletes are expensive
- Requires understanding `MergeTree` ordering for query performance
- Local dev requires Docker (no in-process option like SQLite)

**Mitigations:**
- Corporate action adjustments stored as `adj_close` column alongside raw `close`
- `ohlcv_repository.py` abstracts all ClickHouse query patterns
- Runbook documents common ClickHouse operations
