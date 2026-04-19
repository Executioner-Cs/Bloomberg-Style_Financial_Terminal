"""
Celery application and Beat schedule configuration.

Why this exists: Central definition of all scheduled tasks.
Adding a new scheduled task = add entry to CELERY_BEAT_SCHEDULE only.
"""

from __future__ import annotations

from celery import Celery
from celery.schedules import crontab

from src.config import settings

app = Celery(
    "terminal",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

app.config_from_object(
    {
        "task_serializer": "json",
        "result_serializer": "json",
        "accept_content": ["json"],
        "timezone": "UTC",
        "enable_utc": True,
        "task_track_started": True,
        "task_time_limit": settings.celery_task_time_limit,
        "task_soft_time_limit": settings.celery_task_soft_time_limit,
        "worker_prefetch_multiplier": 1,  # Fair task distribution
        "task_acks_late": True,  # Only ack after task completes (safer)
        # Beat schedule — all scheduled ingestion tasks
        "beat_schedule": {
            # CoinGecko OHLCV — daily at 00:05 UTC (after midnight data is available)
            "coingecko-ohlcv-ingest": {
                "task": "src.tasks.ingest_ohlcv_coingecko.ingest_coingecko_ohlcv",
                "schedule": crontab(hour=0, minute=5),
                "options": {"queue": "ingestion"},
            },
            # Seed crypto instruments — daily at 00:00 UTC (runs before OHLCV ingest)
            "coingecko-seed-instruments": {
                "task": "src.tasks.ingest_ohlcv_coingecko.seed_crypto_instruments",
                "schedule": crontab(hour=0, minute=0),
                "options": {"queue": "ingestion"},
            },
            # yfinance equity OHLCV — daily at 21:30 UTC (4:30 PM ET, 30 min after
            # NYSE close). Schedule from settings.yfinance_ingest_hour_utc. ADR-005.
            "yfinance-ohlcv-ingest": {
                "task": "src.tasks.ingest_ohlcv_yfinance.ingest_yfinance_ohlcv",
                "schedule": crontab(
                    hour=str(settings.yfinance_ingest_hour_utc),
                    minute=str(settings.yfinance_ingest_minute_utc),
                ),
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
