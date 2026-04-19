"""
Filings service — cache-first reads over the SEC EDGAR integration client.

Phase 2 persistence policy: cache-only. Filings metadata is published
quarterly, so a 24-hour Redis TTL (settings.filings_cache_ttl_seconds)
comfortably covers freshness while respecting EDGAR's self-imposed
politeness cap of 10 req/sec (ADR-005).

Why no DB: filings rows do not yet drive alerts or search. When they do
(Phase 3+), a Postgres `filings` table will be added and this service
will start writing to it on cache miss.

Mock fallback (ADR-006): when settings.use_mock_data is true, the service
reads from MockDataLoader instead of the live API. The loader method is
added alongside the news mock loader in a follow-up commit in this stage;
until then, the service falls back to an empty response.
"""

from __future__ import annotations

import logging
from typing import cast

import redis.asyncio as aioredis

from src.cache import keys as cache_keys
from src.config import settings
from src.integrations.edgar import EDGARClient
from src.integrations.mock_loader import MockDataLoader
from src.schemas.filings import SUPPORTED_FORM_TYPES, FilingsResponse

logger = logging.getLogger(__name__)


class FilingsService:
    """
    Cache-first wrapper around the EDGARClient.

    Callers never touch the integration client directly — the router builds
    this service via DI and calls get_filings() only.
    """

    def __init__(
        self,
        redis: aioredis.Redis,
        client: EDGARClient | None = None,
        mock_loader: MockDataLoader | None = None,
    ) -> None:
        self._redis = redis
        self._client = client
        self._mock = mock_loader

    async def get_filings(
        self,
        symbol: str,
        form_type: str | None = None,
        limit: int = 10,
    ) -> FilingsResponse:
        """
        Return recent filings for *symbol*, optionally filtered to one form.

        Cache key includes the form filter so 10-K and 10-Q requests do not
        collide. A None form_type fetches all SUPPORTED_FORM_TYPES.
        """
        if settings.use_mock_data and self._mock is not None:
            return self._mock_response(symbol=symbol, form_type=form_type)

        cache_key = cache_keys.filings(symbol, form_type)
        cached = await self._redis.get(cache_key)
        if cached is not None:
            return FilingsResponse.model_validate_json(cached)

        if self._client is None:
            logger.warning(
                "FilingsService called without a client; returning empty response"
            )
            return FilingsResponse(symbol=symbol, filings=[], total=0)

        form_types = [form_type] if form_type else list(SUPPORTED_FORM_TYPES)
        response = await self._client.get_recent_filings(
            symbol=symbol,
            form_types=form_types,
            limit=limit,
        )
        await self._redis.setex(
            cache_key,
            settings.filings_cache_ttl_seconds,
            response.model_dump_json(),
        )
        return response

    # ------------------------------------------------------------------
    # Mock fallback (ADR-006)
    # ------------------------------------------------------------------

    def _mock_response(self, symbol: str, form_type: str | None) -> FilingsResponse:
        """Read a cached mock filings payload from disk via MockDataLoader."""
        assert self._mock is not None
        # MockDataLoader.get_filings is added alongside get_news in a
        # follow-up commit in this stage. Until then, return empty.
        get_filings = getattr(self._mock, "get_filings", None)
        if get_filings is None:
            return FilingsResponse(symbol=symbol, filings=[], total=0)
        return cast(FilingsResponse, get_filings(symbol=symbol, form_type=form_type))


def build_edgar_client() -> EDGARClient | None:
    """
    Construct the EDGARClient from settings.

    EDGAR requires no API key but does require a User-Agent with contact
    info. The setting defaults to a placeholder — returning None when the
    placeholder is still in use would mislead callers; EDGAR accepts the
    default User-Agent and will only rate-limit abuse, so we always build
    the client.
    """
    return EDGARClient(
        user_agent=settings.edgar_user_agent,
        timeout_seconds=settings.edgar_timeout_seconds,
    )
