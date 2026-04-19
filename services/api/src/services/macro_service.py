"""
Macro series service — cache-aside reads over the ClickHouse macro_series table.

Why this lives here and not in the router: routers only accept requests and
call services (CLAUDE.md Part VIII). All cache-lookup + repository-coordination
logic belongs to the service layer.

Data flow:
    1. Check Redis using keys.macro_series(series_id)
    2. On miss: query MacroRepository for the full history
    3. Assemble MacroSeriesResponse from FRED metadata + rows
    4. Store in Redis with TTL from settings.news_cache_ttl_seconds is
       inappropriate — macro series change monthly/quarterly. TTL shares the
       OHLCV cache horizon (1h) because ingestion runs weekly and a shorter
       TTL hurts hit rate without adding freshness.

Mock fallback (ADR-006): when settings.use_mock_data is true, the service
reads from MockDataLoader instead of ClickHouse. No Redis interaction either —
mock data is already local and fast; caching would only mask missing files.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from pathlib import Path

import redis.asyncio as aioredis

from src.cache import keys as cache_keys
from src.config import settings
from src.integrations.mock_loader import MockDataLoader
from src.repositories.macro_repository import MacroRepository
from src.schemas.macro import (
    FRED_SERIES_NAMES,
    FRED_SERIES_UNITS,
    MacroBar,
    MacroSeriesListResponse,
    MacroSeriesMeta,
    MacroSeriesResponse,
)

logger = logging.getLogger(__name__)

# Wide default window: FRED series are monthly/quarterly so 20 years is cheap
# and matches the Phase 1 ingestion backfill horizon.
_DEFAULT_HISTORY_YEARS = 20


class MacroService:
    """
    Read-side service for FRED macro series.

    Does not ingest — the worker owns that (tasks/fred_ingest.py).
    Only exposes cached reads from the ClickHouse macro_series table.
    """

    def __init__(
        self,
        repo: MacroRepository,
        redis: aioredis.Redis,
        mock_loader: MockDataLoader | None = None,
    ) -> None:
        self._repo = repo
        self._redis = redis
        self._mock = mock_loader

    async def list_series(self) -> MacroSeriesListResponse:
        """
        Return metadata for every macro series configured in
        settings.fred_series_ids, with the latest observation snapshot.

        One ClickHouse round-trip regardless of the series count.
        """
        if settings.use_mock_data and self._mock is not None:
            return self._list_series_from_mock()

        latest_map = await self._repo.get_all_series_latest()
        metas: list[MacroSeriesMeta] = []
        for series_id in settings.fred_series_ids:
            snapshot = latest_map.get(series_id)
            latest_value: float | None = snapshot[0] if snapshot else None
            latest_ts: datetime | None = snapshot[1] if snapshot else None
            metas.append(
                MacroSeriesMeta(
                    series_id=series_id,
                    name=FRED_SERIES_NAMES.get(series_id, series_id),
                    unit=FRED_SERIES_UNITS.get(series_id, ""),
                    latest_value=latest_value,
                    latest_ts=latest_ts,
                )
            )
        return MacroSeriesListResponse(series=metas)

    async def get_series(
        self,
        series_id: str,
        from_date: datetime | None = None,
        to_date: datetime | None = None,
    ) -> MacroSeriesResponse:
        """
        Return all observations for *series_id* within the requested window.

        Defaults: last 20 years to now — sized for the FRED backfill horizon.
        """
        if settings.use_mock_data and self._mock is not None:
            response = self._mock.get_macro_series(series_id)
            if response is None:
                return MacroSeriesResponse(
                    series_id=series_id,
                    name=FRED_SERIES_NAMES.get(series_id, series_id),
                    unit=FRED_SERIES_UNITS.get(series_id, ""),
                    bars=[],
                    source="mock",
                )
            return response

        now = datetime.now(tz=UTC)
        window_from = from_date or datetime(
            now.year - _DEFAULT_HISTORY_YEARS, now.month, now.day, tzinfo=UTC
        )
        window_to = to_date or now

        cache_key = cache_keys.macro_series(series_id)
        cached = await self._redis.get(cache_key)
        if cached is not None:
            return MacroSeriesResponse.model_validate_json(cached)

        rows = await self._repo.get_series(series_id, window_from, window_to)
        source = rows[0].source if rows else "unknown"
        bars = [MacroBar(ts=r.ts, value=r.value) for r in rows]
        response = MacroSeriesResponse(
            series_id=series_id,
            name=FRED_SERIES_NAMES.get(series_id, series_id),
            unit=FRED_SERIES_UNITS.get(series_id, ""),
            bars=bars,
            source=source,
        )
        # Reuse ohlcv_cache_ttl_seconds (1h): macro updates weekly, so 1h is
        # well inside the freshness window while keeping hit-rate high.
        await self._redis.setex(
            cache_key,
            settings.ohlcv_cache_ttl_seconds,
            response.model_dump_json(),
        )
        return response

    # ------------------------------------------------------------------
    # Mock fallbacks (ADR-006)
    # ------------------------------------------------------------------

    def _list_series_from_mock(self) -> MacroSeriesListResponse:
        """Build the list response by reading each mock series JSON file."""
        assert self._mock is not None
        metas: list[MacroSeriesMeta] = []
        for series_id in settings.fred_series_ids:
            series = self._mock.get_macro_series(series_id)
            latest_value: float | None = None
            latest_ts: datetime | None = None
            if series is not None and series.bars:
                latest_value = series.bars[-1].value
                latest_ts = series.bars[-1].ts
            metas.append(
                MacroSeriesMeta(
                    series_id=series_id,
                    name=FRED_SERIES_NAMES.get(series_id, series_id),
                    unit=FRED_SERIES_UNITS.get(series_id, ""),
                    latest_value=latest_value,
                    latest_ts=latest_ts,
                )
            )
        return MacroSeriesListResponse(series=metas)


def build_mock_loader() -> MockDataLoader | None:
    """
    Construct a MockDataLoader if settings.use_mock_data is true.

    Exposed here so routers can build a MacroService without knowing how mock
    paths are resolved. Returns None when mocking is off.
    """
    if not settings.use_mock_data:
        return None
    if settings.mock_data_dir:
        path = Path(settings.mock_data_dir)
    else:
        # Walk up from this file until .git/ is found, then use <root>/mock_data.
        current = Path(__file__).resolve().parent
        while current != current.parent:
            if (current / ".git").exists():
                path = current / "mock_data"
                break
            current = current.parent
        else:
            path = Path(__file__).resolve().parents[3] / "mock_data"
    return MockDataLoader(path)
