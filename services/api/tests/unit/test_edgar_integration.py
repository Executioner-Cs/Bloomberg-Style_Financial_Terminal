"""
Unit tests for the EDGAR integration client.

All tests use httpx.MockTransport — zero real HTTP calls.
Tests cover: successful filing parse, missing date fields, unsupported form types.
"""

from __future__ import annotations

import json

import httpx
import pytest

from src.integrations.edgar import EDGARClient
from src.schemas.filings import Filing, FilingsResponse

# Agent string sourced from a named constant — never hardcoded in tests.
_TEST_USER_AGENT = "Bloomberg-Terminal-Test/1.0 test@example.com"
_TEST_TIMEOUT = 30.0


def _make_transport(status_code: int, body: object) -> httpx.MockTransport:
    content = json.dumps(body).encode()

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code, content=content)

    return httpx.MockTransport(handler)


def _make_efts_response(hits: list[dict[str, object]]) -> dict[str, object]:
    """Build a minimal EFTS-shaped response."""
    return {"hits": {"hits": hits, "total": {"value": len(hits)}}}


_SAMPLE_HIT: dict[str, object] = {
    "_id": "0000320193-24-000001",
    "_source": {
        "form_type": "10-K",
        "file_date": "2024-10-30T00:00:00Z",
        "period_of_report": "2024-09-28",
        "entity_id": "320193",
        "file_num": "0000320193-24-000001",
        "file_description": "Annual Report on Form 10-K",
    },
}


class TestEDGARClientGetRecentFilings:
    @pytest.fixture
    def client(self) -> EDGARClient:
        return EDGARClient(
            user_agent=_TEST_USER_AGENT,
            timeout_seconds=_TEST_TIMEOUT,
        )

    @pytest.mark.asyncio
    async def test_get_recent_filings_returns_filings_response(
        self, client: EDGARClient
    ) -> None:
        transport = _make_transport(200, _make_efts_response([_SAMPLE_HIT]))
        client._client = httpx.AsyncClient(
            base_url=client.base_url,
            transport=transport,
            headers=client._build_headers(),
        )

        result = await client.get_recent_filings("AAPL", form_types=["10-K"])

        assert isinstance(result, FilingsResponse)
        assert result.symbol == "AAPL"

    @pytest.mark.asyncio
    async def test_get_recent_filings_parses_filing(self, client: EDGARClient) -> None:
        transport = _make_transport(200, _make_efts_response([_SAMPLE_HIT]))
        client._client = httpx.AsyncClient(
            base_url=client.base_url,
            transport=transport,
            headers=client._build_headers(),
        )

        result = await client.get_recent_filings("AAPL", form_types=["10-K"])

        assert len(result.filings) == 1
        filing = result.filings[0]
        assert isinstance(filing, Filing)
        assert filing.symbol == "AAPL"
        assert filing.form_type == "10-K"
        assert filing.accession_number == "0000320193-24-000001"

    @pytest.mark.asyncio
    async def test_get_recent_filings_skips_missing_dates(
        self, client: EDGARClient
    ) -> None:
        hit_no_date: dict[str, object] = {
            "_id": "0000320193-24-000002",
            "_source": {
                "form_type": "10-Q",
                "file_date": None,
                "period_of_report": None,
                "entity_id": "320193",
                "file_num": "0000320193-24-000002",
            },
        }
        transport = _make_transport(200, _make_efts_response([hit_no_date]))
        client._client = httpx.AsyncClient(
            base_url=client.base_url,
            transport=transport,
            headers=client._build_headers(),
        )

        result = await client.get_recent_filings("AAPL", form_types=["10-Q"])

        assert result.total == 0
        assert len(result.filings) == 0

    @pytest.mark.asyncio
    async def test_get_recent_filings_raises_for_unsupported_form_type(
        self, client: EDGARClient
    ) -> None:
        with pytest.raises(ValueError, match="Unsupported form types"):
            await client.get_recent_filings("AAPL", form_types=["S-1"])

    @pytest.mark.asyncio
    async def test_get_recent_filings_empty_response(self, client: EDGARClient) -> None:
        transport = _make_transport(200, _make_efts_response([]))
        client._client = httpx.AsyncClient(
            base_url=client.base_url,
            transport=transport,
            headers=client._build_headers(),
        )

        result = await client.get_recent_filings("AAPL")

        assert len(result.filings) == 0
        assert result.total == 0

    def test_user_agent_header_is_set(self, client: EDGARClient) -> None:
        headers = client._build_headers()
        assert headers["User-Agent"] == _TEST_USER_AGENT
