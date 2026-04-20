"""
News router — top headlines and symbol-specific feeds.

Contract: routers call services only. No HTTP calls to providers here.
Dependency injection: service is built from the NewsAPIClient + Redis
per request, mirroring the pattern in routers/market_data.py.
"""

from __future__ import annotations

from typing import Annotated

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, Path, Query

from src.db.redis import get_redis
from src.schemas.news import NewsResponse
from src.services.macro_service import build_mock_loader
from src.services.news_service import NewsService, build_news_client

router = APIRouter(prefix="/news")

# Symbol validation pattern — alphanumeric plus common exchange suffixes.
# Matches the validation used by routers/market_data.py.
_SYMBOL_PATTERN = r"^[A-Za-z0-9./\-]{1,20}$"


def _build_service(
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
) -> NewsService:
    """Construct NewsService with injected dependencies."""
    return NewsService(
        redis=redis,
        client=build_news_client(),
        mock_loader=build_mock_loader(),
    )


@router.get(
    "",
    summary="List news articles",
    description=(
        "Returns general business headlines, or a free-form query-filtered "
        "feed. Respects the NewsAPI 100 req/day budget via a 5-minute "
        "Redis TTL keyed on (query, page)."
    ),
    response_model=NewsResponse,
)
async def list_news(
    service: Annotated[NewsService, Depends(_build_service)],
    q: str | None = Query(
        default=None,
        description="Optional free-form query, e.g. 'inflation' or 'AI chips'.",
        min_length=1,
        max_length=100,
        # Restrict to safe characters — word chars, spaces, hyphens, dots.
        # Prevents injection of shell metacharacters or URL-breaking sequences
        # through the query string before it reaches the NewsAPI upstream.
        pattern=r"^[\w\s\-\.]+$",
    ),
    page: int = Query(default=1, ge=1, le=20, description="1-indexed page number."),
    page_size: int = Query(
        default=20, ge=1, le=100, description="Articles per page (max 100)."
    ),
) -> NewsResponse:
    return await service.get_top_headlines(query=q, page=page, page_size=page_size)


@router.get(
    "/{symbol}",
    summary="Get news articles for a symbol",
    description="Returns news articles relevant to a specific ticker symbol.",
    response_model=NewsResponse,
)
async def get_symbol_news(
    service: Annotated[NewsService, Depends(_build_service)],
    symbol: Annotated[
        str,
        Path(description="Ticker symbol, e.g. 'AAPL'.", pattern=_SYMBOL_PATTERN),
    ],
    page: int = Query(default=1, ge=1, le=20),
    page_size: int = Query(default=20, ge=1, le=100),
) -> NewsResponse:
    return await service.get_symbol_news(
        symbol=symbol.upper(), page=page, page_size=page_size
    )
