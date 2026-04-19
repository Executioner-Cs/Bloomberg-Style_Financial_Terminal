"""
Macro router — FRED series metadata and per-series history.

Contract: routers call services only. No DB queries here.
Dependency injection: service is built from repository + Redis per request,
mirroring the pattern in routers/market_data.py.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

import redis.asyncio as aioredis
from clickhouse_connect.driver.asyncclient import AsyncClient
from fastapi import APIRouter, Depends, HTTPException, Path, Query

from src.db.clickhouse import get_clickhouse_client
from src.db.redis import get_redis
from src.repositories.macro_repository import MacroRepository
from src.schemas.macro import MacroSeriesListResponse, MacroSeriesResponse
from src.services.macro_service import MacroService, build_mock_loader

router = APIRouter(prefix="/macro")

# FRED series IDs are uppercase alphanumeric plus underscore. Max 20 chars
# covers every ID in FRED's catalogue (typical length: 3 to 10 chars).
_SERIES_ID_PATTERN = r"^[A-Z0-9_]{1,20}$"


def _build_service(
    ch: Annotated[AsyncClient, Depends(get_clickhouse_client)],
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
) -> MacroService:
    """Construct MacroService with injected dependencies."""
    return MacroService(
        repo=MacroRepository(ch),
        redis=redis,
        mock_loader=build_mock_loader(),
    )


@router.get(
    "",
    summary="List macro series",
    description=(
        "Returns metadata for every macro series the terminal tracks, "
        "including the latest observation snapshot for each."
    ),
    response_model=MacroSeriesListResponse,
)
async def list_macro_series(
    service: Annotated[MacroService, Depends(_build_service)],
) -> MacroSeriesListResponse:
    return await service.list_series()


@router.get(
    "/{series_id}",
    summary="Get macro series history",
    description=(
        "Returns the full observation history for a single FRED macro "
        "series. Defaults to the last 20 years when no date range is given."
    ),
    response_model=MacroSeriesResponse,
)
async def get_macro_series(
    service: Annotated[MacroService, Depends(_build_service)],
    series_id: Annotated[
        str,
        Path(
            description="FRED series identifier, e.g. 'GDP', 'FEDFUNDS'.",
            pattern=_SERIES_ID_PATTERN,
        ),
    ],
    from_date: str | None = Query(
        default=None,
        alias="from",
        description="Start date (ISO 8601, UTC). Defaults to 20 years ago.",
    ),
    to_date: str | None = Query(
        default=None,
        alias="to",
        description="End date (ISO 8601, UTC). Defaults to today.",
    ),
) -> MacroSeriesResponse:
    try:
        parsed_from = (
            datetime.fromisoformat(from_date).replace(tzinfo=UTC)
            if from_date
            else None
        )
        parsed_to = (
            datetime.fromisoformat(to_date).replace(tzinfo=UTC) if to_date else None
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=(
                "Invalid date format. Expected ISO 8601"
                f" (e.g. '2024-01-15T00:00:00'). {exc}"
            ),
        ) from exc

    return await service.get_series(
        series_id=series_id,
        from_date=parsed_from,
        to_date=parsed_to,
    )
