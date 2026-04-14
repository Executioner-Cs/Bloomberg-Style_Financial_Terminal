"""
Market data router — OHLCV bars and latest quotes.

Contract: routers call services only. No DB queries here.
Dependency injection: service is built from repository + Redis per request.
"""

from __future__ import annotations

from datetime import UTC, datetime

import redis.asyncio as aioredis
from clickhouse_connect.driver.asyncclient import AsyncClient
from fastapi import APIRouter, Depends, Query

from src.db.clickhouse import get_clickhouse_client
from src.db.redis import get_redis
from src.repositories.ohlcv_repository import OHLCVRepository
from src.schemas.market_data import BulkQuotesResponse, OHLCVResponse, QuoteResponse
from src.services.market_data_service import MarketDataService

router = APIRouter(prefix="/market-data")

# Default date range: 1 year of history when not specified.
_DEFAULT_DAYS_BACK = 365


def _build_service(
    ch: AsyncClient = Depends(get_clickhouse_client),
    redis: aioredis.Redis = Depends(get_redis),
) -> MarketDataService:
    """Construct MarketDataService with injected dependencies."""
    return MarketDataService(
        ohlcv_repo=OHLCVRepository(ch),
        redis=redis,
    )


@router.get(
    "/{symbol}/ohlcv",
    response_model=OHLCVResponse,
    summary="Get OHLCV bars",
    description="Returns OHLCV candlestick data for a symbol and timeframe.",
)
async def get_ohlcv(
    symbol: str,
    timeframe: str = Query(
        default="1D",
        description="Timeframe: 1m 5m 15m 1H 4H 1D 1W",
    ),
    from_date: str | None = Query(
        default=None,
        alias="from",
        description="Start date (ISO 8601, UTC). Defaults to 1 year ago.",
    ),
    to_date: str | None = Query(
        default=None,
        alias="to",
        description="End date (ISO 8601, UTC). Defaults to today.",
    ),
    service: MarketDataService = Depends(_build_service),
) -> OHLCVResponse:
    now = datetime.now(tz=UTC)
    parsed_from = (
        datetime.fromisoformat(from_date).replace(tzinfo=UTC)
        if from_date
        else datetime(now.year - 1, now.month, now.day, tzinfo=UTC)
    )
    parsed_to = datetime.fromisoformat(to_date).replace(tzinfo=UTC) if to_date else now

    return await service.get_ohlcv(
        symbol=symbol.upper(),
        timeframe=timeframe,
        from_date=parsed_from,
        to_date=parsed_to,
    )


@router.get(
    "/bulk-quotes",
    response_model=BulkQuotesResponse,
    summary="Get bulk latest quotes",
    description="Returns latest price snapshots for multiple symbols.",
)
async def get_bulk_quotes(
    symbols: list[str] = Query(description="List of symbols"),
    service: MarketDataService = Depends(_build_service),
) -> BulkQuotesResponse:
    quotes = await service.get_bulk_quotes([s.upper() for s in symbols])
    return BulkQuotesResponse(quotes=quotes)


@router.get(
    "/{symbol}/quote",
    response_model=QuoteResponse,
    summary="Get latest quote",
    description="Returns the latest price snapshot from Redis cache.",
)
async def get_quote(
    symbol: str,
    service: MarketDataService = Depends(_build_service),
) -> QuoteResponse:
    return await service.get_quote(symbol.upper())
