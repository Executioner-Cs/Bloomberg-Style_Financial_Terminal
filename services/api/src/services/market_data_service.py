"""
Market data service — OHLCV queries and quote snapshots.

This layer owns the cache-aside pattern:
  1. Check Redis for a cached response
  2. On miss: query the repository
  3. Store result in Redis with TTL from settings
  4. Return the response schema

No database calls live here — only repository calls.
No HTTP calls live here — those belong in the integration client / Celery task.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime

import redis.asyncio as aioredis

from src.cache import keys as cache_keys
from src.config import settings
from src.repositories.ohlcv_repository import OHLCVRepository
from src.schemas.market_data import OHLCVBar, OHLCVResponse, QuoteResponse

logger = logging.getLogger(__name__)


class MarketDataService:
    """
    Business logic for OHLCV data and live quote snapshots.

    Depends on an OHLCVRepository (ClickHouse) and a Redis client.
    Both are injected — no direct DB construction here.
    """

    def __init__(
        self,
        ohlcv_repo: OHLCVRepository,
        redis: aioredis.Redis,
    ) -> None:
        self._repo = ohlcv_repo
        self._redis = redis

    async def get_ohlcv(
        self,
        symbol: str,
        timeframe: str,
        from_date: datetime,
        to_date: datetime,
    ) -> OHLCVResponse:
        """
        Return OHLCV bars for a symbol/timeframe range.

        Cache strategy: keyed by (symbol, timeframe, from_date, to_date).
        TTL from settings.ohlcv_cache_ttl_seconds — respects CoinGecko free
        tier ToS minimum cache window (1 hour default).

        Args:
            symbol: Ticker symbol (e.g. 'BITCOIN').
            timeframe: Candle interval (e.g. '1D').
            from_date: Inclusive start datetime (UTC).
            to_date: Inclusive end datetime (UTC).

        Returns:
            OHLCVResponse with bars ordered oldest-first.
        """
        cache_key = cache_keys.ohlcv(
            symbol,
            timeframe,
            from_date.date().isoformat(),
            to_date.date().isoformat(),
        )

        cached = await self._redis.get(cache_key)
        if cached is not None:
            return OHLCVResponse.model_validate_json(cached)

        rows = await self._repo.get_bars(symbol, timeframe, from_date, to_date)
        source = rows[0].source if rows else "unknown"
        bars = [
            OHLCVBar(
                ts=row.ts,
                open=row.open,
                high=row.high,
                low=row.low,
                close=row.close,
                volume=row.volume,
                adj_close=row.adj_close,
            )
            for row in rows
        ]
        response = OHLCVResponse(
            symbol=symbol,
            timeframe=timeframe,
            bars=bars,
            source=source,
        )

        await self._redis.setex(
            cache_key,
            settings.ohlcv_cache_ttl_seconds,
            response.model_dump_json(),
        )
        return response

    async def get_quote(self, symbol: str) -> QuoteResponse:
        """
        Return the latest price snapshot for a symbol.

        Cache strategy: keyed by symbol alone.
        TTL from settings.quote_cache_ttl_seconds — short enough to feel
        near-live, conservative enough to avoid CoinGecko rate limits.

        If no data exists yet (pre-ingestion), returns a QuoteResponse
        with price=None rather than raising — the router returns 200 with
        null fields so the frontend can render a loading state gracefully.

        Args:
            symbol: Ticker symbol.

        Returns:
            QuoteResponse with latest price and 24h change.
        """
        cache_key = cache_keys.quote_snapshot(symbol)

        cached = await self._redis.get(cache_key)
        if cached is not None:
            return QuoteResponse.model_validate_json(cached)

        # Cache miss — derive from latest two bars (today and yesterday).
        latest_rows = await self._repo.get_bars(
            symbol=symbol,
            timeframe="1D",
            # Use a wide window to get at least 2 bars for 24h change calculation.
            # The repository returns bars ordered ascending — we want the last two.
            from_date=datetime(2020, 1, 1, tzinfo=UTC),
            to_date=datetime.now(tz=UTC),
        )

        if not latest_rows:
            return QuoteResponse(symbol=symbol, price=None)

        latest = latest_rows[-1]
        prev = latest_rows[-2] if len(latest_rows) >= 2 else None

        change_24h: float | None = None
        if prev is not None and prev.close > 0:
            change_24h = (latest.close - prev.close) / prev.close

        response = QuoteResponse(
            symbol=symbol,
            price=latest.close,
            change_24h=change_24h,
            volume_24h=latest.volume,
            ts=latest.ts,
        )

        await self._redis.setex(
            cache_key,
            settings.quote_cache_ttl_seconds,
            response.model_dump_json(),
        )
        return response

    async def get_bulk_quotes(self, symbols: list[str]) -> dict[str, QuoteResponse]:
        """
        Return latest quote snapshots for multiple symbols in one call.

        Calls get_quote per symbol — Redis pipeline would be more efficient
        but this keeps the code simple for Phase 1.
        TODO(#2): Batch Redis reads with pipeline for bulk quote endpoint.

        Args:
            symbols: List of ticker symbols to look up.

        Returns:
            Dict of symbol → QuoteResponse. Symbols with errors are omitted.
        """
        results: dict[str, QuoteResponse] = {}
        for symbol in symbols:
            try:
                results[symbol] = await self.get_quote(symbol)
            except Exception:
                logger.exception("Failed to fetch quote for %s", symbol)
        return results
