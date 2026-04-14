"""
Integration tests for the market data and instruments REST endpoints.

Tests use httpx.AsyncClient with ASGITransport — real FastAPI routing and
request/response handling, but the service layer is substituted via
app.dependency_overrides so no DB or Redis connections are needed.

This validates: routing, response shape, status codes, query parameter handling.
"""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from src.main import app
from src.routers import instruments as instruments_router
from src.routers import market_data as market_data_router
from src.schemas.instruments import InstrumentListResponse, InstrumentResponse
from src.schemas.market_data import (
    OHLCVBar,
    OHLCVResponse,
    QuoteResponse,
)
from src.services.instrument_service import InstrumentService
from src.services.market_data_service import MarketDataService

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _ohlcv_bar(ts: datetime, close: float = 45000.0) -> OHLCVBar:
    return OHLCVBar(
        ts=ts,
        open=close,
        high=close,
        low=close,
        close=close,
        volume=100.0,
    )


def _ohlcv_response(symbol: str = "BITCOIN") -> OHLCVResponse:
    return OHLCVResponse(
        symbol=symbol,
        timeframe="1D",
        bars=[_ohlcv_bar(datetime(2024, 1, 1, tzinfo=UTC))],
        source="coingecko",
    )


def _instrument(symbol: str = "BITCOIN") -> InstrumentResponse:
    return InstrumentResponse(
        symbol=symbol,
        name="Bitcoin",
        asset_class="crypto",
        exchange=None,
        currency="USD",
        is_active=True,
    )


BASE_URL = "http://test"


# ---------------------------------------------------------------------------
# Market data endpoints
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_ohlcv_returns_200_with_bars() -> None:
    """GET /market-data/{symbol}/ohlcv returns 200 with correct OHLCVResponse shape."""
    expected = _ohlcv_response()
    mock_service = AsyncMock(spec=MarketDataService)
    mock_service.get_ohlcv.return_value = expected

    app.dependency_overrides[market_data_router._build_service] = lambda: mock_service
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url=BASE_URL
        ) as client:
            resp = await client.get("/api/v1/market-data/bitcoin/ohlcv")
    finally:
        app.dependency_overrides.pop(market_data_router._build_service, None)

    assert resp.status_code == 200
    data = resp.json()
    assert data["symbol"] == "BITCOIN"
    assert data["timeframe"] == "1D"
    assert len(data["bars"]) == 1
    assert data["source"] == "coingecko"


@pytest.mark.asyncio
async def test_get_ohlcv_passes_symbol_uppercased() -> None:
    """Symbol is uppercased before being passed to the service."""
    mock_service = AsyncMock(spec=MarketDataService)
    mock_service.get_ohlcv.return_value = _ohlcv_response("BITCOIN")

    app.dependency_overrides[market_data_router._build_service] = lambda: mock_service
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url=BASE_URL
        ) as client:
            await client.get("/api/v1/market-data/bitcoin/ohlcv")
    finally:
        app.dependency_overrides.pop(market_data_router._build_service, None)

    call_kwargs = mock_service.get_ohlcv.call_args
    assert call_kwargs.kwargs["symbol"] == "BITCOIN"


@pytest.mark.asyncio
async def test_get_quote_returns_200() -> None:
    """GET /market-data/{symbol}/quote returns 200 with QuoteResponse shape."""
    expected = QuoteResponse(
        symbol="BITCOIN",
        price=44000.0,
        change_24h=0.05,
        volume_24h=500.0,
        ts=datetime(2024, 1, 1, tzinfo=UTC),
    )
    mock_service = AsyncMock(spec=MarketDataService)
    mock_service.get_quote.return_value = expected

    app.dependency_overrides[market_data_router._build_service] = lambda: mock_service
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url=BASE_URL
        ) as client:
            resp = await client.get("/api/v1/market-data/bitcoin/quote")
    finally:
        app.dependency_overrides.pop(market_data_router._build_service, None)

    assert resp.status_code == 200
    data = resp.json()
    assert data["symbol"] == "BITCOIN"
    assert data["price"] == pytest.approx(44000.0)
    assert data["change_24h"] == pytest.approx(0.05)


