"""
Celery application and Beat schedule configuration.

Why this exists: Central definition of all scheduled tasks.
Adding a new scheduled task = add entry to CELERY_BEAT_SCHEDULE only.
"""
from __future__ import annotations

import os

from celery import Celery
from celery.schedules import crontab

broker_url = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/1")
result_backend = os.environ.get("CELERY_RESULT_BACKEND", "redis://localhost:6379/2")

app = Celery("terminal", broker=broker_url, backend=result_backend)

app.config_from_object(
    {
        "task_serializer": "json",
        "result_serializer": "json",
        "accept_content": ["json"],
        "timezone": "UTC",
        "enable_utc": True,
        "task_track_started": True,
        "task_time_limit": int(os.environ.get("CELERY_TASK_TIME_LIMIT", "300")),
        "task_soft_time_limit": int(os.environ.get("CELERY_TASK_SOFT_TIME_LIMIT", "240")),
        "worker_prefetch_multiplier": 1,  # Fair task distribution
        "task_acks_late": True,  # Only ack after task completes (safer)
        # Beat schedule — all scheduled ingestion tasks
        "beat_schedule": {
            # EOD price ingestion — weekdays at 17:00 ET (22:00 UTC)
            "market-data-eod-ingest": {
                "task": "src.tasks.market_data_ingest.ingest_eod_prices",
                "schedule": crontab(hour=22, minute=0, day_of_week="1-5"),
                "options": {"queue": "ingestion"},
            },
            # EDGAR filing check — daily at 08:00 ET (13:00 UTC)
            "edgar-filing-check": {
                "task": "src.tasks.edgar_ingest.check_new_filings",
                "schedule": crontab(hour=13, minute=0),
                "options": {"queue": "ingestion"},
            },
            # FRED macro data — daily at 09:00 ET (14:00 UTC)
            "fred-macro-refresh": {
                "task": "src.tasks.fred_ingest.refresh_macro_series",
                "schedule": crontab(hour=14, minute=0),
                "options": {"queue": "ingestion"},
            },
            # News ingestion — every 15 minutes
            "news-refresh": {
                "task": "src.tasks.news_ingest.refresh_news",
                "schedule": crontab(minute="*/15"),
                "options": {"queue": "ingestion"},
            },
            # Alert evaluation — every minute
            "alert-evaluation": {
                "task": "src.tasks.alert_evaluator.evaluate_alerts",
                "schedule": crontab(minute="*"),
                "options": {"queue": "alerts"},
            },
            # API quota report — daily at 09:00 ET
            "api-quota-report": {
                "task": "src.tasks.market_data_ingest.report_api_quotas",
                "schedule": crontab(hour=14, minute=5),
                "options": {"queue": "default"},
            },
        },
    }
)

# Auto-discover tasks in the tasks/ subdirectory
app.autodiscover_tasks(["src.tasks"])
