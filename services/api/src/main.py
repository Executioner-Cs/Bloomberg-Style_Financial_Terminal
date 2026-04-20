"""
FastAPI application factory for the Bloomberg Terminal API.

Why this exists: Central place to configure the app, register middleware,
and mount all routers. Keeps main.py thin — all logic lives in routers/services.
"""

from __future__ import annotations

import asyncio
import logging

import clickhouse_connect
import redis.asyncio as aioredis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from .config import settings
from .middleware.request_id import RequestIDMiddleware

logger = logging.getLogger(__name__)

# Maximum time in seconds to wait for each dependency health check.
# Short enough to avoid blocking the load balancer probe; long enough for a
# momentarily slow DB to respond. ADR-005 rationale: conservative ceiling.
_HEALTH_CHECK_TIMEOUT_SECONDS = 2.0


async def _check_postgres() -> str:
    """
    Ping PostgreSQL with a SELECT 1 query.

    Returns "ok" on success or "error: <message>" on failure.
    Uses a short-lived engine — not the app's connection pool — so health checks
    do not consume pool connections.
    """
    try:
        engine = create_async_engine(
            settings.database_url,
            pool_size=1,
            max_overflow=0,
            pool_pre_ping=True,
        )
        async with asyncio.timeout(_HEALTH_CHECK_TIMEOUT_SECONDS):
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
        await engine.dispose()
        return "ok"
    except Exception as exc:  # noqa: BLE001 — health endpoint must not crash on any DB error
        return f"error: {exc}"


async def _check_clickhouse() -> str:
    """
    Ping ClickHouse with a SELECT 1 query via the HTTP interface.

    Returns "ok" on success or "error: <message>" on failure.
    """
    try:
        client = await clickhouse_connect.get_async_client(
            host=settings.clickhouse_host,
            port=settings.clickhouse_http_port,
            database=settings.clickhouse_database,
            username=settings.clickhouse_user,
            password=settings.clickhouse_password,
        )
        async with asyncio.timeout(_HEALTH_CHECK_TIMEOUT_SECONDS):
            await client.query("SELECT 1")
        await client.close()
        return "ok"
    except Exception as exc:  # noqa: BLE001 — health endpoint must not crash on any DB error
        return f"error: {exc}"


async def _check_redis() -> str:
    """
    Ping Redis with the PING command.

    Returns "ok" on success or "error: <message>" on failure.
    """
    try:
        redis: aioredis.Redis = aioredis.from_url(  # type: ignore[no-untyped-call]
            settings.redis_url, decode_responses=True
        )
        async with asyncio.timeout(_HEALTH_CHECK_TIMEOUT_SECONDS):
            await redis.ping()
        await redis.aclose()
        return "ok"
    except Exception as exc:  # noqa: BLE001 — health endpoint must not crash on any Redis error
        return f"error: {exc}"
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
            _check_postgres(),
            _check_clickhouse(),
            _check_redis(),
        )

        all_ok = all(
            s == "ok"
            for s in (postgres_status, clickhouse_status, redis_status)
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
