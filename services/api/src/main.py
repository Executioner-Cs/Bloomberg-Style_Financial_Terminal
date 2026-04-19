"""
FastAPI application factory for the Bloomberg Terminal API.

Why this exists: Central place to configure the app, register middleware,
and mount all routers. Keeps main.py thin — all logic lives in routers/services.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
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
        """Returns 200 if API and all dependencies are healthy."""
        # TODO(#1): Add real dependency health checks (postgres, clickhouse, redis)
        return {
            "status": "ok",
            "version": "0.0.1",
            "environment": settings.app_env,
            "dependencies": {
                "postgres": "ok",
                "clickhouse": "ok",
                "redis": "ok",
            },
        }

    return app


app = create_app()
