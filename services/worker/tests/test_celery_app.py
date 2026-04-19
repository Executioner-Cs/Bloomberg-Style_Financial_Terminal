"""
Tests for Celery application configuration.

Validates that the app is correctly named, serializers are set to JSON,
and the Beat schedule contains all required ingestion tasks.
"""

from __future__ import annotations

from src.celery_app import app


def test_celery_app_name() -> None:
    """App must be named 'terminal' — used as the Celery worker namespace."""
    assert app.main == "terminal"


def test_celery_serializers_are_json() -> None:
    """All serializers must be JSON — binary formats are not allowed."""
    assert app.conf.task_serializer == "json"
    assert app.conf.result_serializer == "json"
    assert "json" in app.conf.accept_content


def test_celery_timezone_is_utc() -> None:
    """Timezone must be UTC to avoid DST-related schedule drift."""
    assert app.conf.timezone == "UTC"
    assert app.conf.enable_utc is True


def test_beat_schedule_contains_required_tasks() -> None:
    """Beat schedule must define all data ingestion and alert tasks."""
    schedule = app.conf.beat_schedule
    required = {
        "coingecko-ohlcv-ingest",
        "coingecko-seed-instruments",
        "edgar-filing-check",
        "fred-macro-refresh",
        "news-refresh",
        "alert-evaluation",
        "api-quota-report",
    }
    missing = required - set(schedule.keys())
    assert not missing, f"Missing Beat tasks: {missing}"


def test_beat_schedule_tasks_have_queues() -> None:
    """Every Beat task must declare an explicit queue — no default queue leakage."""
    schedule = app.conf.beat_schedule
    for task_name, task_config in schedule.items():
        assert "options" in task_config, f"{task_name} missing 'options'"
        assert (
            "queue" in task_config["options"]
        ), f"{task_name} missing queue in options"


def test_fred_macro_refresh_schedule_is_settings_driven() -> None:
    """
    FRED Beat entry must be weekly (day_of_week set) and match the
    fred_ingest_* settings fields — no hardcoded crontab literals.
    """
    from src.config import settings

    entry = app.conf.beat_schedule["fred-macro-refresh"]
    cron = entry["schedule"]
    # crontab normalises to sets of ints; day_of_week="1" → {1} (Monday only).
    assert cron.day_of_week == {
        int(settings.fred_ingest_day_of_week)
    }, "fred-macro-refresh must run on the configured day_of_week only"
    assert cron.hour == {settings.fred_ingest_hour_utc}
    assert cron.minute == {settings.fred_ingest_minute_utc}
