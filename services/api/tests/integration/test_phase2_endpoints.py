"""
Integration smoke tests for the Phase 2 REST endpoints: /macro, /news, /filings.

Pattern: httpx.AsyncClient + ASGITransport + app.dependency_overrides to
substitute the service layer. This exercises real FastAPI routing,
path/query validation, and response serialisation without touching Redis
or ClickHouse — matching the existing market_data integration test style.

These are *smoke* tests: one happy path per endpoint plus the 422 guards
that the router itself enforces. Full behavioural coverage lives in the
per-service unit tests.
"""

from __future__ import annotations

from datetime import UTC, date, datetime
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from src.main import app
from src.routers import filings as filings_router
from src.routers import macro as macro_router
from src.routers import news as news_router
from src.schemas.filings import Filing, FilingsResponse
from src.schemas.macro import (
    MacroBar,
    MacroSeriesListResponse,
    MacroSeriesMeta,
    MacroSeriesResponse,
)
from src.schemas.news import NewsArticle, NewsResponse
from src.services.filings_service import FilingsService
from src.services.macro_service import MacroService
from src.services.news_service import NewsService

BASE_URL = "https://test"


# ---------------------------------------------------------------------------
# Fixture builders
# ---------------------------------------------------------------------------


def _macro_series_response(series_id: str = "GDP") -> MacroSeriesResponse:
    return MacroSeriesResponse(
        series_id=series_id,
        name="Gross Domestic Product",
        unit="Billions of Dollars",
        bars=[MacroBar(ts=datetime(2024, 1, 1, tzinfo=UTC), value=27000.0)],
        source="fred",
    )


def _macro_list_response() -> MacroSeriesListResponse:
    return MacroSeriesListResponse(
        series=[
            MacroSeriesMeta(
                series_id="GDP",
                name="Gross Domestic Product",
                unit="Billions of Dollars",
                latest_value=27000.0,
                latest_ts=datetime(2024, 1, 1, tzinfo=UTC),
            )
        ]
    )


def _news_response(symbol: str | None = None) -> NewsResponse:
    return NewsResponse(
        articles=[
            NewsArticle(
                title="Apple beats Q1 estimates",
                description=None,
                url="https://example.com/article",
                published_at=datetime(2024, 1, 15, 14, 30, tzinfo=UTC),
                source_name="Reuters",
                symbol=symbol,
            )
        ],
        total=1,
        page=1,
    )


def _filings_response(symbol: str = "AAPL") -> FilingsResponse:
    return FilingsResponse(
        symbol=symbol,
        filings=[
            Filing(
                symbol=symbol,
                form_type="10-K",
                filed_at=datetime(2024, 1, 1, tzinfo=UTC),
                period_of_report=date(2023, 9, 30),
                accession_number="0000320193-24-000001",
                filing_url="https://www.sec.gov/...",
                description=None,
            )
        ],
        total=1,
    )


# ---------------------------------------------------------------------------
# Macro endpoints
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_macro_series_returns_200() -> None:
    """GET /macro returns 200 with MacroSeriesListResponse shape."""
    mock_service = AsyncMock(spec=MacroService)
    mock_service.list_series.return_value = _macro_list_response()

    app.dependency_overrides[macro_router._build_service] = lambda: mock_service
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url=BASE_URL
        ) as client:
            resp = await client.get("/api/v1/macro")
    finally:
        app.dependency_overrides.pop(macro_router._build_service, None)

    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data["series"], list)
    assert data["series"][0]["series_id"] == "GDP"


@pytest.mark.asyncio
async def test_get_macro_series_returns_200_with_bars() -> None:
    """GET /macro/{series_id} returns 200 with MacroSeriesResponse shape."""
    mock_service = AsyncMock(spec=MacroService)
    mock_service.get_series.return_value = _macro_series_response("GDP")

    app.dependency_overrides[macro_router._build_service] = lambda: mock_service
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url=BASE_URL
        ) as client:
            resp = await client.get("/api/v1/macro/GDP")
    finally:
        app.dependency_overrides.pop(macro_router._build_service, None)

    assert resp.status_code == 200
    data = resp.json()
    assert data["series_id"] == "GDP"
    assert len(data["bars"]) == 1
    assert data["source"] == "fred"


