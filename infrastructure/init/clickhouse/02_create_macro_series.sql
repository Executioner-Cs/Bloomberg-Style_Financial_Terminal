-- ClickHouse macro series time-series table.
-- Stores FRED macro observations (GDP, CPI, Fed Funds Rate, etc.).
-- ReplacingMergeTree: deduplicates on (series_id, ts) — re-inserting the same
-- observation is idempotent. FRED revises historical data; replacing is correct.
-- Partitioned by year (macro data has coarser granularity than OHLCV).
-- TTL set to 50 years — macro time series have long historical retention value.

CREATE TABLE IF NOT EXISTS terminal.macro_series
(
    series_id    LowCardinality(String),
    ts           DateTime64(3, 'UTC'),
    value        Float64,
    source       LowCardinality(String)
) ENGINE = ReplacingMergeTree()
PARTITION BY toYear(ts)
ORDER BY (series_id, ts)
TTL ts + INTERVAL 50 YEAR;
