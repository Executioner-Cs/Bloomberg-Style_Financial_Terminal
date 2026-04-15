"""
Market data router — OHLCV bars and latest quotes.

Contract: routers call services only. No DB queries here.
Dependency injection: service is built from repository + Redis per request.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

import redis.asyncio as aioredis
from clickhouse_connect.driver.asyncclient import AsyncClient
from fastapi import APIRouter, Depends, HTTPException, Path, Query

from src.config import settings
from src.db.clickhouse import get_clickhouse_client
from src.db.redis import get_redis
from src.repositories.ohlcv_repository import OHLCVRepository
from src.schemas.market_data import BulkQuotesResponse, OHLCVResponse, QuoteResponse
from src.services.market_data_service import MarketDataService

router = APIRouter(prefix="/market-data")

# Default date range: 1 year of history when not specified.
_DEFAULT_DAYS_BACK = 365

# Symbol validation pattern — alphanumeric plus common exchange suffixes (./-)
# Max 20 chars covers all crypto and equity ticker formats.
_SYMBOL_PATTERN = r"^[A-Za-z0-9./\-]{1,20}$"


def _build_service(
    ch: Annotated[AsyncClient, Depends(get_clickhouse_client)],
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
) -> MarketDataService:
    """Construct MarketDataService with injected dependencies."""
    return MarketDataService(
        ohlcv_repo=OHLCVRepository(ch),
        redis=redis,
    )


@router.get(
    "/{symbol}/ohlcv",
    summary="Get OHLCV bars",
    description="Returns OHLCV candlestick data for a symbol and timeframe.",
)
async def get_ohlcv(
    service: Annotated[MarketDataService, Depends(_build_service)],
    symbol: Annotated[
        str,
        Path(
            description="Ticker symbol, e.g. 'bitcoin'.",
            pattern=_SYMBOL_PATTERN,
        ),
    ],
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
) -> OHLCVResponse:
    now = datetime.now(tz=UTC)

    try:
        parsed_from = (
            datetime.fromisoformat(from_date).replace(tzinfo=UTC)
            if from_date
            else datetime(now.year - 1, now.month, now.day, tzinfo=UTC)
        )
        parsed_to = (
            datetime.fromisoformat(to_date).replace(tzinfo=UTC) if to_date else now
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=(
                "Invalid date format. Expected ISO 8601"
                f" (e.g. '2024-01-15T00:00:00'). {exc}"
            ),
        ) from exc

    return await service.get_ohlcv(
        symbol=symbol.upper(),
        timeframe=timeframe,
        from_date=parsed_from,
        to_date=parsed_to,
    )


@router.get(
    "/bulk-quotes",
    summary="Get bulk latest quotes",
    description="Returns latest price snapshots for multiple symbols.",
)
async def get_bulk_quotes(
    service: Annotated[MarketDataService, Depends(_build_service)],
    symbols: list[str] = Query(description="List of symbols"),
) -> BulkQuotesResponse:
    if len(symbols) > settings.bulk_quotes_max_symbols:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Too many symbols: {len(symbols)} requested, "
                f"maximum is {settings.bulk_quotes_max_symbols}."
            ),
        )
    quotes = await service.get_bulk_quotes([s.upper() for s in symbols])
    return BulkQuotesResponse(quotes=quotes)


@router.get(
    "/{symbol}/quote",
    summary="Get latest quote",
    description="Returns the latest price snapshot from Redis cache.",
)
async def get_quote(
    service: Annotated[MarketDataService, Depends(_build_service)],
    symbol: Annotated[
        str,
        Path(
            description="Ticker symbol, e.g. 'bitcoin'.",
            pattern=_SYMBOL_PATTERN,
        ),
    ],
) -> QuoteResponse:
    return await service.get_quote(symbol.upper())