@pytest.mark.asyncio
async def test_get_bulk_quotes_returns_200() -> None:
    """GET /market-data/bulk-quotes returns 200 with BulkQuotesResponse shape."""
    mock_service = AsyncMock(spec=MarketDataService)
    mock_service.get_bulk_quotes.return_value = {
        "BITCOIN": QuoteResponse(symbol="BITCOIN", price=44000.0),
        "ETHEREUM": QuoteResponse(symbol="ETHEREUM", price=2800.0),
    }

    app.dependency_overrides[market_data_router._build_service] = lambda: mock_service
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url=BASE_URL
        ) as client:
            resp = await client.get(
                "/api/v1/market-data/bulk-quotes",
                params={"symbols": ["bitcoin", "ethereum"]},
            )
    finally:
        app.dependency_overrides.pop(market_data_router._build_service, None)

    assert resp.status_code == 200
    data = resp.json()
    assert "BITCOIN" in data["quotes"]
    assert "ETHEREUM" in data["quotes"]


# ---------------------------------------------------------------------------
# Instruments endpoints
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_instruments_returns_200() -> None:
    """GET /instruments returns 200 with InstrumentListResponse shape."""
    expected = InstrumentListResponse(
        instruments=[_instrument()],
        total=1,
        limit=50,
        offset=0,
    )
    mock_service = AsyncMock(spec=InstrumentService)
    mock_service.list_instruments.return_value = expected

    app.dependency_overrides[instruments_router._build_service] = lambda: mock_service
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url=BASE_URL
        ) as client:
            resp = await client.get("/api/v1/instruments")
    finally:
        app.dependency_overrides.pop(instruments_router._build_service, None)

    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert len(data["instruments"]) == 1
    assert data["instruments"][0]["symbol"] == "BITCOIN"


@pytest.mark.asyncio
async def test_get_instrument_returns_200() -> None:
    """GET /instruments/{symbol} returns 200 when instrument exists."""
    mock_service = AsyncMock(spec=InstrumentService)
    mock_service.get_instrument.return_value = _instrument("BITCOIN")

    app.dependency_overrides[instruments_router._build_service] = lambda: mock_service
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url=BASE_URL
        ) as client:
            resp = await client.get("/api/v1/instruments/bitcoin")
    finally:
        app.dependency_overrides.pop(instruments_router._build_service, None)

    assert resp.status_code == 200
    data = resp.json()
    assert data["symbol"] == "BITCOIN"
    assert data["asset_class"] == "crypto"


@pytest.mark.asyncio
async def test_get_instrument_returns_404_when_not_found() -> None:
    """GET /instruments/{symbol} returns 404 when symbol does not exist."""
    mock_service = AsyncMock(spec=InstrumentService)
    mock_service.get_instrument.return_value = None

    app.dependency_overrides[instruments_router._build_service] = lambda: mock_service
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url=BASE_URL
        ) as client:
            resp = await client.get("/api/v1/instruments/UNKNOWNCOIN")
    finally:
        app.dependency_overrides.pop(instruments_router._build_service, None)

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_instruments_filters_by_asset_class() -> None:
    """asset_class query param is forwarded to the service."""
    mock_service = AsyncMock(spec=InstrumentService)
    mock_service.list_instruments.return_value = InstrumentListResponse(
        instruments=[], total=0, limit=50, offset=0
    )

    app.dependency_overrides[instruments_router._build_service] = lambda: mock_service
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url=BASE_URL
        ) as client:
            await client.get("/api/v1/instruments?asset_class=crypto")
    finally:
        app.dependency_overrides.pop(instruments_router._build_service, None)

    call_kwargs = mock_service.list_instruments.call_args
    assert call_kwargs.kwargs.get("asset_class") == "crypto"
