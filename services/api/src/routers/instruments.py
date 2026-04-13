"""
Instruments router — search and fetch tradeable securities.

Contract: routers call services only. No DB queries here.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query

router = APIRouter(prefix="/instruments")


@router.get(
    "",
    summary="List or search instruments",
    description="Returns a paginated list of instruments. Filter by asset_class or search by symbol/name.",
)
async def list_instruments(
    q: str | None = Query(default=None, description="Search query: symbol or company name"),
    asset_class: str | None = Query(default=None, description="Filter by asset class"),
    exchange: str | None = Query(default=None, description="Filter by exchange code"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> dict[str, object]:
    # TODO(#2): Wire up instrument_service
    return {"instruments": [], "total": 0, "limit": limit, "offset": offset}


@router.get(
    "/{symbol}",
    summary="Get instrument details",
    description="Returns full instrument details by symbol.",
)
async def get_instrument(symbol: str) -> dict[str, object]:
    # TODO(#2): Wire up instrument_service
    return {"symbol": symbol}
