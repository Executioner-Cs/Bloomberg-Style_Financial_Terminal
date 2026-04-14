-- PostgreSQL instruments table.
-- Stores metadata for all tradeable instruments across asset classes.
-- Indexed on asset_class and exchange for the screener and watchlist filter queries.
-- UUID primary key avoids int sequence contention in future multi-region setups.
-- updated_at is maintained by application logic on upsert (no trigger needed at Phase 1).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS instruments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol      VARCHAR(20)  NOT NULL UNIQUE,
    name        VARCHAR(255) NOT NULL,
    -- 'equity', 'crypto', 'fx', 'macro' — controlled by application-layer validation
    asset_class VARCHAR(50)  NOT NULL,
    exchange    VARCHAR(50),
    currency    VARCHAR(10)  NOT NULL DEFAULT 'USD',
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Filter by asset class (screener, watchlist)
CREATE INDEX IF NOT EXISTS idx_instruments_asset_class ON instruments (asset_class);

-- Filter by exchange (instrument search)
CREATE INDEX IF NOT EXISTS idx_instruments_exchange ON instruments (exchange);
