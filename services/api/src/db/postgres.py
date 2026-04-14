"""
PostgreSQL async engine and session factory.

Why asyncpg: FastAPI routes are async. asyncpg is the fastest async PostgreSQL
driver available for Python. SQLAlchemy's async layer wraps it cleanly.

Connection pool sizing comes from settings (database_pool_size, database_max_overflow)
— never hardcoded — so it can be tuned per environment without code changes.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from src.config import settings

# Engine is module-level — one pool shared across all requests.
# pool_pre_ping=True: validates connections before use, handles DB restarts gracefully.
_engine = create_async_engine(
    settings.database_url,
    pool_size=settings.database_pool_size,
    max_overflow=settings.database_max_overflow,
    pool_pre_ping=True,
    echo=settings.app_env == "development",
)

_AsyncSessionLocal = async_sessionmaker(
    bind=_engine,
    expire_on_commit=False,
    autoflush=False,
)


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that yields a database session per request.

    Usage in a router:
        async def my_endpoint(session: AsyncSession = Depends(get_async_session)):
            ...
    """
    async with _AsyncSessionLocal() as session:
        yield session
