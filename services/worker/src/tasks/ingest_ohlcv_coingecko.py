"""
CoinGecko OHLCV ingestion Celery tasks.

Two tasks:
  - ingest_coingecko_ohlcv: Fetches top-N crypto OHLCV bars and writes to ClickHouse.
    Incremental: checks latest stored timestamp per coin before fetching.
  - seed_crypto_instruments: Idempotent task to populate the instruments table
    from CoinGecko's top-N market cap list.

Both tasks are idempotent — re-running will not duplicate data.

Why Celery tasks and not FastAPI background tasks: Celery tasks are retryable,
monitorable, and distributable. FastAPI background tasks are fire-and-forget
with no retry or observability.
"""

from __future__ import annotations

import asyncio
import json
import logging

import clickhouse_connect
import redis.asyncio as aioredis
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.celery_app import app
from src.config import settings
from src.integrations.coingecko import CoinGeckoClient
from src.models.instrument import Instrument
from src.models.ohlcv import OHLCVRow
from src.repositories.instrument_repository import InstrumentRepository
from src.repositories.ohlcv_repository import OHLCVRepository

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Task: ingest OHLCV data for top-N coins
# ---------------------------------------------------------------------------


@app.task(
    name="src.tasks.ingest_ohlcv_coingecko.ingest_coingecko_ohlcv",
    max_retries=3,
    queue="ingestion",
    bind=True,
)
def ingest_coingecko_ohlcv(self: object) -> dict[str, object]:
    """
    Fetch OHLCV bars for top-N crypto coins and write them to ClickHouse.

    For each coin:
      1. Gets the latest stored timestamp from ClickHouse.
      2. Fetches only new data from CoinGecko (2 days if data exists, 90 if not).
      3. Bulk-inserts into ClickHouse (append-only after timestamp filter).
      4. Updates the Redis quote snapshot for the latest bar.

    Returns a summary dict with counts for monitoring.
    """
    return asyncio.run(_ingest_coingecko_ohlcv_async())


async def _ingest_coingecko_ohlcv_async() -> dict[str, object]:
    """Async implementation called by the synchronous Celery task wrapper."""
    from src.cache import keys as cache_keys

    client = CoinGeckoClient()
    ch = await clickhouse_connect.get_async_client(
        host=settings.clickhouse_host,
        port=settings.clickhouse_http_port,
        database=settings.clickhouse_database,
        username=settings.clickhouse_user,
        password=settings.clickhouse_password,
    )
    repo = OHLCVRepository(ch)
    redis: aioredis.Redis = aioredis.from_url(  # type: ignore[no-untyped-call]
        settings.redis_url, decode_responses=True
    )

    top_coins = await client.get_top_coins_by_market_cap(settings.coingecko_top_n_coins)
    logger.info("Ingesting OHLCV for %d coins", len(top_coins))

    total_inserted = 0
    failed_coins: list[str] = []

    for coin in top_coins:
        try:
            symbol = coin.id.upper()
            latest_ts = await repo.get_latest_ts(symbol, "1D")
            # Fetch 90 days on first run, 2 days on subsequent runs.
            days = 2 if latest_ts is not None else 90

            bars: list[OHLCVRow] = await client.get_ohlcv(coin.id, "usd", days)
            if not bars:
                continue

            # Filter to rows strictly newer than latest stored timestamp.
            if latest_ts is not None:
                bars = [b for b in bars if b.ts > latest_ts]

            if bars:
                await repo.insert_bars(bars)
                total_inserted += len(bars)

            # Update Redis quote snapshot from the most recent bar.
            latest_bar = bars[-1] if bars else None
            if latest_bar is None:
                continue

            await redis.setex(
                cache_keys.quote_snapshot(latest_bar.symbol),
                settings.coingecko_requests_per_minute * 2,
                json.dumps(
                    {
                        "symbol": latest_bar.symbol,
                        "price": latest_bar.close,
                        "ts": latest_bar.ts.isoformat(),
                        "volume_24h": latest_bar.volume,
                    }
                ),
            )

        except Exception:
            logger.exception("Failed to ingest OHLCV for coin %s", coin.id)
            failed_coins.append(coin.id)

    await client.close()
    await redis.aclose()

    logger.info(
        "OHLCV ingestion complete: %d rows inserted, %d coins failed",
        total_inserted,
        len(failed_coins),
    )
    return {
        "inserted": total_inserted,
        "failed": failed_coins,
        "coins_processed": len(top_coins),
    }


# ---------------------------------------------------------------------------
# Task: seed instruments table from CoinGecko top-N
# ---------------------------------------------------------------------------


@app.task(
    name="src.tasks.ingest_ohlcv_coingecko.seed_crypto_instruments",
    max_retries=3,
    queue="ingestion",
    bind=True,
)
def seed_crypto_instruments(self: object) -> dict[str, object]:
    """
    Upsert the top-N crypto coins into the instruments PostgreSQL table.

    Idempotent — safe to re-run. ON CONFLICT DO UPDATE means re-running
    updates name/asset_class if CoinGecko data changes.
    """
    return asyncio.run(_seed_crypto_instruments_async())


async def _seed_crypto_instruments_async() -> dict[str, object]:
    """Async implementation called by the synchronous Celery task wrapper."""
    client = CoinGeckoClient()
    engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    session_factory: async_sessionmaker[AsyncSession] = async_sessionmaker(
        bind=engine, expire_on_commit=False, autoflush=False
    )

    top_coins = await client.get_top_coins_by_market_cap(settings.coingecko_top_n_coins)
    logger.info("Seeding %d crypto instruments", len(top_coins))

    upserted = 0
    failed: list[str] = []

    async with session_factory() as session:
        repo = InstrumentRepository(session)
        for coin in top_coins:
            try:
                instrument = Instrument(
                    symbol=coin.id.upper(),
                    name=coin.name,
                    asset_class="crypto",
                )
                await repo.upsert(instrument)
                upserted += 1
            except Exception:
                logger.exception("Failed to upsert instrument for coin %s", coin.id)
                failed.append(coin.id)

    await engine.dispose()
    await client.close()

    logger.info(
        "Instrument seeding complete: %d upserted, %d failed", upserted, len(failed)
    )
    return {"upserted": upserted, "failed": failed}
