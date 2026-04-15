"""
Application configuration via pydantic-settings.

Why this exists: All configuration is type-validated at startup.
If a required variable is missing, the app refuses to start with a clear error.
No hardcoded values, no fallback secrets. Environment variables only.
"""

from __future__ import annotations

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


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
    api_base_url: str = "http://localhost:8000"
    # HTTPS origin for local dev (ADR-004); http fallback for plain vite dev
    cors_allowed_origins: list[str] = ["https://localhost:5173", "http://localhost:5173"]

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

    # Redis
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # Market data API keys — no defaults, required in non-dev environments
    marketstack_api_key: str = ""
    alpha_vantage_api_key: str = ""
    fmp_api_key: str = ""
    coingecko_api_key: str = ""
    stockdata_api_key: str = ""
    fred_api_key: str = ""

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

    # SEC EDGAR
    edgar_user_agent: str

    # WebSocket gateway
    ws_gateway_port: int = 3001
    ws_gateway_internal_api_url: str = "http://localhost:8000"
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

    @field_validator("cors_allowed_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: object) -> list[str]:
        """Parse comma-separated string into list."""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v  # type: ignore[return-value]

    @field_validator("app_env")
    @classmethod
    def validate_app_env(cls, v: str) -> str:
        allowed = {"development", "staging", "production"}
        if v not in allowed:
            raise ValueError(f"app_env must be one of {allowed}, got: {v!r}")
        return v


# Singleton — import this everywhere
settings = Settings()
