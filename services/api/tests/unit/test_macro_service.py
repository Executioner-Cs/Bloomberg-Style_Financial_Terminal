"""
Unit tests for MacroService.

All tests mock the MacroRepository and Redis client — no real ClickHouse
or Redis connection required. Covers cache hit, cache miss + populate,
mock-data fallback (ADR-006), and the list_series snapshot.
"""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.models.ch.macro import MacroRow
from src.schemas.macro import MacroBar, MacroSeriesResponse
from src.services.macro_service import MacroService


def _make_redis() -> MagicMock:
    redis = MagicMock()
    redis.get = AsyncMock(return_value=None)
    redis.setex = AsyncMock()
    return redis


def _make_repo() -> MagicMock:
    repo = MagicMock()
    repo.get_series = AsyncMock(return_value=[])
    repo.get_all_series_latest = AsyncMock(return_value={})
    return repo


def _row(series_id: str = "GDP", value: float = 25000.0) -> MacroRow:
    return MacroRow(
        series_id=series_id,
        ts=datetime(2024, 1, 1, tzinfo=UTC),
        value=value,
        source="fred",
    )


class TestMacroServiceGetSeries:
    @pytest.mark.asyncio
    async def test_cache_hit_returns_cached_response_without_db_call(self) -> None:
        repo = _make_repo()
        redis = _make_redis()
        cached = MacroSeriesResponse(
            series_id="GDP",
            name="Gross Domestic Product",
            unit="Billions of Dollars",
            bars=[MacroBar(ts=datetime(2024, 1, 1, tzinfo=UTC), value=1.0)],
            source="fred",
        )
        redis.get.return_value = cached.model_dump_json().encode()

        service = MacroService(repo=repo, redis=redis)
        result = await service.get_series("GDP")

        assert result.series_id == "GDP"
        assert result.bars[0].value == 1.0
        repo.get_series.assert_not_awaited()
        redis.setex.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_cache_miss_queries_repo_and_populates_cache(self) -> None:
        repo = _make_repo()
        repo.get_series.return_value = [_row()]
        redis = _make_redis()

        service = MacroService(repo=repo, redis=redis)
        result = await service.get_series("GDP")

        assert result.series_id == "GDP"
        assert len(result.bars) == 1
        assert result.source == "fred"
        repo.get_series.assert_awaited_once()
        redis.setex.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_empty_repo_result_returns_unknown_source(self) -> None:
        repo = _make_repo()
        redis = _make_redis()

        service = MacroService(repo=repo, redis=redis)
        result = await service.get_series("UNKNOWN")

        assert result.bars == []
        assert result.source == "unknown"


class TestMacroServiceListSeries:
    @pytest.mark.asyncio
    async def test_list_series_uses_latest_snapshot(self) -> None:
        repo = _make_repo()
        repo.get_all_series_latest.return_value = {
            "GDP": (25000.0, datetime(2024, 1, 1, tzinfo=UTC)),
        }
        redis = _make_redis()

        service = MacroService(repo=repo, redis=redis)
        result = await service.list_series()

        gdp = next(m for m in result.series if m.series_id == "GDP")
        assert gdp.latest_value == 25000.0
        assert gdp.latest_ts == datetime(2024, 1, 1, tzinfo=UTC)

    @pytest.mark.asyncio
    async def test_list_series_handles_missing_snapshot(self) -> None:
        repo = _make_repo()
        redis = _make_redis()

        service = MacroService(repo=repo, redis=redis)
        result = await service.list_series()

        for meta in result.series:
            assert meta.latest_value is None
            assert meta.latest_ts is None


class TestMacroServiceMockFallback:
    @pytest.mark.asyncio
    async def test_get_series_reads_mock_when_use_mock_data_true(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from src.services import macro_service as macro_module

        monkeypatch.setattr(macro_module.settings, "use_mock_data", True)

        mock_loader = MagicMock()
        mock_loader.get_macro_series.return_value = MacroSeriesResponse(
            series_id="GDP",
            name="Gross Domestic Product",
            unit="Billions of Dollars",
            bars=[MacroBar(ts=datetime(2024, 1, 1, tzinfo=UTC), value=9.0)],
            source="mock",
        )

        repo = _make_repo()
        redis = _make_redis()
        service = MacroService(repo=repo, redis=redis, mock_loader=mock_loader)
        result = await service.get_series("GDP")

        assert result.source == "mock"
        assert result.bars[0].value == 9.0
        repo.get_series.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_get_series_returns_empty_when_mock_missing(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from src.services import macro_service as macro_module

        monkeypatch.setattr(macro_module.settings, "use_mock_data", True)

        mock_loader = MagicMock()
        mock_loader.get_macro_series.return_value = None

        service = MacroService(
            repo=_make_repo(), redis=_make_redis(), mock_loader=mock_loader
        )
        result = await service.get_series("NOPE")

        assert result.bars == []
        assert result.source == "mock"
