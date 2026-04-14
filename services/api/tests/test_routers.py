"""
Router tests — verifies every stub endpoint returns the expected shape.

All routes in Phase 0 are stubs (no DB, no cache). These tests:
  - Confirm the route exists and returns HTTP 200
  - Confirm the response payload matches the documented contract shape
  - Confirm RequestIDMiddleware injects X-Request-ID on every response
"""
from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from src.main import app


@pytest.fixture
async def client() -> AsyncClient:  # type: ignore[misc]
    """Async HTTP client wired to the ASGI app — no real server started."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
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
# Instruments
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_instruments_empty_stub(client: AsyncClient) -> None:
    response = await client.get("/api/v1/instruments")
    assert response.status_code == 200
    data = response.json()
    assert data["instruments"] == []
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_list_instruments_pagination_params(client: AsyncClient) -> None:
    response = await client.get("/api/v1/instruments?limit=10&offset=20")
    assert response.status_code == 200
    data = response.json()
    assert data["limit"] == 10
    assert data["offset"] == 20


@pytest.mark.asyncio
async def test_get_instrument_by_symbol(client: AsyncClient) -> None:
    response = await client.get("/api/v1/instruments/AAPL")
    assert response.status_code == 200
    assert response.json()["symbol"] == "AAPL"


# ---------------------------------------------------------------------------
# Market data
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_ohlcv_returns_symbol_and_empty_bars(client: AsyncClient) -> None:
    response = await client.get("/api/v1/market-data/AAPL/ohlcv?timeframe=1D")
    assert response.status_code == 200
    data = response.json()
    assert data["symbol"] == "AAPL"
    assert data["timeframe"] == "1D"
    assert data["bars"] == []


@pytest.mark.asyncio
async def test_get_quote_returns_symbol(client: AsyncClient) -> None:
    response = await client.get("/api/v1/market-data/BTCUSD/quote")
    assert response.status_code == 200
    assert response.json()["symbol"] == "BTCUSD"


@pytest.mark.asyncio
async def test_get_bulk_quotes_returns_empty_map(client: AsyncClient) -> None:
    response = await client.get("/api/v1/market-data/bulk-quotes?symbols=AAPL&symbols=MSFT")
    assert response.status_code == 200
    assert response.json() == {"quotes": {}}


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
