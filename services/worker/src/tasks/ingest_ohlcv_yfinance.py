"""
yfinance equity OHLCV ingestion Celery task.

Fetches end-of-day OHLCV bars for tracked equity symbols from Yahoo Finance
and writes them to ClickHouse. Scheduled daily at 21:30 UTC (4:30 PM ET,
30 minutes after NYSE market close). See celery_app.py beat schedule.

Idempotent: checks latest stored timestamp per symbol before fetching.
Only inserts rows strictly newer than the latest stored bar.

Why Celery tasks and not FastAPI background tasks: Celery tasks are retryable,
monitorable, and distributable. FastAPI background tasks are fire-and-forget
with no retry or observability.
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path

import clickhouse_connect

from src.celery_app import app
from src.config import settings
from src.integrations.base import IntegrationError
from src.integrations.mock_loader import MockDataError, MockDataLoader
from src.integrations.yfinance import YFinanceClient
from src.models.ohlcv import OHLCVRow
from src.repositories.ohlcv_repository import OHLCVRepository
from src.tasks.types import OHLCVTaskResult

logger = logging.getLogger(__name__)


@app.task(
    name="src.tasks.ingest_ohlcv_yfinance.ingest_yfinance_ohlcv",
    max_retries=settings.celery_task_max_retries,
    queue="ingestion",
    bind=True,
)
def ingest_yfinance_ohlcv(self: object) -> OHLCVTaskResult:
    """
    Fetch EOD OHLCV for all tracked equity symbols and write to ClickHouse.

    Scheduled daily at 21:30 UTC (4:30 PM ET, 30 min after NYSE close).
    Uses yfinance for live data or MockDataLoader when USE_MOCK_DATA=true.

    Returns a summary dict with inserted row counts for monitoring.
    """
    return asyncio.run(_ingest_yfinance_ohlcv_async())


async def _ingest_yfinance_ohlcv_async() -> OHLCVTaskResult:
    """Async implementation called by the synchronous Celery task wrapper."""
    symbols: list[str] = settings.yfinance_equity_symbols

    # Mock mode: load from pre-generated JSON files, write to ClickHouse.
    # USE_MOCK_DATA=true skips the yfinance network call entirely.
    if settings.use_mock_data:
        mock_dir = (
            Path(settings.mock_data_dir)
            if settings.mock_data_dir
            else _find_project_root() / "mock_data"
        )
        loader = MockDataLoader(mock_dir)
        ch = await clickhouse_connect.get_async_client(
            host=settings.clickhouse_host,
            port=settings.clickhouse_http_port,
            database=settings.clickhouse_database,
            username=settings.clickhouse_user,
            password=settings.clickhouse_password,
        )
        repo = OHLCVRepository(ch)
        total_inserted = 0
        failed: list[str] = []

        for symbol in symbols:
            try:
                rows = loader.get_ohlcv(symbol, "1D")
            except MockDataError:
                # Missing mock file for this symbol — expected during dev setup.
                logger.exception(
                    "Mock OHLCV file missing for symbol %s — skipping",
                    symbol,
                )
                failed.append(symbol)
                continue
            if rows:
                await repo.insert_bars(rows)
                total_inserted += len(rows)

        logger.info(
            "Mock yfinance ingest complete: %d rows, %d symbols failed",
            total_inserted,
            len(failed),
        )
        return {
            "inserted": total_inserted,
            "failed": failed,
            "symbols_processed": len(symbols),
            "mode": "mock",
        }

    # Live mode: fetch from Yahoo Finance via yfinance library.
    client = YFinanceClient(timeout_seconds=settings.yfinance_timeout_seconds)
    ch = await clickhouse_connect.get_async_client(
        host=settings.clickhouse_host,
        port=settings.clickhouse_http_port,
        database=settings.clickhouse_database,
        username=settings.clickhouse_user,
        password=settings.clickhouse_password,
    )
    repo = OHLCVRepository(ch)

    total_inserted = 0
    failed_symbols: list[str] = []

    for symbol in symbols:
        # DB errors are intentionally NOT caught here — they propagate so
        # Celery can retry the whole task (e.g., ClickHouse outage).
        latest_ts = await repo.get_latest_ts(symbol, "1D")
        # Fetch 365 days on first run, 2 days on subsequent runs.
        days = 2 if latest_ts is not None else 365

        try:
            bars: list[OHLCVRow] = await client.get_ohlcv(symbol, days=days)
        except IntegrationError:
            # yfinance returned an unrecoverable error for this symbol.
            # Per-symbol failure: log and continue so other symbols are not blocked.
            logger.exception("yfinance fetch failed for equity %s — skipping", symbol)
            failed_symbols.append(symbol)
            continue

        if not bars:
            continue

        # Filter to rows strictly newer than latest stored timestamp.
        if latest_ts is not None:
            bars = [b for b in bars if b.ts > latest_ts]

        if bars:
            await repo.insert_bars(bars)
            total_inserted += len(bars)

    logger.info(
        "yfinance OHLCV ingest complete: %d rows inserted, %d symbols failed",
        total_inserted,
        len(failed_symbols),
    )
    return {
        "inserted": total_inserted,
        "failed": failed_symbols,
        "symbols_processed": len(symbols),
        "mode": "live",
    }


def _find_project_root() -> Path:
    """
    Walk up from this file until a directory containing .git/ is found.

    Mirrors the implementation in config.py — duplicated here because the
    worker task runs in a subprocess where __file__ gives the task module path.
    """
    current = Path(__file__).resolve().parent
    while current != current.parent:
        if (current / ".git").exists():
            return current
        current = current.parent
    return Path(__file__).resolve().parents[4]
