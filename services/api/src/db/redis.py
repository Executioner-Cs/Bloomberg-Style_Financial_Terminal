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

import redis.asyncio as aioredis

from src.config import settings

# Module-level client — one connection pool shared across requests.
# Lazily initialized on first call so tests can override settings first.
_client: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    """
    FastAPI dependency that returns the shared async Redis client.

    The client manages its own connection pool internally.
    Lazily initialized on first request.

    Usage in a service:
        async def my_service(redis: aioredis.Redis = Depends(get_redis)):
            ...
    """
    global _client
    if _client is None:
        _client = aioredis.from_url(  # type: ignore[no-untyped-call]
            settings.redis_url,
            decode_responses=True,
        )
    return _client
