"""
Unit tests for NewsService.

Mocks the NewsAPIClient, Redis, and MockDataLoader — no HTTP or Redis
traffic. Covers: cache hit, cache miss with client call + populate,
no-client fallback (API key unset), mock fallback, and query key hashing.
"""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.schemas.news import NewsArticle, NewsResponse
from src.services.news_service import NewsService


def _make_redis() -> MagicMock:
    redis = MagicMock()
    redis.get = AsyncMock(return_value=None)
    redis.setex = AsyncMock()
    return redis


def _make_client() -> MagicMock:
    client = MagicMock()
    client.get_top_headlines = AsyncMock()
    client.get_symbol_news = AsyncMock()
    return client


def _response(page: int = 1) -> NewsResponse:
    return NewsResponse(
        articles=[
            NewsArticle(
                title="Headline",
                url="https://example.com/a",
                published_at=datetime(2024, 1, 1, tzinfo=UTC),
                source_name="Reuters",
            )
        ],
        total=1,
        page=page,
    )


class TestNewsServiceTopHeadlines:
    @pytest.mark.asyncio
    async def test_cache_hit_short_circuits_client(self) -> None:
        redis = _make_redis()
        redis.get.return_value = _response().model_dump_json().encode()
        client = _make_client()

        service = NewsService(redis=redis, client=client)
        result = await service.get_top_headlines()

        assert result.total == 1
        client.get_top_headlines.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_cache_miss_calls_client_and_populates_cache(self) -> None:
        redis = _make_redis()
        client = _make_client()
        client.get_top_headlines.return_value = _response()

        service = NewsService(redis=redis, client=client)
        result = await service.get_top_headlines()

        assert result.total == 1
        client.get_top_headlines.assert_awaited_once()
        redis.setex.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_no_client_returns_empty_response(self) -> None:
        redis = _make_redis()

        service = NewsService(redis=redis, client=None)
        result = await service.get_top_headlines()

        assert result.articles == []
        assert result.total == 0

    @pytest.mark.asyncio
    async def test_query_uses_hashed_cache_key(self) -> None:
        redis = _make_redis()
        client = _make_client()
        client.get_top_headlines.return_value = _response()

        service = NewsService(redis=redis, client=client)
        await service.get_top_headlines(query="AI chips")

        cache_key_used: str = redis.get.await_args[0][0]
        assert cache_key_used.startswith("cache:news:q:")


class TestNewsServiceSymbolNews:
    @pytest.mark.asyncio
    async def test_cache_key_includes_symbol(self) -> None:
        redis = _make_redis()
        client = _make_client()
        client.get_symbol_news.return_value = _response()

        service = NewsService(redis=redis, client=client)
        await service.get_symbol_news("AAPL")

        cache_key_used: str = redis.get.await_args[0][0]
        assert "AAPL" in cache_key_used


class TestNewsServiceMockFallback:
    @pytest.mark.asyncio
    async def test_mock_path_used_when_use_mock_data_true(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from src.services import news_service as news_module

        monkeypatch.setattr(news_module.settings, "use_mock_data", True)

        mock_loader = MagicMock()
        mock_loader.get_news = MagicMock(return_value=_response())

        service = NewsService(redis=_make_redis(), mock_loader=mock_loader)
        result = await service.get_symbol_news("AAPL")

        assert result.total == 1
        mock_loader.get_news.assert_called_once()

    @pytest.mark.asyncio
    async def test_mock_without_get_news_method_returns_empty(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from src.services import news_service as news_module

        monkeypatch.setattr(news_module.settings, "use_mock_data", True)

        # Loader missing get_news — simulates a pre-A5 mock layer.
        mock_loader = MagicMock(spec=[])
        service = NewsService(redis=_make_redis(), mock_loader=mock_loader)
        result = await service.get_top_headlines()

        assert result.articles == []
