"""
Instrument service — instrument lookup and paginated listing.

Applies the cache-aside pattern for list queries (short TTL, paginated).
Single-instrument lookups are not cached — they are infrequent and the
instruments table is small enough that DB lookups are sub-millisecond.
"""

from __future__ import annotations

import logging

import redis.asyncio as aioredis

from src.cache import keys as cache_keys
from src.config import settings
from src.repositories.instrument_repository import InstrumentRepository
from src.schemas.instruments import InstrumentListResponse, InstrumentResponse

logger = logging.getLogger(__name__)

# Validated asset class values — enforced here so the repo receives only clean input.
_VALID_ASSET_CLASSES = frozenset({"equity", "crypto", "fx", "macro"})


class InstrumentService:
    """
    Business logic for instrument lookups and paginated listing.

    Depends on an InstrumentRepository (PostgreSQL) and a Redis client.
    Both are injected — no direct DB construction here.
    """

    def __init__(
        self,
        repo: InstrumentRepository,
        redis: aioredis.Redis,
    ) -> None:
        self._repo = repo
        self._redis = redis

    async def get_instrument(self, symbol: str) -> InstrumentResponse | None:
        """
        Look up a single instrument by ticker symbol.

        Args:
            symbol: Ticker symbol to look up (case-sensitive).

        Returns:
            InstrumentResponse, or None if the symbol is not in the DB.
        """
        instrument = await self._repo.get_by_symbol(symbol)
        if instrument is None:
            return None
        return InstrumentResponse(
            symbol=instrument.symbol,
            name=instrument.name,
            asset_class=instrument.asset_class,
            exchange=instrument.exchange,
            currency=instrument.currency,
            is_active=instrument.is_active,
        )

    async def list_instruments(
        self,
        asset_class: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> InstrumentListResponse:
        """
        Return a paginated list of instruments, optionally filtered by asset class.

        Cache strategy: keyed by (asset_class, page).
        TTL from settings.ohlcv_cache_ttl_seconds — instrument list changes
        infrequently; 1-hour TTL is safe and matches OHLCV cache TTL.

        Args:
            asset_class: Filter by asset class, or None for all.
            limit: Page size.
            offset: Rows to skip.

        Returns:
            InstrumentListResponse with total count for pagination.
        """
        if asset_class is not None and asset_class not in _VALID_ASSET_CLASSES:
            logger.warning(
                "list_instruments called with unknown asset_class=%r", asset_class
            )

        # Page number for cache key — 0-indexed so page 0 = first page.
        page = offset // limit if limit > 0 else 0
        cache_key = cache_keys.instrument_list(asset_class, page)

        cached = await self._redis.get(cache_key)
        if cached is not None:
            return InstrumentListResponse.model_validate_json(cached)

        instruments, total = await self._repo.list_instruments(
            asset_class=asset_class,
            limit=limit,
            offset=offset,
        )
        response = InstrumentListResponse(
            instruments=[
                InstrumentResponse(
                    symbol=inst.symbol,
                    name=inst.name,
                    asset_class=inst.asset_class,
                    exchange=inst.exchange,
                    currency=inst.currency,
                    is_active=inst.is_active,
                )
                for inst in instruments
            ],
            total=total,
            limit=limit,
            offset=offset,
        )

        await self._redis.setex(
            cache_key,
            settings.ohlcv_cache_ttl_seconds,
            response.model_dump_json(),
        )
        return response
