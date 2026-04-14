"""
Instruments router — search and fetch tradeable securities.

Contract: routers call services only. No DB queries here.
Dependency injection: service is built from repository + Redis per request.
"""

from __future__ import annotations

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.postgres import get_async_session
from src.db.redis import get_redis
from src.repositories.instrument_repository import InstrumentRepository
from src.schemas.instruments import InstrumentListResponse, InstrumentResponse
from src.services.instrument_service import InstrumentService

router = APIRouter(prefix="/instruments")


def _build_service(
    session: AsyncSession = Depends(get_async_session),
    redis: aioredis.Redis = Depends(get_redis),
) -> InstrumentService:
    """Construct InstrumentService with injected dependencies."""
    return InstrumentService(
        repo=InstrumentRepository(session),
        redis=redis,
    )


@router.get(
    "",
    response_model=InstrumentListResponse,
    summary="List or search instruments",
    description=(
        "Returns a paginated list of instruments. "
        "Filter by asset_class or search by symbol/name."
    ),
)
async def list_instruments(
    asset_class: str | None = Query(default=None, description="Filter by asset class"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    service: InstrumentService = Depends(_build_service),
) -> InstrumentListResponse:
    return await service.list_instruments(
        asset_class=asset_class,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/{symbol}",
    response_model=InstrumentResponse,
    summary="Get instrument details",
    description="Returns full instrument details by symbol.",
)
async def get_instrument(
    symbol: str,
    service: InstrumentService = Depends(_build_service),
) -> InstrumentResponse:
    result = await service.get_instrument(symbol.upper())
    if result is None:
        raise HTTPException(status_code=404, detail=f"Instrument {symbol!r} not found.")
    return result
