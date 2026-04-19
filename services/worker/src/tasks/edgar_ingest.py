"""
EDGAR filings ingestion Celery task — Phase 1 stub.

Full implementation deferred to Phase 2 (SEC filings panel). This stub
satisfies the Celery Beat schedule entry in celery_app.py so the worker
starts without import errors.

Phase 2 will implement:
  - Ticker → CIK lookup via EDGAR company_tickers.json
  - Filing metadata fetch via data.sec.gov/submissions/{CIK}.json
  - Persistent storage in PostgreSQL filings table
  - Redis cache of latest filing per symbol

Why stub instead of removing the Beat entry: the celery_app.py Beat schedule
is the canonical task registry. Removing an entry mid-phase would lose the
schedule configuration and require manual re-addition in Phase 2.
"""

from __future__ import annotations

import logging

from src.celery_app import app
from src.config import settings

logger = logging.getLogger(__name__)


@app.task(
    name="src.tasks.edgar_ingest.check_new_filings",
    max_retries=settings.celery_task_max_retries,
    queue="ingestion",
    bind=True,
)
def check_new_filings(self: object) -> dict[str, object]:
    """
    Phase 1 stub — full EDGAR ingestion implemented in Phase 2.

    Logs a debug message so the Beat schedule remains active and the task
    shows as registered in Celery's task registry.
    """
    logger.debug(
        "edgar_ingest.check_new_filings: Phase 1 stub — no-op. "
        "Full implementation in Phase 2."
    )
    return {"status": "stub", "phase": 1}
