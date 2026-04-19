"""
Market data ingest utility tasks — Phase 1 stub.

Full implementation deferred to Phase 2/3. This stub satisfies the Celery
Beat schedule entry in celery_app.py so the worker starts without import errors.

Phase 2 will implement:
  - API quota tracking across all free-tier providers
  - Daily quota consumption report via structured logging
  - Redis counters per provider (coingecko, newsapi, finnhub, fred)

Why stub: same rationale as edgar_ingest.py — preserve Beat schedule entry.
"""

from __future__ import annotations

import logging

from src.celery_app import app
from src.config import settings

logger = logging.getLogger(__name__)


@app.task(
    name="src.tasks.market_data_ingest.report_api_quotas",
    max_retries=settings.celery_lightweight_task_max_retries,
    queue="default",
    bind=True,
)
def report_api_quotas(self: object) -> dict[str, object]:
    """
    Phase 1 stub — full quota reporting implemented in Phase 2.

    Scheduled daily at 14:05 UTC. No-op in Phase 1.
    """
    logger.debug(
        "market_data_ingest.report_api_quotas: Phase 1 stub — no-op. "
        "Full implementation in Phase 2."
    )
    return {"status": "stub", "phase": 1}
