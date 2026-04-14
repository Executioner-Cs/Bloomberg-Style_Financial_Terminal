"""
Unit tests for the CoinGecko integration client.

All tests use httpx.MockTransport — zero real HTTP calls.
Tests cover: successful OHLCV parse, 429 rate limit, 500 retry, coin list parse.
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


def _make_transport(status_code: int, body: object) -> httpx.MockTransport:
    """Return a MockTransport that always responds with the given status and body."""
    content = json.dumps(body).encode()

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code, content=content)

    return httpx.MockTransport(handler)


def _market_chart_payload(
    prices: list[list[float]],
    volumes: list[list[float]],
) -> dict[str, object]:
    return {
        "prices": prices,
        "market_caps": [[p[0], p[1] * 10] for p in prices],
        "total_volumes": volumes,
    }


# ---------------------------------------------------------------------------
# get_ohlcv
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_ohlcv_returns_ohlcv_rows() -> None:
    """Happy path: response is parsed into OHLCVRow instances."""
    ts_ms = 1_700_000_000_000  # arbitrary millisecond timestamp
    payload = _market_chart_payload(
        prices=[[float(ts_ms), 45000.0]],
        volumes=[[float(ts_ms), 1234.5]],
    )
    transport = _make_transport(200, payload)

    client = CoinGeckoClient()
    async with httpx.AsyncClient(
        transport=transport, base_url="https://api.coingecko.com/api/v3"
    ) as mock_client:
        client._client = mock_client
        rows = await client.get_ohlcv("bitcoin", "usd", 1)

    assert len(rows) == 1
    row = rows[0]
    assert row.symbol == "BITCOIN"
    assert row.timeframe == "1D"
    assert row.close == pytest.approx(45000.0)
    assert row.volume == pytest.approx(1234.5)
    assert row.source == "coingecko"
    assert row.ts == datetime.fromtimestamp(ts_ms / 1000, tz=UTC)


@pytest.mark.asyncio
async def test_get_ohlcv_uses_volume_lookup() -> None:
    """Volume is matched to price entry by timestamp."""
    ts1 = 1_700_000_000_000.0
    ts2 = 1_700_086_400_000.0  # +1 day
    payload = _market_chart_payload(
        prices=[[ts1, 100.0], [ts2, 200.0]],
        volumes=[[ts1, 500.0], [ts2, 600.0]],
    )
    transport = _make_transport(200, payload)

    client = CoinGeckoClient()
    async with httpx.AsyncClient(
        transport=transport, base_url="https://api.coingecko.com/api/v3"
    ) as mock_client:
        client._client = mock_client
        rows = await client.get_ohlcv("ethereum", "usd", 2)

    assert len(rows) == 2
    assert rows[0].volume == pytest.approx(500.0)
    assert rows[1].volume == pytest.approx(600.0)


@pytest.mark.asyncio
async def test_get_ohlcv_missing_volume_defaults_to_zero() -> None:
    """If a price ts has no corresponding volume entry, volume is 0.0."""
    ts = 1_700_000_000_000.0
    payload = _market_chart_payload(
        prices=[[ts, 300.0]],
        volumes=[],  # no volume data
    )
    transport = _make_transport(200, payload)

    client = CoinGeckoClient()
    async with httpx.AsyncClient(
        transport=transport, base_url="https://api.coingecko.com/api/v3"
    ) as mock_client:
        client._client = mock_client
        rows = await client.get_ohlcv("solana", "usd", 1)

    assert rows[0].volume == pytest.approx(0.0)


@pytest.mark.asyncio
async def test_get_ohlcv_raises_rate_limit_on_429() -> None:
    """HTTP 429 from CoinGecko raises RateLimitError immediately (no retry)."""
    transport = _make_transport(429, {"error": "rate limit"})

    client = CoinGeckoClient()
    async with httpx.AsyncClient(
        transport=transport, base_url="https://api.coingecko.com/api/v3"
    ) as mock_client:
        client._client = mock_client
        with pytest.raises(RateLimitError):
            await client.get_ohlcv("bitcoin", "usd", 1)


@pytest.mark.asyncio
async def test_get_ohlcv_raises_integration_error_after_retries_on_500() -> None:
    """HTTP 500 from CoinGecko raises IntegrationError after exhausting retries."""
    call_count = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal call_count
        call_count += 1
        return httpx.Response(500, content=b"internal error")

    transport = httpx.MockTransport(handler)

    client = CoinGeckoClient()
    async with httpx.AsyncClient(
        transport=transport, base_url="https://api.coingecko.com/api/v3"
    ) as mock_client:
        client._client = mock_client
        # Patch asyncio.sleep to avoid real delays in tests.
        with (
            patch("src.integrations.base.asyncio.sleep", new_callable=AsyncMock),
            pytest.raises(IntegrationError),
        ):
            await client.get_ohlcv("bitcoin", "usd", 1)

    # DEFAULT_MAX_RETRIES=3 means 4 total attempts (1 initial + 3 retries).
    assert call_count == 4


# ---------------------------------------------------------------------------
# get_coin_list
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_coin_list_parses_response() -> None:
    """get_coin_list parses the list response into _CoinListItem instances."""
    payload = [
        {"id": "bitcoin", "symbol": "btc", "name": "Bitcoin"},
        {"id": "ethereum", "symbol": "eth", "name": "Ethereum"},
    ]
    transport = _make_transport(200, payload)

    client = CoinGeckoClient()
    async with httpx.AsyncClient(
        transport=transport, base_url="https://api.coingecko.com/api/v3"
    ) as mock_client:
        client._client = mock_client
        coins = await client.get_coin_list()

    assert len(coins) == 2
    assert coins[0].id == "bitcoin"
    assert coins[0].symbol == "btc"
    assert coins[1].name == "Ethereum"


@pytest.mark.asyncio
async def test_get_coin_list_returns_empty_on_unexpected_response() -> None:
    """Unexpected /coins/list response type returns empty list without crashing."""
    transport = _make_transport(200, {"error": "unexpected"})

    client = CoinGeckoClient()
    async with httpx.AsyncClient(
        transport=transport, base_url="https://api.coingecko.com/api/v3"
    ) as mock_client:
        client._client = mock_client
        coins = await client.get_coin_list()

    assert coins == []


# ---------------------------------------------------------------------------
# get_top_coins_by_market_cap
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_top_coins_by_market_cap_limits_per_page() -> None:
    """Request is capped at coingecko_markets_per_page_max (250)."""
    called_with_per_page: list[int] = []

    def handler(request: httpx.Request) -> httpx.Response:
        per_page = int(request.url.params.get("per_page", 0))
        called_with_per_page.append(per_page)
        return httpx.Response(200, content=b"[]")

    transport = httpx.MockTransport(handler)

    client = CoinGeckoClient()
    async with httpx.AsyncClient(
        transport=transport, base_url="https://api.coingecko.com/api/v3"
    ) as mock_client:
        client._client = mock_client
        # Request 9999 — capped at 250 (coingecko_markets_per_page_max)
        await client.get_top_coins_by_market_cap(9999)

    assert called_with_per_page == [250]
