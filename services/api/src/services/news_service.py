"""
News service — cache-first reads over the NewsAPI integration client.

Phase 2 persistence policy: cache-only. No database writes. The service
checks Redis first; on miss it calls NewsAPIClient, stores the response,
and returns it. This respects NewsAPI's 100 req/day free tier (ADR-005)
because a 5-minute TTL caps real calls at ~288/day per cache key.

Why no DB: news rows do not yet drive alerts or search. When they do
(Phase 3+), a ClickHouse `news_articles` table will be added and this
service will start writing to it on cache miss. Adding persistence now
would waste cycles on a dataset nothing consumes.

Mock fallback (ADR-006): when settings.use_mock_data is true, the service
reads from MockDataLoader instead of the live API. The loader method
extends MockDataLoader in a later commit in this stage.
"""

from __future__ import annotations

import hashlib
import logging

import redis.asyncio as aioredis

from src.cache import keys as cache_keys
from src.config import settings
from src.integrations.mock_loader import MockDataLoader
from src.integrations.newsapi import NewsAPIClient
from src.schemas.news import NewsResponse

logger = logging.getLogger(__name__)


class NewsService:
    """
    Cache-first wrapper around the NewsAPIClient.

    Depends on an injected Redis client and a lazily-built NewsAPIClient.
    Callers never touch the integration client directly.
    """

    def __init__(
        self,
        redis: aioredis.Redis,
        client: NewsAPIClient | None = None,
        mock_loader: MockDataLoader | None = None,
    ) -> None:
        self._redis = redis
        self._client = client
        self._mock = mock_loader

    async def get_top_headlines(
        self,
        query: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> NewsResponse:
        """
        Return top headlines, optionally filtered by a free-form query.

        The query is hashed into the cache key so long or user-supplied
        queries do not inflate Redis key size.
        """
        if settings.use_mock_data and self._mock is not None:
            return self._mock_response(symbol=None, page=page)

        if query is None:
            cache_key = cache_keys.news_feed(None, page)
        else:
            digest = hashlib.sha1(query.encode("utf-8")).hexdigest()[:16]
            cache_key = cache_keys.news_query(digest, page)

        cached = await self._redis.get(cache_key)
        if cached is not None:
            return NewsResponse.model_validate_json(cached)

        if self._client is None:
            logger.warning("NewsService called without a client; returning empty feed")
            return NewsResponse(articles=[], total=0, page=page)

        response = await self._client.get_top_headlines(
            query=query, page=page, page_size=page_size
        )
        await self._redis.setex(
            cache_key,
            settings.news_cache_ttl_seconds,
            response.model_dump_json(),
        )
        return response

    async def get_symbol_news(
        self,
        symbol: str,
        company_name: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> NewsResponse:
        """Return news articles relevant to *symbol*, cached per (symbol, page)."""
        if settings.use_mock_data and self._mock is not None:
            return self._mock_response(symbol=symbol, page=page)

        cache_key = cache_keys.news_feed(symbol, page)
        cached = await self._redis.get(cache_key)
        if cached is not None:
            return NewsResponse.model_validate_json(cached)

        if self._client is None:
            logger.warning("NewsService called without a client; returning empty feed")
            return NewsResponse(articles=[], total=0, page=page)

        response = await self._client.get_symbol_news(
            symbol=symbol,
            company_name=company_name,
            page=page,
            page_size=page_size,
        )
        await self._redis.setex(
            cache_key,
            settings.news_cache_ttl_seconds,
            response.model_dump_json(),
        )
        return response

    # ------------------------------------------------------------------
    # Mock fallback (ADR-006)
    # ------------------------------------------------------------------

    def _mock_response(self, symbol: str | None, page: int) -> NewsResponse:
        """Read a cached mock feed from disk via MockDataLoader."""
        assert self._mock is not None
        # MockDataLoader.get_news is added alongside the filings mock loader
        # in a follow-up commit in this stage. Until then, fall back to empty.
        get_news = getattr(self._mock, "get_news", None)
        if get_news is None:
            return NewsResponse(articles=[], total=0, page=page)
        result = get_news(symbol=symbol, page=page)
        if not isinstance(result, NewsResponse):
            raise TypeError(
                f"MockDataLoader.get_news returned {type(result)!r}, "
                "expected NewsResponse"
            )
        return result


def build_news_client() -> NewsAPIClient | None:
    """
    Construct the NewsAPIClient from settings, or return None when the
    free-tier key is unset. The router handles a None client by returning
    an empty response so the frontend can render a "key required" state.
    """
    if not settings.newsapi_api_key:
        return None
    return NewsAPIClient(
        api_key=settings.newsapi_api_key,
        timeout_seconds=settings.newsapi_timeout_seconds,
        user_agent=settings.app_user_agent,
    )
