"""
News ingestion Celery task — Phase 1 stub.

Full implementation deferred to Phase 2 (news panel). This stub satisfies
the Celery Beat schedule entry in celery_app.py so the worker starts without
import errors.

Phase 2 will implement:
  - NewsAPI top-headlines fetch (100 req/day free tier)
  - Per-symbol news fetch for tracked instruments
  - Redis cache with settings.news_cache_ttl_seconds TTL
  - PostgreSQL articles table for persistent storage

Why stub: same rationale as edgar_ingest.py — preserve Beat schedule entry.
"""

from __future__ import annotations

import logging

from src.celery_app import app
from src.config import settings

logger = logging.getLogger(__name__)


@app.task(
    name="src.tasks.news_ingest.refresh_news",
    max_retries=settings.celery_task_max_retries,
    queue="ingestion",
    bind=True,
)
def refresh_news(self: object) -> dict[str, object]:
    """
    Phase 1 stub — full news ingestion implemented in Phase 2.

    Logs a debug message so the Beat schedule remains active and the task
    shows as registered in Celery's task registry.
    """
    logger.debug(
        "news_ingest.refresh_news: Phase 1 stub — no-op. "
        "Full implementation in Phase 2."
    )
    return {"status": "stub", "phase": 1}
