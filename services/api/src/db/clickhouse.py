"""
ClickHouse HTTP client factory.

Why clickhouse-connect (HTTP) over clickhouse-driver (native TCP):
clickhouse-connect uses the HTTP interface (port 8123) which is async-compatible
via httpx. clickhouse-driver uses native TCP (port 9000) with a synchronous
blocking protocol — using it in async FastAPI routes would block the event loop.

The HTTP interface has marginally higher per-query overhead than native TCP,
but for our query patterns (large column scans, not high-frequency tiny queries)
the difference is negligible. Async compatibility is the deciding factor.

Both ports are registered in the CLAUDE.md port registry.
"""

from __future__ import annotations

import clickhouse_connect
from clickhouse_connect.driver.asyncclient import AsyncClient

from src.config import settings

# Module-level client — reused across requests (connection pooling handled internally).
# Initialized lazily on first call to avoid blocking at import time.
_client: AsyncClient | None = None


async def ping_clickhouse() -> str:
    """
    Verify ClickHouse connectivity by executing SELECT 1.

    Returns "ok" on success or "error: <detail>" on failure.
    Used by the /health endpoint to report real dependency status.
    """
    try:
        client = await get_clickhouse_client()
        await client.query("SELECT 1")
        return "ok"
    except Exception as exc:  # noqa: BLE001 — health probe must not raise; callers check the string
        return f"error: {exc}"


async def get_clickhouse_client() -> AsyncClient:
    """
    FastAPI dependency that returns the shared ClickHouse async client.

    The client manages its own connection pool internally.
    Lazily initialized on first request so tests can override settings
    before the client is created.

    Usage in a repository:
        async def my_query(ch: AsyncClient = Depends(get_clickhouse_client)):
            ...
    """
    global _client
    if _client is None:
        _client = await clickhouse_connect.get_async_client(
            host=settings.clickhouse_host,
            port=settings.clickhouse_http_port,
            database=settings.clickhouse_database,
            username=settings.clickhouse_user,
            password=settings.clickhouse_password,
        )
    return _client
