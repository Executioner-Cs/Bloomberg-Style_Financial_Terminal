"""
Filings router — EDGAR filings for a ticker symbol.

Contract: routers call services only. No HTTP calls to EDGAR here.
Dependency injection: service is built from the EDGARClient + Redis per
request, mirroring the pattern in routers/market_data.py.
"""

from __future__ import annotations

from typing import Annotated

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, Path, Query

from src.db.redis import get_redis
from src.schemas.filings import SUPPORTED_FORM_TYPES, FilingsResponse
from src.services.filings_service import FilingsService, build_edgar_client
from src.services.macro_service import build_mock_loader

router = APIRouter(prefix="/filings")

# Symbol validation pattern — same shape as routers/market_data.py.
_SYMBOL_PATTERN = r"^[A-Za-z0-9./\-]{1,20}$"


def _build_service(
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
) -> FilingsService:
    """Construct FilingsService with injected dependencies."""
    return FilingsService(
        redis=redis,
        client=build_edgar_client(),
        mock_loader=build_mock_loader(),
    )


@router.get(
    "/{symbol}",
    summary="Get filings for a symbol",
    description=(
        "Returns recent SEC EDGAR filings (10-K, 10-Q, 8-K) for a ticker "
        "symbol. Responses are cached in Redis for 24 hours because filings "
        "are published quarterly and do not change intraday (ADR-005)."
    ),
    response_model=FilingsResponse,
)
async def get_filings(
    service: Annotated[FilingsService, Depends(_build_service)],
    symbol: Annotated[
        str,
        Path(description="Ticker symbol, e.g. 'AAPL'.", pattern=_SYMBOL_PATTERN),
    ],
    form_type: str | None = Query(
        default=None,
        description="Filter by form type. One of: '10-K', '10-Q', '8-K'.",
    ),
    limit: int = Query(
        default=10,
        ge=1,
        le=10,
        description="Maximum filings to return. EDGAR caps at 10 per page.",
    ),
) -> FilingsResponse:
    if form_type is not None and form_type not in SUPPORTED_FORM_TYPES:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Unsupported form_type {form_type!r}. "
                f"Supported: {sorted(SUPPORTED_FORM_TYPES)}."
            ),
        )

    return await service.get_filings(
        symbol=symbol.upper(),
        form_type=form_type,
        limit=limit,
    )
