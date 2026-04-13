"""
Market data router — OHLCV bars and latest quotes.

Contract: routers call services only. No DB queries here.
"""

from __future__ import annotations

from fastapi import APIRouter, Query

router = APIRouter(prefix="/market-data")


@router.get(
    "/{symbol}/ohlcv",
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
        description="Start date (ISO 8601)",
    ),
    to_date: str | None = Query(
        default=None,
        alias="to",
        description="End date (ISO 8601)",
    ),
) -> dict[str, object]:
    # TODO(#3): Wire up market_data_service
    return {"symbol": symbol, "timeframe": timeframe, "bars": []}


@router.get(
    "/{symbol}/quote",
    summary="Get latest quote",
    description="Returns the latest price snapshot from Redis cache.",
)
async def get_quote(symbol: str) -> dict[str, object]:
    # TODO(#3): Wire up market_data_service
    return {"symbol": symbol, "price": None}


@router.get(
    "/bulk-quotes",
    summary="Get bulk latest quotes",
    description="Returns latest price snapshots for multiple symbols.",
)
async def get_bulk_quotes(
    symbols: list[str] = Query(description="List of symbols"),
) -> dict[str, object]:
    # TODO(#3): Wire up market_data_service
    return {"quotes": {}}
