"""
Alert evaluation Celery task — Phase 1 stub.

Full implementation deferred to Phase 5 (alerts system). This stub satisfies
the Celery Beat schedule entry in celery_app.py so the worker starts without
import errors.

Phase 5 will implement:
  - Per-user price alert evaluation against Redis quote snapshots
  - Threshold crossing detection (above/below)
  - Email and WebSocket notification dispatch
  - Alert state persistence in PostgreSQL

Why stub: same rationale as edgar_ingest.py — preserve Beat schedule entry.
"""

from __future__ import annotations

import logging

from src.celery_app import app
from src.config import settings

logger = logging.getLogger(__name__)


@app.task(
    name="src.tasks.alert_evaluator.evaluate_alerts",
    max_retries=settings.celery_lightweight_task_max_retries,
    queue="alerts",
    bind=True,
)
def evaluate_alerts(self: object) -> dict[str, object]:
    """
    Phase 1 stub — full alert evaluation implemented in Phase 5.

    Runs every minute per Beat schedule. No-op in Phase 1.
    """
    logger.debug(
        "alert_evaluator.evaluate_alerts: Phase 1 stub — no-op. "
        "Full implementation in Phase 5."
    )
    return {"status": "stub", "phase": 1}
