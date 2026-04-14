-- ClickHouse OHLCV time-series table.
-- Schema defined in ADR-002: ClickHouse for OHLCV Time-Series Storage.
-- MergeTree engine ordered by (symbol, timeframe, ts) for O(log N) per-symbol queries.
-- Partitioned by month + timeframe to limit scan range for typical date-range queries.
-- LowCardinality on symbol/timeframe/source reduces memory usage for high-cardinality strings.
-- TTL set to 10 years — financial data has long retention requirements.

CREATE TABLE IF NOT EXISTS terminal.ohlcv
(
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