@pytest.mark.asyncio
async def test_get_macro_series_rejects_invalid_series_id() -> None:
    """Lowercase/bad characters in series_id must fail path validation with 422.

    The service dependency is still overridden so FastAPI's dep resolver
    doesn't try to open a real ClickHouse connection before returning 422.
    """
    mock_service = AsyncMock(spec=MacroService)

    app.dependency_overrides[macro_router._build_service] = lambda: mock_service
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url=BASE_URL
        ) as client:
            resp = await client.get("/api/v1/macro/not-a-series")
    finally:
        app.dependency_overrides.pop(macro_router._build_service, None)

    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_get_macro_series_rejects_invalid_date_format() -> None:
    """Malformed `from` query param returns 422 with explanatory detail."""
    mock_service = AsyncMock(spec=MacroService)

    app.dependency_overrides[macro_router._build_service] = lambda: mock_service
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url=BASE_URL
        ) as client:
            resp = await client.get("/api/v1/macro/GDP", params={"from": "not-a-date"})
    finally:
        app.dependency_overrides.pop(macro_router._build_service, None)

    assert resp.status_code == 422
    assert "Invalid date format" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# News endpoints
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_news_returns_200() -> None:
    """GET /news returns 200 with NewsResponse shape."""
    mock_service = AsyncMock(spec=NewsService)
    mock_service.get_top_headlines.return_value = _news_response()

    app.dependency_overrides[news_router._build_service] = lambda: mock_service
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url=BASE_URL
        ) as client:
            resp = await client.get("/api/v1/news", params={"q": "AI chips", "page": 1})
    finally:
        app.dependency_overrides.pop(news_router._build_service, None)

    assert resp.status_code == 200
    data = resp.json()
    assert data["page"] == 1
    assert data["total"] == 1
    assert len(data["articles"]) == 1


@pytest.mark.asyncio
async def test_get_symbol_news_uppercases_symbol() -> None:
    """GET /news/{symbol} returns 200 and uppercases the symbol before service call."""
    mock_service = AsyncMock(spec=NewsService)
    mock_service.get_symbol_news.return_value = _news_response(symbol="AAPL")

    app.dependency_overrides[news_router._build_service] = lambda: mock_service
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url=BASE_URL
        ) as client:
            resp = await client.get("/api/v1/news/aapl")
    finally:
        app.dependency_overrides.pop(news_router._build_service, None)

    assert resp.status_code == 200
    assert mock_service.get_symbol_news.call_args.kwargs["symbol"] == "AAPL"


@pytest.mark.asyncio
async def test_list_news_rejects_oversized_page() -> None:
    """`page > 20` must fail query validation with 422 — respects NewsAPI budget."""
    mock_service = AsyncMock(spec=NewsService)

    app.dependency_overrides[news_router._build_service] = lambda: mock_service
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url=BASE_URL
        ) as client:
            resp = await client.get("/api/v1/news", params={"page": 21})
    finally:
        app.dependency_overrides.pop(news_router._build_service, None)

    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Filings endpoints
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_filings_returns_200() -> None:
    """GET /filings/{symbol} returns 200 with FilingsResponse shape."""
    mock_service = AsyncMock(spec=FilingsService)
    mock_service.get_filings.return_value = _filings_response("AAPL")

    app.dependency_overrides[filings_router._build_service] = lambda: mock_service
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url=BASE_URL
        ) as client:
            resp = await client.get("/api/v1/filings/aapl")
    finally:
        app.dependency_overrides.pop(filings_router._build_service, None)

    assert resp.status_code == 200
    data = resp.json()
    assert data["symbol"] == "AAPL"
    assert data["total"] == 1
    assert data["filings"][0]["form_type"] == "10-K"
    # Router uppercases the symbol before handing to the service.
    assert mock_service.get_filings.call_args.kwargs["symbol"] == "AAPL"


@pytest.mark.asyncio
async def test_get_filings_rejects_unsupported_form_type() -> None:
    """`form_type=S-1` is not in SUPPORTED_FORM_TYPES — router must 422."""
    mock_service = AsyncMock(spec=FilingsService)

    app.dependency_overrides[filings_router._build_service] = lambda: mock_service
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url=BASE_URL
        ) as client:
            resp = await client.get("/api/v1/filings/AAPL", params={"form_type": "S-1"})
    finally:
        app.dependency_overrides.pop(filings_router._build_service, None)

    assert resp.status_code == 422
    assert "Unsupported form_type" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_get_filings_forwards_form_type_filter() -> None:
    """`form_type=10-Q` is forwarded to the service kwarg unchanged."""
    mock_service = AsyncMock(spec=FilingsService)
    mock_service.get_filings.return_value = _filings_response("MSFT")

    app.dependency_overrides[filings_router._build_service] = lambda: mock_service
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url=BASE_URL
        ) as client:
            resp = await client.get(
                "/api/v1/filings/MSFT", params={"form_type": "10-Q"}
            )
    finally:
        app.dependency_overrides.pop(filings_router._build_service, None)

    assert resp.status_code == 200
    assert mock_service.get_filings.call_args.kwargs["form_type"] == "10-Q"
