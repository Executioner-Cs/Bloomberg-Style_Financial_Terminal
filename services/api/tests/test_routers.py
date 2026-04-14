"""
Router smoke tests — health, middleware, and stub endpoint shape.

Phase 1: instruments and market-data routers are wired to real services.
Those endpoints are fully tested in tests/integration/test_market_data_endpoints.py.
This file covers health, request ID middleware, and stub-only routers.
"""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from src.main import app
from src.routers import instruments as instruments_router
from src.routers import market_data as market_data_router
from src.schemas.instruments import InstrumentListResponse, InstrumentResponse
from src.schemas.market_data import OHLCVResponse, QuoteResponse
from src.services.instrument_service import InstrumentService
from src.services.market_data_service import MarketDataService


@pytest.fixture
async def client() -> AsyncClient:  # type: ignore[misc]
    """Async HTTP client wired to the ASGI app — no real server started."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="https://test",
    ) as ac:
        yield ac


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_health_returns_ok(client: AsyncClient) -> None:
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["dependencies"]["postgres"] == "ok"
    assert data["dependencies"]["clickhouse"] == "ok"
    assert data["dependencies"]["redis"] == "ok"


# ---------------------------------------------------------------------------
# Request ID middleware
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_request_id_echoed_when_provided(client: AsyncClient) -> None:
    """Middleware must echo back the client-supplied X-Request-ID."""
    response = await client.get("/health", headers={"X-Request-ID": "fixed-id-abc"})
    assert response.headers["X-Request-ID"] == "fixed-id-abc"


@pytest.mark.asyncio
async def test_request_id_generated_when_absent(client: AsyncClient) -> None:
    """Middleware must generate a UUID request ID when none is provided."""
    response = await client.get("/health")
    request_id = response.headers.get("X-Request-ID", "")
    assert len(request_id) > 0


# ---------------------------------------------------------------------------
# Instruments — now wired to service (uses dependency_overrides for isolation)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_instruments_pagination_params() -> None:
    """limit/offset query params are forwarded to the service layer."""
    mock_service = AsyncMock(spec=InstrumentService)
    mock_service.list_instruments.return_value = InstrumentListResponse(
        instruments=[], total=0, limit=10, offset=20
    )
    app.dependency_overrides[instruments_router._build_service] = lambda: mock_service
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="https://test"
        ) as ac:
            response = await ac.get("/api/v1/instruments?limit=10&offset=20")
    finally:
        app.dependency_overrides.pop(instruments_router._build_service, None)

    assert response.status_code == 200
    data = response.json()
    assert data["limit"] == 10
    assert data["offset"] == 20


@pytest.mark.asyncio
async def test_get_instrument_by_symbol() -> None:
    """GET /instruments/{symbol} routes correctly and returns instrument shape."""
    mock_service = AsyncMock(spec=InstrumentService)
    mock_service.get_instrument.return_value = InstrumentResponse(
        symbol="AAPL",
        name="Apple Inc.",
        asset_class="equity",
        exchange="NASDAQ",
        currency="USD",
        is_active=True,
    )
    app.dependency_overrides[instruments_router._build_service] = lambda: mock_service
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="https://test"
        ) as ac:
            response = await ac.get("/api/v1/instruments/AAPL")
    finally:
        app.dependency_overrides.pop(instruments_router._build_service, None)

    assert response.status_code == 200
    assert response.json()["symbol"] == "AAPL"


# ---------------------------------------------------------------------------
# Market data — now wired to service (uses dependency_overrides for isolation)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_ohlcv_returns_symbol_and_timeframe() -> None:
    """GET /market-data/{symbol}/ohlcv returns correct symbol/timeframe fields."""
    mock_service = AsyncMock(spec=MarketDataService)
    mock_service.get_ohlcv.return_value = OHLCVResponse(
        symbol="AAPL", timeframe="1D", bars=[], source="test"
    )
    app.dependency_overrides[market_data_router._build_service] = lambda: mock_service
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="https://test"
        ) as ac:
            response = await ac.get("/api/v1/market-data/AAPL/ohlcv?timeframe=1D")
    finally:
        app.dependency_overrides.pop(market_data_router._build_service, None)

    assert response.status_code == 200
    data = response.json()
    assert data["symbol"] == "AAPL"
    assert data["timeframe"] == "1D"


@pytest.mark.asyncio
async def test_get_quote_returns_symbol() -> None:
    """GET /market-data/{symbol}/quote returns correct symbol field."""
    mock_service = AsyncMock(spec=MarketDataService)
    mock_service.get_quote.return_value = QuoteResponse(symbol="BTCUSD", price=None)
    app.dependency_overrides[market_data_router._build_service] = lambda: mock_service
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="https://test"
        ) as ac:
            response = await ac.get("/api/v1/market-data/BTCUSD/quote")
    finally:
        app.dependency_overrides.pop(market_data_router._build_service, None)

    assert response.status_code == 200
    assert response.json()["symbol"] == "BTCUSD"


@pytest.mark.asyncio
async def test_get_bulk_quotes_returns_quotes_map() -> None:
    """GET /market-data/bulk-quotes returns quotes dict."""
    mock_service = AsyncMock(spec=MarketDataService)
    mock_service.get_bulk_quotes.return_value = {}
    app.dependency_overrides[market_data_router._build_service] = lambda: mock_service
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="https://test"
        ) as ac:
            response = await ac.get(
                "/api/v1/market-data/bulk-quotes?symbols=AAPL&symbols=MSFT"
            )
    finally:
        app.dependency_overrides.pop(market_data_router._build_service, None)

    assert response.status_code == 200
    assert "quotes" in response.json()


# ---------------------------------------------------------------------------
# Stub routers (all return empty lists until Phase 4+)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_alerts_stub(client: AsyncClient) -> None:
    response = await client.get("/api/v1/alerts")
    assert response.status_code == 200
    assert response.json()["alerts"] == []


@pytest.mark.asyncio
async def test_list_filings_stub(client: AsyncClient) -> None:
    response = await client.get("/api/v1/filings")
    assert response.status_code == 200
    assert response.json()["filings"] == []


@pytest.mark.asyncio
async def test_list_news_stub(client: AsyncClient) -> None:
    response = await client.get("/api/v1/news")
    assert response.status_code == 200
    assert response.json()["news"] == []


@pytest.mark.asyncio
async def test_list_screener_stub(client: AsyncClient) -> None:
    response = await client.get("/api/v1/screener")
    assert response.status_code == 200
    assert response.json()["screener"] == []
