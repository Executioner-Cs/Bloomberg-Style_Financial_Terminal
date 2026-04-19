"""
Unit tests for the Finnhub integration client.

All tests use httpx.MockTransport — zero real HTTP calls.
Tests cover: successful quote parse, zero-price skip, missing timestamp,
change_24h decimal conversion, and None return for unknown symbols.
"""

from __future__ import annotations

import json
from datetime import datetime

import httpx
import pytest

from src.integrations.finnhub import FinnhubClient
from src.schemas.market_data import QuoteResponse

_TEST_API_KEY = "test-finnhub-key"
_TEST_TIMEOUT = 15.0
_TEST_USER_AGENT = "Bloomberg-Terminal/1.0 test@example.com"


def _make_transport(status_code: int, body: object) -> httpx.MockTransport:
    content = json.dumps(body).encode()

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code, content=content)

    return httpx.MockTransport(handler)


def _sample_quote(
    c: float = 182.50,
    d: float = 1.25,
    dp: float = 0.69,
    h: float = 183.00,
    lo: float = 181.00,
    o: float = 181.50,
    pc: float = 181.25,
    t: int = 1730300000,
) -> dict[str, object]:
    return {"c": c, "d": d, "dp": dp, "h": h, "l": lo, "o": o, "pc": pc, "t": t}


@pytest.fixture
def client() -> FinnhubClient:
    return FinnhubClient(
        api_key=_TEST_API_KEY,
        timeout_seconds=_TEST_TIMEOUT,
        user_agent=_TEST_USER_AGENT,
    )


def _inject_transport(client: FinnhubClient, transport: httpx.MockTransport) -> None:
    client._client = httpx.AsyncClient(
        base_url=client.base_url,
        transport=transport,
        headers=client._build_headers(),
    )


class TestFinnhubClientGetQuote:
    @pytest.mark.asyncio
    async def test_get_quote_returns_quote_response(
        self, client: FinnhubClient
    ) -> None:
        transport = _make_transport(200, _sample_quote())
        _inject_transport(client, transport)

        result = await client.get_quote("AAPL")

        assert isinstance(result, QuoteResponse)
        assert result.symbol == "AAPL"

    @pytest.mark.asyncio
    async def test_get_quote_price_matches_current(self, client: FinnhubClient) -> None:
        transport = _make_transport(200, _sample_quote(c=182.50))
        _inject_transport(client, transport)

        result = await client.get_quote("AAPL")

        assert result is not None
        assert result.price == 182.50

    @pytest.mark.asyncio
    async def test_get_quote_converts_dp_to_decimal_fraction(
        self, client: FinnhubClient
    ) -> None:
        """dp=1.5 (percent) must be stored as 0.015 (decimal fraction)."""
        transport = _make_transport(200, _sample_quote(dp=1.5))
        _inject_transport(client, transport)

        result = await client.get_quote("AAPL")

        assert result is not None
        assert result.change_24h == pytest.approx(0.015)

    @pytest.mark.asyncio
    async def test_get_quote_returns_none_for_zero_price(
        self, client: FinnhubClient
    ) -> None:
        """c=0.0 signals unknown symbol — must return None."""
        transport = _make_transport(200, _sample_quote(c=0.0))
        _inject_transport(client, transport)

        result = await client.get_quote("UNKNOWN")

        assert result is None

    @pytest.mark.asyncio
    async def test_get_quote_timestamp_is_utc_aware(
        self, client: FinnhubClient
    ) -> None:
        transport = _make_transport(200, _sample_quote(t=1730300000))
        _inject_transport(client, transport)

        result = await client.get_quote("AAPL")

        assert result is not None
        assert isinstance(result.ts, datetime)
        assert result.ts.tzinfo is not None

    @pytest.mark.asyncio
    async def test_get_quote_no_timestamp_yields_none_ts(
        self, client: FinnhubClient
    ) -> None:
        data = _sample_quote()
        data.pop("t")  # type: ignore[attr-defined]
        transport = _make_transport(200, data)
        _inject_transport(client, transport)

        result = await client.get_quote("AAPL")

        assert result is not None
        assert result.ts is None

    @pytest.mark.asyncio
    async def test_get_quote_volume_24h_is_none(self, client: FinnhubClient) -> None:
        """Finnhub /quote endpoint does not return volume."""
        transport = _make_transport(200, _sample_quote())
        _inject_transport(client, transport)

        result = await client.get_quote("AAPL")

        assert result is not None
        assert result.volume_24h is None

    @pytest.mark.asyncio
    async def test_get_quote_dp_none_yields_none_change(
        self, client: FinnhubClient
    ) -> None:
        data = _sample_quote()
        data.pop("dp")  # type: ignore[attr-defined]
        transport = _make_transport(200, data)
        _inject_transport(client, transport)

        result = await client.get_quote("AAPL")

        assert result is not None
        assert result.change_24h is None


class TestFinnhubClientHeaders:
    def test_build_headers_contains_user_agent(self, client: FinnhubClient) -> None:
        headers = client._build_headers()
        assert "User-Agent" in headers
        assert "Bloomberg-Terminal" in headers["User-Agent"]

    def test_build_headers_contains_accept_json(self, client: FinnhubClient) -> None:
        headers = client._build_headers()
        assert headers.get("Accept") == "application/json"
