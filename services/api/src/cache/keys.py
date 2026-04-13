"""
Centralized cache key constants.

Why this exists: Cache keys scattered across the codebase lead to TTL
inconsistencies, key collisions, and painful refactors. One source of truth.

Convention: keys are functions that return strings, so callers always pass
required parameters and can't accidentally use a bare template string.
"""
from __future__ import annotations


def ohlcv(symbol: str, timeframe: str, from_date: str, to_date: str) -> str:
    """OHLCV bars for a symbol/timeframe range."""
    return f"cache:ohlcv:{symbol}:{timeframe}:{from_date}:{to_date}"


def quote_snapshot(symbol: str) -> str:
    """Latest price snapshot for a symbol (hot path, very short TTL)."""
    return f"price:snapshot:{symbol}"


def fundamentals(instrument_id: str, period_type: str) -> str:
    """Fundamentals data for an instrument."""
    return f"cache:fundamentals:{instrument_id}:{period_type}"


def screener(fingerprint: str) -> str:
    """Screener results — fingerprint is a hash of the filter/sort params."""
    return f"cache:screener:{fingerprint}"


def news_feed(symbol: str | None, page: int) -> str:
    """News feed, optionally filtered by symbol."""
    sym = symbol or "all"
    return f"cache:news:{sym}:page:{page}"


def macro_series(series_id: str) -> str:
    """FRED macro series data."""
    return f"cache:macro:{series_id}"


def instrument_list(asset_class: str | None, page: int) -> str:
    """Paginated instrument list."""
    ac = asset_class or "all"
    return f"cache:instruments:{ac}:page:{page}"


def api_quota(provider: str, period: str) -> str:
    """API quota counter for a provider in a given period (day/month)."""
    return f"quota:{provider}:{period}"


def rate_limit_user(user_id: str, window: str) -> str:
    """Per-user rate limit counter."""
    return f"ratelimit:user:{user_id}:{window}"


def rate_limit_ip(ip: str, window: str) -> str:
    """Per-IP rate limit counter."""
    return f"ratelimit:ip:{ip}:{window}"


# Pub/Sub channel names (not cache keys, but keeping them centralized)
class PubSubChannels:
    @staticmethod
    def price(symbol: str) -> str:
        return f"prices:{symbol}"

    @staticmethod
    def alert(user_id: str) -> str:
        return f"alerts:user:{user_id}"

    @staticmethod
    def filing_new(symbol: str) -> str:
        return f"filing:new:{symbol}"
