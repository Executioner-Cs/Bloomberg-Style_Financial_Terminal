"""
Unit tests for the CoinGecko integration client (worker copy).

All HTTP calls are intercepted via httpx.MockTransport — no real network
requests are made. Tests validate response parsing, error handling, and retry.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from src.integrations.base import IntegrationError, RateLimitError
from src.integrations.coingecko import CoinGeckoClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _market_chart_payload(
    prices: list[list[float]] | None = None,
    volumes: list[list[float]] | None = None,
) -> bytes:
    """Build a minimal /coins/{id}/market_chart response body."""
    ts_ms = 1704067200000  # 2024-01-01 00:00:00 UTC
    if prices is None:
        prices = [[float(ts_ms), 44000.0]]
    if volumes is None:
        volumes = [[float(ts_ms), 500.0]]
    payload = {
        "prices": prices,
        "market_caps": [[float(ts_ms), 800_000_000_000.0]],
        "total_volumes": volumes,
    }
    return json.dumps(payload).encode()


def _coin_list_payload() -> bytes:
    return json.dumps(
        [{"id": "bitcoin", "symbol": "btc", "name": "Bitcoin"}]
    ).encode()


def _markets_payload() -> bytes:
    return json.dumps(
        [{"id": "bitcoin", "symbol": "btc", "name": "Bitcoin", "market_cap": 800e9}]
    ).encode()


def _make_transport(body: bytes, status_code: int = 200) -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code, content=body)

    return httpx.MockTransport(handler)


# ---------------------------------------------------------------------------
# get_ohlcv
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_ohlcv_returns_ohlcv_rows() -> None:
    transport = _make_transport(_market_chart_payload())
    client = CoinGeckoClient()
    client._client = httpx.AsyncClient(
        transport=transport, base_url="https://api.coingecko.com/api/v3"
    )

    rows = await client.get_ohlcv("bitcoin", "usd", 90)
    assert len(rows) == 1
    assert rows[0].symbol == "BITCOIN"
    assert rows[0].timeframe == "1D"
    assert rows[0].close == pytest.approx(44000.0)
    assert rows[0].source == "coingecko"


@pytest.mark.asyncio
async def test_get_ohlcv_volume_mapped_correctly() -> None:
    ts_ms = 1704067200000
    transport = _make_transport(
        _market_chart_payload(
            prices=[[float(ts_ms), 44000.0]],
            volumes=[[float(ts_ms), 123456.0]],
        )
    )
    client = CoinGeckoClient()
    client._client = httpx.AsyncClient(
        transport=transport, base_url="https://api.coingecko.com/api/v3"
    )

    rows = await client.get_ohlcv("bitcoin", "usd", 90)
    assert rows[0].volume == pytest.approx(123456.0)


@pytest.mark.asyncio
async def test_get_ohlcv_timestamp_is_utc_aware() -> None:
    transport = _make_transport(_market_chart_payload())
    client = CoinGeckoClient()
    client._client = httpx.AsyncClient(
        transport=transport, base_url="https://api.coingecko.com/api/v3"
    )

    rows = await client.get_ohlcv("bitcoin", "usd", 90)
    assert rows[0].ts.tzinfo is not None
    assert rows[0].ts == datetime(2024, 1, 1, tzinfo=UTC)


@pytest.mark.asyncio
async def test_get_ohlcv_volume_zero_when_ts_missing() -> None:
    """If volume timestamp doesn't match price timestamp, volume defaults to 0."""
    ts_ms = 1704067200000
    transport = _make_transport(
        _market_chart_payload(
            prices=[[float(ts_ms), 44000.0]],
            volumes=[[float(ts_ms + 999999), 999.0]],  # different ts
        )
    )
    client = CoinGeckoClient()
    client._client = httpx.AsyncClient(
        transport=transport, base_url="https://api.coingecko.com/api/v3"
    )

    rows = await client.get_ohlcv("bitcoin", "usd", 90)
    assert rows[0].volume == pytest.approx(0.0)


@pytest.mark.asyncio
async def test_get_ohlcv_raises_rate_limit_error_on_429() -> None:
    transport = _make_transport(b'{"error": "rate limit"}', status_code=429)
    client = CoinGeckoClient()
    client._client = httpx.AsyncClient(
        transport=transport, base_url="https://api.coingecko.com/api/v3"
    )

    with pytest.raises(RateLimitError):
        await client.get_ohlcv("bitcoin", "usd", 90)


@pytest.mark.asyncio
async def test_get_ohlcv_raises_integration_error_after_max_retries_on_500() -> None:
    transport = _make_transport(b"Internal Server Error", status_code=500)
    client = CoinGeckoClient()
    client._client = httpx.AsyncClient(
        transport=transport, base_url="https://api.coingecko.com/api/v3"
    )

    # Patch asyncio.sleep to avoid actual delays in the retry loop.
    with patch("src.integrations.base.asyncio.sleep", new=AsyncMock()):
        with pytest.raises(IntegrationError) as exc_info:
            await client.get_ohlcv("bitcoin", "usd", 90)

    assert exc_info.value.status_code == 500


# ---------------------------------------------------------------------------
# get_coin_list
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_coin_list_parses_response() -> None:
    transport = _make_transport(_coin_list_payload())
    client = CoinGeckoClient()
    client._client = httpx.AsyncClient(
        transport=transport, base_url="https://api.coingecko.com/api/v3"
    )

    coins = await client.get_coin_list()
    assert len(coins) == 1
    assert coins[0].id == "bitcoin"
    assert coins[0].symbol == "btc"
    assert coins[0].name == "Bitcoin"


@pytest.mark.asyncio
async def test_get_coin_list_returns_empty_on_non_list_response() -> None:
    transport = _make_transport(b'{"error": "unexpected"}')
    client = CoinGeckoClient()
    client._client = httpx.AsyncClient(
        transport=transport, base_url="https://api.coingecko.com/api/v3"
    )

    coins = await client.get_coin_list()
    assert coins == []


# ---------------------------------------------------------------------------
# get_top_coins_by_market_cap
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_top_coins_by_market_cap_parses_response() -> None:
    transport = _make_transport(_markets_payload())
    client = CoinGeckoClient()
    client._client = httpx.AsyncClient(
        transport=transport, base_url="https://api.coingecko.com/api/v3"
    )

    coins = await client.get_top_coins_by_market_cap(1)
    assert len(coins) == 1
    assert coins[0].id == "bitcoin"


@pytest.mark.asyncio
async def test_get_top_coins_returns_empty_on_non_list_response() -> None:
    transport = _make_transport(b'{"unexpected": true}')
    client = CoinGeckoClient()
    client._client = httpx.AsyncClient(
        transport=transport, base_url="https://api.coingecko.com/api/v3"
    )

    coins = await client.get_top_coins_by_market_cap(10)
    assert coins == []
