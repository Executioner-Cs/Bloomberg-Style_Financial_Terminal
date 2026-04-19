"""
Application configuration via pydantic-settings.

Why this exists: All configuration is type-validated at startup.
If a required variable is missing, the app refuses to start with a clear error.
No hardcoded values, no fallback secrets. Environment variables only.
"""

from __future__ import annotations

from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _find_project_root() -> Path:
    """
    Walk up from this file until a directory containing .git/ is found.

    Why: Avoids hardcoded absolute paths (CLAUDE.md Rule 1). Works regardless
    of where Python is invoked (IDE, CLI, Docker). Override with MOCK_DATA_DIR
    env var for non-standard layouts (e.g. CI runners without .git/).
    Documented in ADR-006.
    """
    current = Path(__file__).resolve().parent
    while current != current.parent:
        if (current / ".git").exists():
            return current
        current = current.parent
    # Fallback: two levels up from services/api/src/ = project root.
    return Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    """
    All environment variables parsed and validated at startup.
    See .env.example for documentation on each variable.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_env: str = "development"
    log_level: str = "INFO"
    # Required — set API_BASE_URL in .env. No localhost default: fails fast if missing.
    api_base_url: str
    # Required — set CORS_ALLOWED_ORIGINS in .env (comma-separated, no trailing slashes).
    # Stored as a raw string because pydantic-settings 2.6 JSON-parses any
    # `list[str]`-typed env var before field validators run. Access the parsed
    # list via the cors_origins property below.
    cors_allowed_origins: str

    # Auth — no defaults for secrets, will raise on missing in production
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 15
    jwt_refresh_token_expire_days: int = 7

    # PostgreSQL
    database_url: str
    sync_database_url: str
    test_database_url: str = ""
    database_pool_size: int = 10
    database_max_overflow: int = 20

    # ClickHouse
    clickhouse_host: str = "localhost"
    clickhouse_port: int = 9000
    clickhouse_database: str = "terminal"
    clickhouse_user: str = "default"
    clickhouse_password: str = ""
    clickhouse_http_port: int = 8123

    # Redis — all required, no localhost defaults. Set in .env.
    # DB 0: cache; DB 1: Celery broker; DB 2: Celery results backend.
    redis_url: str
    celery_broker_url: str
    celery_result_backend: str

    # ─── Mock data (ADR-006) ─────────────────────────────────────────────────
    # When true, all integration calls route to local JSON files in mock_data/.
    # Set to false in staging/production to use live providers.
    use_mock_data: bool = Field(default=False, description="Route all integrations to mock_data/ instead of live APIs. ADR-006.")
    # Empty string = auto-detect project root via .git walk (ADR-006).
    # Set MOCK_DATA_DIR to an absolute path to override (e.g. in CI without .git/).
    mock_data_dir: str = Field(default="", description="Absolute path to mock_data/ directory. Empty = auto-detect. ADR-006.")

    # ─── Market data API keys ─────────────────────────────────────────────────
    # Empty default = optional. App does not fail to start if these are unset.
    marketstack_api_key: str = ""
    alpha_vantage_api_key: str = ""
    fmp_api_key: str = ""
    coingecko_api_key: str = ""
    stockdata_api_key: str = ""
    fred_api_key: str = Field(default="", description="FRED API key — free at fred.stlouisfed.org. Required for live macro ingestion.")
    # Field name matches env var NEWSAPI_API_KEY (pydantic-settings lowercases env vars).
    newsapi_api_key: str = Field(default="", description="NewsAPI.org key — free tier: 100 req/day. Required for live news ingestion.")
    finnhub_api_key: str = Field(default="", description="Finnhub.io key — free tier: 60 req/min. Supplemental quotes/news source.")

    # CoinGecko
    # Base URL overridable via env so tests can point at a mock server.
    coingecko_base_url: str = "https://api.coingecko.com/api/v3"
    # Timeout for CoinGecko HTTP calls. 15s leaves margin over typical ~2s response.
    coingecko_timeout_seconds: float = 15.0
    # Top-N coins by market cap to ingest. Default 50 covers all major assets.
    coingecko_top_n_coins: int = 50
    # CoinGecko /coins/markets page size hard limit — defined by their API spec.
    coingecko_markets_per_page_max: int = 250
    # OHLCV cache TTL. CoinGecko free tier updates daily — 3600s (1h) is safe.
    ohlcv_cache_ttl_seconds: int = 3600
    # Quote snapshot TTL. Short enough to feel live, conservative to avoid rate limits.
    quote_cache_ttl_seconds: int = 60

    # Bulk quotes: max symbols per request. Caps memory and query cost.
    # 50 matches COINGECKO_TOP_N_COINS — covers all tracked assets.
    bulk_quotes_max_symbols: int = 50

    # Rate limits (sourced from env, never hardcoded in business logic)
    marketstack_monthly_limit: int = 100
    alpha_vantage_daily_limit: int = 25
    fmp_daily_limit: int = 250
    coingecko_requests_per_minute: int = 30
    stockdata_daily_limit: int = 100
    fred_daily_soft_limit: int = 500
    edgar_requests_per_second: int = 10

    # ─── yfinance (Yahoo Finance — unofficial, no API key, ADR-005) ──────────
    # Self-imposed rate limit. Yahoo has no published policy; 60/min is conservative.
    yfinance_requests_per_minute: int = Field(default=60, description="Self-imposed yfinance rate limit. Yahoo has no published limit. ADR-005.")
    # 30s timeout. Yahoo has no published SLA; 30s is conservative per ADR-005.
    yfinance_timeout_seconds: float = Field(default=30.0, description="yfinance network timeout. ADR-005.")
    # Top 30 S&P constituents — Phase 1 equities scope per README.
    yfinance_equity_symbols: list[str] = Field(
        default_factory=lambda: [
            "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "JPM", "V", "JNJ",
            "PG", "UNH", "MA", "HD", "CVX", "MRK", "ABBV", "KO", "PEP", "WMT",
            "BAC", "XOM", "LLY", "AVGO", "COST", "DIS", "ADBE", "NFLX", "CRM", "AMD",
        ],
        description="Equity symbols to ingest via yfinance. Phase 1: top 30 S&P constituents.",
    )
    # 1D ingestion schedule — 21:30 UTC = 4:30 PM ET (30 min after NYSE close).
    yfinance_ingest_hour_utc: int = Field(default=21, description="Hour (UTC) for daily yfinance ingestion. 21:30 UTC = 4:30 PM ET.")
    yfinance_ingest_minute_utc: int = Field(default=30, description="Minute (UTC) for daily yfinance ingestion. See yfinance_ingest_hour_utc.")

    # ─── FRED (Federal Reserve Economic Data — free API key, ADR-005) ────────
    # 30s timeout. FRED has no published SLA; 30s is conservative per ADR-005.
    fred_timeout_seconds: float = Field(default=30.0, description="FRED API request timeout. ADR-005.")
    # Phase 1 scope: 5 core macro series covering growth, inflation, rates, employment.
    fred_series_ids: list[str] = Field(
        default_factory=lambda: ["GDP", "CPIAUCSL", "FEDFUNDS", "DGS10", "UNRATE"],
        description="FRED series IDs to ingest. Phase 1: GDP, CPI, Fed Funds, 10Y Treasury, Unemployment.",
    )
    # Weekly on Monday 08:00 UTC — macro releases are typically weekday AM.
    fred_ingest_day_of_week: str = Field(default="1", description="Day of week for weekly FRED ingestion (1=Monday).")
    fred_ingest_hour_utc: int = Field(default=8, description="Hour (UTC) for weekly FRED ingestion.")
    fred_ingest_minute_utc: int = Field(default=0, description="Minute (UTC) for weekly FRED ingestion.")

    # ─── NewsAPI (100 req/day free tier, ADR-005) ─────────────────────────────
    newsapi_timeout_seconds: float = Field(default=15.0, description="NewsAPI request timeout. ADR-005.")
    # 300s (5 min) TTL: 100 req/day budget. 5-min cache limits calls while staying fresh.
    news_cache_ttl_seconds: int = Field(default=300, description="News cache TTL. 300s respects NewsAPI 100 req/day free limit. ADR-005.")

    # ─── Finnhub (60 req/min free tier, ADR-005) ──────────────────────────────
    finnhub_timeout_seconds: float = Field(default=15.0, description="Finnhub request timeout. ADR-005.")

    # ─── HTTP client identity ─────────────────────────────────────────────────
    # Sent as User-Agent in Finnhub and NewsAPI requests.
    # EDGAR uses edgar_user_agent separately (SEC ToS mandates a specific format).
    # Must include a valid contact email before production deployment.
    app_user_agent: str = Field(
        default="Bloomberg-Terminal/1.0 contact@example.com",
        description="User-Agent for Finnhub and NewsAPI HTTP requests. Replace contact email before production.",
    )

    # ─── SEC EDGAR (unlimited, no key, US government, ADR-005) ───────────────
    # REQUIRED by EDGAR ToS: https://www.sec.gov/developer — replace before production.
    edgar_user_agent: str
    edgar_timeout_seconds: float = Field(default=30.0, description="EDGAR API request timeout. ADR-005.")
    # 86400s = 24hr: filings are published quarterly — no need to re-fetch intraday.
    edgar_cache_ttl_seconds: int = Field(default=86400, description="EDGAR filing cache TTL. 86400s (24hr): filings don't change intraday. ADR-005.")
    # Cache TTL used by the FilingsService (HTTP-facing cache-aside). Mirrors
    # edgar_cache_ttl_seconds but exposed as its own field so the service
    # layer never references a source-specific constant.
    filings_cache_ttl_seconds: int = Field(
        default=86400,
        description="FilingsService cache TTL (24hr). Filings are quarterly. ADR-005.",
    )

    # ─── WebSocket gateway ────────────────────────────────────────────────────
    ws_gateway_port: int = 3001
    # Required — server-side call within Docker bridge. Set WS_GATEWAY_INTERNAL_API_URL in .env.
    ws_gateway_internal_api_url: str
    binance_ws_base_url: str = "wss://stream.binance.com:9443"
    coinbase_ws_base_url: str = "wss://advanced-trade-ws.coinbase.com"

    # Email
    email_provider: str = "sendgrid"
    sendgrid_api_key: str = ""
    resend_api_key: str = ""
    email_from_address: str = "alerts@yourdomain.com"
    email_from_name: str = "Bloomberg Terminal Alerts"

    # Monitoring
    sentry_dsn: str = ""
    sentry_environment: str = "development"

    @property
    def cors_origins(self) -> list[str]:
        """Parsed comma-separated CORS origin list with empty entries dropped."""
        return [o.strip() for o in self.cors_allowed_origins.split(",") if o.strip()]

    @field_validator("app_env")
    @classmethod
    def validate_app_env(cls, v: str) -> str:
        allowed = {"development", "staging", "production"}
        if v not in allowed:
            raise ValueError(f"app_env must be one of {allowed}, got: {v!r}")
        return v


# Singleton — import this everywhere
settings = Settings()
