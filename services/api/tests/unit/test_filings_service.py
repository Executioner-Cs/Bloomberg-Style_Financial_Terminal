"""
Unit tests for FilingsService.

Mocks the EDGARClient, Redis, and MockDataLoader — no HTTP or Redis
traffic. Covers: cache hit, cache miss with client call + populate,
no-client fallback, mock fallback, and form-type cache key isolation.
"""

from __future__ import annotations

from datetime import UTC, date, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.schemas.filings import Filing, FilingsResponse
from src.services.filings_service import FilingsService


def _make_redis() -> MagicMock:
    redis = MagicMock()
    redis.get = AsyncMock(return_value=None)
    redis.setex = AsyncMock()
    return redis


def _make_client() -> MagicMock:
    client = MagicMock()
    client.get_recent_filings = AsyncMock()
    return client


def _response(symbol: str = "AAPL") -> FilingsResponse:
    return FilingsResponse(
        symbol=symbol,
        filings=[
            Filing(
                symbol=symbol,
                form_type="10-K",
                filed_at=datetime(2024, 1, 1, tzinfo=UTC),
                period_of_report=date(2023, 12, 31),
                accession_number="0000320193-24-000001",
                filing_url="https://www.sec.gov/example",
            )
        ],
        total=1,
    )


class TestFilingsServiceCacheBehavior:
    @pytest.mark.asyncio
    async def test_cache_hit_short_circuits_client(self) -> None:
        redis = _make_redis()
        redis.get.return_value = _response().model_dump_json().encode()
        client = _make_client()

        service = FilingsService(redis=redis, client=client)
        result = await service.get_filings("AAPL")

        assert result.total == 1
        client.get_recent_filings.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_cache_miss_calls_client_and_populates_cache(self) -> None:
        redis = _make_redis()
        client = _make_client()
        client.get_recent_filings.return_value = _response()

        service = FilingsService(redis=redis, client=client)
        result = await service.get_filings("AAPL")

        assert result.total == 1
        client.get_recent_filings.assert_awaited_once()
        redis.setex.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_no_client_returns_empty_response(self) -> None:
        redis = _make_redis()
        service = FilingsService(redis=redis, client=None)

        result = await service.get_filings("AAPL")

        assert result.symbol == "AAPL"
        assert result.filings == []
        assert result.total == 0

    @pytest.mark.asyncio
    async def test_form_type_isolates_cache_key(self) -> None:
        redis = _make_redis()
        client = _make_client()
        client.get_recent_filings.return_value = _response()

        service = FilingsService(redis=redis, client=client)
        await service.get_filings("AAPL", form_type="10-K")

        cache_key_used: str = redis.get.await_args[0][0]
        assert "AAPL" in cache_key_used
        assert "10-K" in cache_key_used


class TestFilingsServiceMockFallback:
    @pytest.mark.asyncio
    async def test_mock_path_used_when_use_mock_data_true(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from src.services import filings_service as filings_module

        monkeypatch.setattr(filings_module.settings, "use_mock_data", True)

        mock_loader = MagicMock()
        mock_loader.get_filings = MagicMock(return_value=_response())

        service = FilingsService(redis=_make_redis(), mock_loader=mock_loader)
        result = await service.get_filings("AAPL")

        assert result.total == 1
        mock_loader.get_filings.assert_called_once()

    @pytest.mark.asyncio
    async def test_mock_without_get_filings_method_returns_empty(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from src.services import filings_service as filings_module

        monkeypatch.setattr(filings_module.settings, "use_mock_data", True)

        # Loader missing get_filings — simulates a pre-A5 mock layer.
        mock_loader = MagicMock(spec=[])
        service = FilingsService(redis=_make_redis(), mock_loader=mock_loader)
        result = await service.get_filings("AAPL")

        assert result.symbol == "AAPL"
        assert result.filings == []
