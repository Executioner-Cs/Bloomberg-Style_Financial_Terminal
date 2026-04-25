"""
Redis async client factory.

Why redis[hiredis]: hiredis is a C extension that parses Redis protocol
~10x faster than the pure-Python parser — worthwhile for high-frequency
quote snapshot reads on the hot path.

Connection URL comes from settings.redis_url (db 0). Celery broker and
result backend use separate Redis databases (db 1, db 2) — those are
configured in the worker service, not here.
"""

from __future__ import annotations

from collections.abc import Awaitable
from typing import cast

import redis.asyncio as aioredis

from src.config import settings

# Module-level client — one connection pool shared across requests.
# Lazily initialized on first call so tests can override settings first.
_client: aioredis.Redis | None = None


async def ping_redis() -> str:
    """
    Verify Redis connectivity by sending the PING command.

    Returns "ok" on success or "error: <detail>" on failure.
    Uses the shared client from get_redis() — not a separate connection.
    Used by the /health endpoint to report real dependency status.
    """
    try:
        client = get_redis()
        # redis-py 5.x stubs declare ping() as `Awaitable[bool] | bool` because
        # the same Redis class is reused in pipeline mode (where commands are
        # queued synchronously and return T directly). In our non-pipeline async
        # client the return is always a coroutine — narrow with cast so mypy
        # --strict accepts the await without a module-wide error suppression.
        await cast("Awaitable[bool]", client.ping())
        return "ok"
    except Exception as exc:
        # Health probe must not raise; callers inspect the returned string.
        return f"error: {exc}"


def get_redis() -> aioredis.Redis:
    """
    FastAPI dependency that returns the shared async Redis client.

    The client manages its own connection pool internally.
    Lazily initialized on first request. No network I/O happens here —
    connections are established on first use by the Redis client.

    Usage in a service:
        async def my_service(redis: aioredis.Redis = Depends(get_redis)):
            ...
    """
    global _client
    if _client is None:
        # Use the typed classmethod (Redis.from_url) instead of the
        # module-level alias (redis.asyncio.from_url) — the module alias
        # is unannotated and trips mypy's no-untyped-call under --strict.
        _client = aioredis.Redis.from_url(
            settings.redis_url,
            decode_responses=True,
        )
    return _client
