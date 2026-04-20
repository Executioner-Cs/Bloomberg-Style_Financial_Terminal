"""
Worker service configuration via pydantic-settings.

Separate from the API config — the worker is a distinct Python package.
CLAUDE.md prohibits cross-package imports between services.

Only fields used by the worker are declared here. Any value that controls
worker behaviour must be sourced from this module, never from os.environ
directly.
"""

from __future__ import annotations

from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _find_project_root() -> Path:
    """
    Walk up from this file until a directory containing .git/ is found.
    Override with MOCK_DATA_DIR env var for non-standard layouts. ADR-006.
    """
    current = Path(__file__).resolve().parent
    while current != current.parent:
        if (current / ".git").exists():
            return current
        current = current.parent
    return Path(__file__).resolve().parents[3]


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
    # DB 1: broker (task queue), DB 2: results backend. All required; no localhost defaults.
    celery_broker_url: str
    celery_result_backend: str
    # DB 0: cache (shared with API service for quote snapshots). Required.
    redis_url: str

    # Task time limits sourced from env — never hardcoded in task decorators.
    celery_task_time_limit: int = 300
    celery_task_soft_time_limit: int = 240
    # Retry counts for Celery tasks — sourced from settings, never hardcoded.
    # Ingestion tasks (FRED, yfinance, CoinGecko, EDGAR, news): 3 retries.
    # Lightweight tasks (alert evaluator, quota report): 1 retry.
    celery_task_max_retries: int = Field(
        default=3,
        description="Max retries for ingestion Celery tasks (FRED, yfinance, CoinGecko, EDGAR, news).",
    )
    celery_lightweight_task_max_retries: int = Field(
        default=1,
        description="Max retries for lightweight Celery tasks (alert evaluator, quota report).",
    )

    # ClickHouse — worker writes OHLCV rows via HTTP interface (port 8123).
    clickhouse_host: str = "localhost"
    clickhouse_http_port: int = 8123
    clickhouse_database: str = "terminal"
    clickhouse_user: str = "default"
    clickhouse_password: str = ""

    # PostgreSQL — worker upserts instrument rows. Required; no default to prevent
    # accidental connection to a dev DB in production or committing credentials.
    database_url: str

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

    # ─── Mock data (ADR-006) ─────────────────────────────────────────────────
    use_mock_data: bool = Field(
        default=False,
        # Route all integrations to mock_data/ instead of live APIs. ADR-006.
        description="USE_MOCK_DATA=true skips live API calls. ADR-006.",
    )
    mock_data_dir: str = Field(
        default="",
        # Absolute path to mock_data/ directory. Empty = auto-detect. ADR-006.
        description="Override mock_data/ path. Empty = .git walk auto-detect. ADR-006.",
    )

    # ─── API keys ────────────────────────────────────────────────────────────
    fred_api_key: str = Field(
        default="",
        description="FRED API key. Required for live macro ingestion.",
    )
    newsapi_api_key: str = Field(
        default="",
        description="NewsAPI.org key. 100 req/day free tier. Env var: NEWSAPI_API_KEY.",
    )
    finnhub_api_key: str = Field(
        default="",
        description="Finnhub.io key. 60 req/min free tier.",
    )
    edgar_user_agent: str = Field(
        default="Bloomberg-Terminal/1.0 user@example.com",
        description="User-Agent for EDGAR. REQUIRED by SEC ToS.",
    )

    @field_validator("edgar_user_agent")
    @classmethod
    def edgar_user_agent_must_be_real(cls, v: str) -> str:
        """
        Reject placeholder user-agents before the worker starts.

        SEC ToS requires a real contact email in the User-Agent header for
        EDGAR access. Shipping with 'example.com' would violate the ToS and
        risk IP-level blocking of the entire terminal. Fail loudly at startup
        rather than silently during a task run. Set EDGAR_USER_AGENT to a real
        'Name/Version your@real-email.com' value in production.
        """
        if "example.com" in v:
            raise ValueError(
                "EDGAR_USER_AGENT must contain a real contact email (SEC ToS requirement). "
                "Set EDGAR_USER_AGENT=<AppName>/<Version> <your@email.com> in your .env file."
            )
        return v

    # ─── yfinance (ADR-005) ───────────────────────────────────────────────────
    yfinance_requests_per_minute: int = Field(
        default=60,
        description="Self-imposed yfinance rate limit. ADR-005.",
    )
    yfinance_timeout_seconds: float = Field(
        default=30.0,
        description="yfinance timeout. ADR-005.",
    )
    yfinance_equity_symbols: list[str] = Field(
        default_factory=lambda: [
            "AAPL",
            "MSFT",
            "GOOGL",
            "AMZN",
            "NVDA",
            "META",
            "TSLA",
            "JPM",
            "V",
            "JNJ",
            "PG",
            "UNH",
            "MA",
            "HD",
            "CVX",
            "MRK",
            "ABBV",
            "KO",
            "PEP",
            "WMT",
            "BAC",
            "XOM",
            "LLY",
            "AVGO",
            "COST",
            "DIS",
            "ADBE",
            "NFLX",
            "CRM",
            "AMD",
        ],
        description="Equity symbols to ingest. Phase 1: top 30 S&P constituents.",
    )
    # 21:30 UTC = 4:30 PM ET (30 min after NYSE close).
    yfinance_ingest_hour_utc: int = Field(
        default=21,
        description="Hour (UTC) for daily yfinance ingestion. 21:30 UTC = 4:30 PM ET.",
    )
    yfinance_ingest_minute_utc: int = Field(
        default=30,
        description="Minute for daily yfinance ingestion.",
    )

    # ─── FRED (ADR-005) ───────────────────────────────────────────────────────
    fred_timeout_seconds: float = Field(
        default=30.0,
        description="FRED API timeout. ADR-005.",
    )
    fred_series_ids: list[str] = Field(
        default_factory=lambda: ["GDP", "CPIAUCSL", "FEDFUNDS", "DGS10", "UNRATE"],
        description="FRED series IDs to ingest. Phase 1: 5 core macro series.",
    )
    # Monday 08:00 UTC — macro data releases are typically weekday AM.
    fred_ingest_day_of_week: str = Field(
        default="1",
        description="Day of week for FRED ingestion (1=Monday).",
    )
    fred_ingest_hour_utc: int = Field(
        default=8,
        description="Hour (UTC) for weekly FRED ingestion.",
    )
    fred_ingest_minute_utc: int = Field(
        default=0,
        description="Minute for weekly FRED ingestion.",
    )

    # ─── NewsAPI (ADR-005) ────────────────────────────────────────────────────
    newsapi_timeout_seconds: float = Field(
        default=15.0,
        description="NewsAPI timeout. ADR-005.",
    )
    # 300s (5 min) TTL: 100 req/day budget.
    news_cache_ttl_seconds: int = Field(
        default=300,
        description="News cache TTL. 300s respects NewsAPI 100 req/day. ADR-005.",
    )

    # ─── Finnhub (ADR-005) ────────────────────────────────────────────────────
    finnhub_timeout_seconds: float = Field(
        default=15.0,
        description="Finnhub timeout. ADR-005.",
    )

    # ─── HTTP client identity ─────────────────────────────────────────────────
    # Sent as User-Agent in Finnhub and NewsAPI requests.
    # EDGAR uses edgar_user_agent separately (SEC ToS mandates its own format).
    app_user_agent: str = Field(
        default="Bloomberg-Terminal/1.0 contact@example.com",
        description="User-Agent for Finnhub and NewsAPI HTTP requests. Replace contact email before production.",
    )

    # ─── EDGAR (ADR-005) ──────────────────────────────────────────────────────
    edgar_timeout_seconds: float = Field(
        default=30.0,
        description="EDGAR timeout. ADR-005.",
    )
    # 86400s = 24hr: filings are published quarterly, not intraday.
    edgar_cache_ttl_seconds: int = Field(
        default=86400,
        description="EDGAR cache TTL. 86400s (24hr). ADR-005.",
    )


# Singleton — import this everywhere in the worker.
settings = WorkerSettings()
