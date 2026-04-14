"""
Tests for cache key functions (src/cache/keys.py).

Cache keys are the contract between the API layer and Redis. These tests
confirm key format, required parameters, and that no two keys collide.
"""
from __future__ import annotations

import src.cache.keys as keys


def test_ohlcv_key_format() -> None:
    key = keys.ohlcv("AAPL", "1D", "2024-01-01", "2024-12-31")
    assert key == "cache:ohlcv:AAPL:1D:2024-01-01:2024-12-31"


def test_quote_snapshot_key_format() -> None:
    key = keys.quote_snapshot("BTCUSD")
    assert key == "price:snapshot:BTCUSD"


def test_fundamentals_key_format() -> None:
    key = keys.fundamentals("instrument-uuid", "annual")
    assert key == "cache:fundamentals:instrument-uuid:annual"


def test_screener_key_format() -> None:
    key = keys.screener("abc123hash")
    assert key == "cache:screener:abc123hash"


def test_news_feed_key_with_symbol() -> None:
    key = keys.news_feed("AAPL", 1)
    assert key == "cache:news:AAPL:page:1"


def test_news_feed_key_without_symbol_uses_all() -> None:
    key = keys.news_feed(None, 1)
    assert key == "cache:news:all:page:1"


def test_macro_series_key_format() -> None:
    key = keys.macro_series("FEDFUNDS")
    assert key == "cache:macro:FEDFUNDS"


def test_instrument_list_key_with_asset_class() -> None:
    key = keys.instrument_list("equity", 2)
    assert key == "cache:instruments:equity:page:2"


def test_instrument_list_key_without_asset_class_uses_all() -> None:
    key = keys.instrument_list(None, 0)
    assert key == "cache:instruments:all:page:0"


def test_api_quota_key_format() -> None:
    key = keys.api_quota("marketstack", "2024-01")
    assert key == "quota:marketstack:2024-01"


def test_rate_limit_user_key_format() -> None:
    key = keys.rate_limit_user("user-uuid", "2024-01-01T00")
    assert key == "ratelimit:user:user-uuid:2024-01-01T00"


def test_rate_limit_ip_key_format() -> None:
    key = keys.rate_limit_ip("192.168.1.1", "2024-01-01T00")
    assert key == "ratelimit:ip:192.168.1.1:2024-01-01T00"


def test_pubsub_price_channel_format() -> None:
    ch = keys.PubSubChannels.price("BTCUSD")
    assert ch == "prices:BTCUSD"


def test_pubsub_alert_channel_format() -> None:
    ch = keys.PubSubChannels.alert("user-uuid")
    assert ch == "alerts:user:user-uuid"


def test_pubsub_filing_new_channel_format() -> None:
    ch = keys.PubSubChannels.filing_new("AAPL")
    assert ch == "filing:new:AAPL"


def test_ohlcv_and_quote_keys_do_not_collide() -> None:
    """OHLCV cache and price snapshot live in different key namespaces."""
    ohlcv_key = keys.ohlcv("AAPL", "1D", "2024-01-01", "2024-12-31")
    quote_key = keys.quote_snapshot("AAPL")
    assert ohlcv_key != quote_key
