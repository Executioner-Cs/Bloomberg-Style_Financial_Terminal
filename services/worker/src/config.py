"""
Worker service configuration via pydantic-settings.

Separate from the API config — the worker is a distinct Python package.
CLAUDE.md prohibits cross-package imports between services.

Only fields used by the worker are declared here. Any value that controls
worker behaviour must be sourced from this module, never from os.environ
directly.
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class WorkerSettings(BaseSettings):
    """Environment variables for the Celery worker."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_env: str = "development"

    # Celery broker and backend — separate Redis DBs to isolate task traffic.
    # DB 1: broker (task queue), DB 2: results backend.
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"
    # DB 0: cache (shared with API service for quote snapshots).
    redis_url: str = "redis://localhost:6379/0"

    # Task time limits sourced from env — never hardcoded in task decorators.
    celery_task_time_limit: int = 300
    celery_task_soft_time_limit: int = 240

    # ClickHouse — worker writes OHLCV rows via HTTP interface (port 8123).
    clickhouse_host: str = "localhost"
    clickhouse_http_port: int = 8123
    clickhouse_database: str = "terminal"
    clickhouse_user: str = "default"
    clickhouse_password: str = ""

    # PostgreSQL — worker upserts instrument rows.
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/terminal"

    # CoinGecko integration — base URL overridable so tests can use a mock server.
    coingecko_base_url: str = "https://api.coingecko.com/api/v3"
    # Timeout: 15s leaves margin over CoinGecko's typical ~2s response time.
    coingecko_timeout_seconds: float = 15.0
    # Top-N coins by market cap to ingest. Default 50 covers all major assets.
    coingecko_top_n_coins: int = 50
    # CoinGecko /coins/markets page size hard limit — defined by their API spec.
    coingecko_markets_per_page_max: int = 250
    # Rate limits sourced from env — never hardcoded.
    coingecko_requests_per_minute: int = 30


# Singleton — import this everywhere in the worker.
settings = WorkerSettings()
