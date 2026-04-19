"""
FRED macro series ingestion Celery task.

Fetches macro observations from the Federal Reserve Economic Data API
and writes them to the ClickHouse macro_series table. Scheduled weekly
on Monday at 08:00 UTC. See celery_app.py beat schedule.

Idempotent: checks latest stored timestamp per series before fetching.
ReplacingMergeTree engine additionally deduplicates on (series_id, ts).

FRED API key required for live mode — register free at:
https://fred.stlouisfed.org/docs/api/api_key.html
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path

import clickhouse_connect

from src.celery_app import app
from src.config import settings
from src.integrations.fred import FredClient
from src.integrations.mock_loader import MockDataLoader
from src.models.macro import MacroRow
from src.repositories.macro_repository import MacroRepository

logger = logging.getLogger(__name__)


@app.task(
    name="src.tasks.fred_ingest.refresh_macro_series",
    max_retries=settings.celery_task_max_retries,
    queue="ingestion",
    bind=True,
)
def refresh_macro_series(self: object) -> dict[str, object]:
    """
    Fetch macro observations for all tracked FRED series and write to ClickHouse.

    Scheduled weekly on Monday 08:00 UTC — macro data releases are weekday AM.
    Uses FRED API for live data or MockDataLoader when USE_MOCK_DATA=true.

    Returns a summary dict with inserted row counts for monitoring.
    """
    return asyncio.run(_refresh_macro_series_async())


async def _refresh_macro_series_async() -> dict[str, object]:
    """Async implementation called by the synchronous Celery task wrapper."""
    series_ids: list[str] = settings.fred_series_ids

    # Mock mode: load from pre-generated JSON files, write to ClickHouse.
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
        repo = MacroRepository(ch)
        total_inserted = 0
        failed: list[str] = []

        for series_id in series_ids:
            try:
                rows = loader.get_macro_rows(series_id)
                if rows:
                    await repo.insert_rows(rows)
                    total_inserted += len(rows)
            except Exception:
                logger.exception("Mock macro load failed for series %s", series_id)
                failed.append(series_id)

        logger.info(
            "Mock FRED ingest complete: %d rows, %d series failed",
            total_inserted,
            len(failed),
        )
        return {
            "inserted": total_inserted,
            "failed": failed,
            "series_processed": len(series_ids),
            "mode": "mock",
        }

    # Live mode: fetch from FRED via fredapi.
    if not settings.fred_api_key:
        logger.warning(
            "FRED_API_KEY is not set — skipping live macro ingestion. "
            "Set USE_MOCK_DATA=true or provide a FRED API key."
        )
        return {"inserted": 0, "failed": [], "series_processed": 0, "mode": "skipped"}

    client = FredClient(
        api_key=settings.fred_api_key,
        timeout_seconds=settings.fred_timeout_seconds,
    )
    ch = await clickhouse_connect.get_async_client(
        host=settings.clickhouse_host,
        port=settings.clickhouse_http_port,
        database=settings.clickhouse_database,
        username=settings.clickhouse_user,
        password=settings.clickhouse_password,
    )
    repo = MacroRepository(ch)

    total_inserted = 0
    failed_series: list[str] = []

    for series_id in series_ids:
        try:
            latest_ts = await repo.get_latest_ts(series_id)
            fetched: list[MacroRow] = await client.get_series(
                series_id,
                observation_start=latest_ts.date() if latest_ts is not None else None,
            )

            if not fetched:
                continue

            # Filter to rows strictly newer than latest stored timestamp.
            if latest_ts is not None:
                fetched = [r for r in fetched if r.ts > latest_ts]

            if fetched:
                await repo.insert_rows(fetched)
                total_inserted += len(fetched)

        except Exception:
            logger.exception("Failed to ingest FRED series %s", series_id)
            failed_series.append(series_id)

    logger.info(
        "FRED macro ingest complete: %d rows inserted, %d series failed",
        total_inserted,
        len(failed_series),
    )
    return {
        "inserted": total_inserted,
        "failed": failed_series,
        "series_processed": len(series_ids),
        "mode": "live",
    }


def _find_project_root() -> Path:
    """Walk up from this file until a directory containing .git/ is found."""
    current = Path(__file__).resolve().parent
    while current != current.parent:
        if (current / ".git").exists():
            return current
        current = current.parent
    return Path(__file__).resolve().parents[4]
