"""
FastAPI application factory for the Bloomberg Terminal API.

Why this exists: Central place to configure the app, register middleware,
and mount all routers. Keeps main.py thin — all logic lives in routers/services.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db.clickhouse import ping_clickhouse
from .db.postgres import ping_postgres
from .db.redis import ping_redis
from .middleware.request_id import RequestIDMiddleware
from .routers import (
    alerts,
    filings,
    fundamentals,
    instruments,
    macro,
    market_data,
    news,
    portfolios,
    screener,
    search,
    users,
    watchlists,
)

logger = logging.getLogger(__name__)

# Maximum time in seconds to wait for each dependency health check.
# Short enough to avoid blocking the load balancer probe; long enough for a
# momentarily slow DB to respond. ADR-005 rationale: conservative ceiling.
_HEALTH_CHECK_TIMEOUT_SECONDS = 2.0


async def _bounded_ping(ping_fn: Awaitable[str]) -> str:
    """
    Run a DB ping coroutine with a hard _HEALTH_CHECK_TIMEOUT_SECONDS ceiling.

    Accepts the awaitable returned by a ping_*() coroutine function (resolves
    to a status string). Returns "error: timed out after Xs" if the dependency
    does not respond within the allowed window.
    """
    try:
        return await asyncio.wait_for(ping_fn, _HEALTH_CHECK_TIMEOUT_SECONDS)
    except TimeoutError:
        return f"error: timed out after {_HEALTH_CHECK_TIMEOUT_SECONDS}s"


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="Bloomberg Terminal API",
        description="Financial data API for the Bloomberg-style terminal",
        version="0.0.1",
        docs_url="/api/docs" if settings.app_env != "production" else None,
        redoc_url="/api/redoc" if settings.app_env != "production" else None,
        openapi_url="/api/openapi.json" if settings.app_env != "production" else None,
    )

    # Middleware (order matters — outermost applied last)
    app.add_middleware(RequestIDMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    )

    # Routers — all mounted under /api/v1/
    prefix = "/api/v1"
    app.include_router(instruments.router, prefix=prefix, tags=["instruments"])
    app.include_router(market_data.router, prefix=prefix, tags=["market-data"])
    app.include_router(fundamentals.router, prefix=prefix, tags=["fundamentals"])
    app.include_router(filings.router, prefix=prefix, tags=["filings"])
    app.include_router(news.router, prefix=prefix, tags=["news"])
    app.include_router(screener.router, prefix=prefix, tags=["screener"])
    app.include_router(watchlists.router, prefix=prefix, tags=["watchlists"])
    app.include_router(portfolios.router, prefix=prefix, tags=["portfolios"])
    app.include_router(alerts.router, prefix=prefix, tags=["alerts"])
    app.include_router(macro.router, prefix=prefix, tags=["macro"])
    app.include_router(search.router, prefix=prefix, tags=["search"])
    app.include_router(users.router, prefix=prefix, tags=["users"])

    @app.get("/health", tags=["health"], summary="Health check for all dependencies")
    async def health() -> dict[str, object]:
        """
        Probe all infrastructure dependencies and return their real status.

        All three checks run concurrently (asyncio.gather) so the total latency
        is bounded by the slowest dependency, not the sum of all three.
        Each check has a _HEALTH_CHECK_TIMEOUT_SECONDS ceiling so a hung
        dependency cannot block the load balancer probe indefinitely.

        Returns HTTP 200 with status "ok" when all dependencies respond.
        Returns HTTP 200 with status "degraded" when any dependency fails —
        the load balancer must read the body to determine liveness.
        """
        postgres_status, clickhouse_status, redis_status = await asyncio.gather(
            _bounded_ping(ping_postgres()),
            _bounded_ping(ping_clickhouse()),
            _bounded_ping(ping_redis()),
        )

        all_ok = all(
            s == "ok" for s in (postgres_status, clickhouse_status, redis_status)
        )

        return {
            "status": "ok" if all_ok else "degraded",
            "version": "0.0.1",
            "environment": settings.app_env,
            "dependencies": {
                "postgres": postgres_status,
                "clickhouse": clickhouse_status,
                "redis": redis_status,
            },
        }

    return app


app = create_app()
