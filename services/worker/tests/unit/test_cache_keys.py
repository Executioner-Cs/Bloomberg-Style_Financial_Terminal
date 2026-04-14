"""
Unit tests for src/cache/keys.py.

Cache key format is load-bearing — a change breaks Redis lookups across both
the API and worker services. These tests pin the exact key format.
"""

from __future__ import annotations

from src.cache import keys


def test_ohlcv_key_format() -> None:
    key = keys.ohlcv("BTC", "1D", "2024-01-01", "2024-12-31")
    assert key == "cache:ohlcv:BTC:1D:2024-01-01:2024-12-31"


def test_ohlcv_key_contains_all_params() -> None:
    key = keys.ohlcv("ETH", "4H", "2023-06-01", "2023-06-30")
    assert "ETH" in key
    assert "4H" in key
    assert "2023-06-01" in key
    assert "2023-06-30" in key


def test_quote_snapshot_key_format() -> None:
    key = keys.quote_snapshot("BITCOIN")
    assert key == "price:snapshot:BITCOIN"


def test_quote_snapshot_key_varies_by_symbol() -> None:
    assert keys.quote_snapshot("BTC") != keys.quote_snapshot("ETH")


def test_fundamentals_key_format() -> None:
    key = keys.fundamentals("abc-123", "annual")
    assert key == "cache:fundamentals:abc-123:annual"


def test_screener_key_format() -> None:
    key = keys.screener("deadbeef")
    assert key == "cache:screener:deadbeef"


def test_news_feed_key_with_symbol() -> None:
    key = keys.news_feed("AAPL", 1)
    assert key == "cache:news:AAPL:page:1"


def test_news_feed_key_without_symbol() -> None:
    key = keys.news_feed(None, 2)
    assert key == "cache:news:all:page:2"


def test_macro_series_key_format() -> None:
    key = keys.macro_series("GDP")
    assert key == "cache:macro:GDP"


def test_instrument_list_key_with_asset_class() -> None:
    key = keys.instrument_list("crypto", 0)
    assert key == "cache:instruments:crypto:page:0"


def test_instrument_list_key_without_asset_class() -> None:
    key = keys.instrument_list(None, 1)
    assert key == "cache:instruments:all:page:1"


def test_api_quota_key_format() -> None:
    key = keys.api_quota("coingecko", "day")
    assert key == "quota:coingecko:day"


def test_rate_limit_user_key_format() -> None:
    key = keys.rate_limit_user("user-42", "hourly")
    assert key == "ratelimit:user:user-42:hourly"


def test_rate_limit_ip_key_format() -> None:
    key = keys.rate_limit_ip("203.0.113.1", "hourly")
    assert key == "ratelimit:ip:203.0.113.1:hourly"


def test_pubsub_price_channel() -> None:
    channel = keys.PubSubChannels.price("BTC")
    assert channel == "prices:BTC"


def test_pubsub_alert_channel() -> None:
    channel = keys.PubSubChannels.alert("user-99")
    assert channel == "alerts:user:user-99"


def test_pubsub_filing_new_channel() -> None:
    channel = keys.PubSubChannels.filing_new("AAPL")
    assert channel == "filing:new:AAPL"
