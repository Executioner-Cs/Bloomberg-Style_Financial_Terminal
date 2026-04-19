"""
Unit tests for the NewsAPI integration client.

All tests use httpx.MockTransport — zero real HTTP calls.
Tests cover: article parsing, [Removed] filtering, bad datetime, empty response,
pagination, and symbol news delegation.
"""

from __future__ import annotations

import json
from datetime import datetime

import httpx
import pytest

from src.integrations.newsapi import NewsAPIClient
from src.schemas.news import NewsArticle, NewsResponse

_TEST_API_KEY = "test-newsapi-key"
_TEST_TIMEOUT = 15.0
_TEST_USER_AGENT = "Bloomberg-Terminal/1.0 test@example.com"


def _make_transport(status_code: int, body: object) -> httpx.MockTransport:
    content = json.dumps(body).encode()

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code, content=content)

    return httpx.MockTransport(handler)


def _make_article(
    title: str = "Market rally continues",
    url: str = "https://example.com/article",
    published_at: str = "2024-10-30T12:00:00Z",
    source_name: str = "Reuters",
) -> dict[str, object]:
    return {
        "title": title,
        "description": "A description.",
        "url": url,
        "publishedAt": published_at,
        "source": {"name": source_name},
    }


def _make_response(
    articles: list[dict[str, object]], total: int = 0
) -> dict[str, object]:
    return {
        "status": "ok",
        "totalResults": total or len(articles),
        "articles": articles,
    }


@pytest.fixture
def client() -> NewsAPIClient:
    return NewsAPIClient(
        api_key=_TEST_API_KEY,
        timeout_seconds=_TEST_TIMEOUT,
        user_agent=_TEST_USER_AGENT,
    )


def _inject_transport(client: NewsAPIClient, transport: httpx.MockTransport) -> None:
    client._client = httpx.AsyncClient(
        base_url=client.base_url,
        transport=transport,
        headers=client._build_headers(),
    )


class TestNewsAPIClientArticleParsing:
    @pytest.mark.asyncio
    async def test_get_headlines_returns_news_response(
        self, client: NewsAPIClient
    ) -> None:
        transport = _make_transport(200, _make_response([_make_article()]))
        _inject_transport(client, transport)

        result = await client.get_top_headlines()

        assert isinstance(result, NewsResponse)
        assert len(result.articles) == 1

    @pytest.mark.asyncio
    async def test_get_headlines_parses_article_fields(
        self, client: NewsAPIClient
    ) -> None:
        transport = _make_transport(200, _make_response([_make_article()]))
        _inject_transport(client, transport)

        result = await client.get_top_headlines()
        article = result.articles[0]

        assert isinstance(article, NewsArticle)
        assert article.title == "Market rally continues"
        assert article.url == "https://example.com/article"
        assert article.source_name == "Reuters"
        assert isinstance(article.published_at, datetime)

    @pytest.mark.asyncio
    async def test_get_headlines_attaches_symbol(self, client: NewsAPIClient) -> None:
        transport = _make_transport(200, _make_response([_make_article()]))
        _inject_transport(client, transport)

        result = await client.get_top_headlines(query="AAPL", symbol="AAPL")
        assert result.articles[0].symbol == "AAPL"

    @pytest.mark.asyncio
    async def test_get_headlines_filters_removed_articles(
        self, client: NewsAPIClient
    ) -> None:
        removed = _make_article(title="[Removed]", url="[Removed]")
        normal = _make_article()
        transport = _make_transport(200, _make_response([removed, normal]))
        _inject_transport(client, transport)

        result = await client.get_top_headlines()

        assert len(result.articles) == 1
        assert result.articles[0].title == "Market rally continues"

    @pytest.mark.asyncio
    async def test_get_headlines_skips_missing_title(
        self, client: NewsAPIClient
    ) -> None:
        bad = _make_article()
        bad.pop("title")  # type: ignore[attr-defined]
        transport = _make_transport(200, _make_response([bad]))
        _inject_transport(client, transport)

        result = await client.get_top_headlines()
        assert len(result.articles) == 0

    @pytest.mark.asyncio
    async def test_get_headlines_empty_response(self, client: NewsAPIClient) -> None:
        transport = _make_transport(200, _make_response([]))
        _inject_transport(client, transport)

        result = await client.get_top_headlines()
        assert result.articles == []
        assert result.total == 0

    @pytest.mark.asyncio
    async def test_get_headlines_page_number_reflected(
        self, client: NewsAPIClient
    ) -> None:
        transport = _make_transport(200, _make_response([]))
        _inject_transport(client, transport)

        result = await client.get_top_headlines(page=3)
        assert result.page == 3

    @pytest.mark.asyncio
    async def test_get_headlines_caps_page_size(self, client: NewsAPIClient) -> None:
        """page_size > 100 should be capped to 100 — no error raised."""
        transport = _make_transport(200, _make_response([]))
        _inject_transport(client, transport)
        # Should not raise — capped silently.
        result = await client.get_top_headlines(page_size=999)
        assert isinstance(result, NewsResponse)


class TestNewsAPIClientParsePublishedAt:
    def test_parse_valid_z_suffix(self, client: NewsAPIClient) -> None:
        dt = client._parse_published_at("2024-10-30T12:00:00Z")
        assert dt is not None
        assert dt.tzinfo is not None

    def test_parse_none_returns_none(self, client: NewsAPIClient) -> None:
        assert client._parse_published_at(None) is None

    def test_parse_empty_string_returns_none(self, client: NewsAPIClient) -> None:
        assert client._parse_published_at("") is None

    def test_parse_invalid_returns_none(self, client: NewsAPIClient) -> None:
        assert client._parse_published_at("not-a-date") is None


class TestNewsAPIClientGetSymbolNews:
    @pytest.mark.asyncio
    async def test_get_symbol_news_delegates_to_headlines(
        self, client: NewsAPIClient
    ) -> None:
        transport = _make_transport(200, _make_response([_make_article()]))
        _inject_transport(client, transport)

        result = await client.get_symbol_news("AAPL", company_name="Apple")

        assert isinstance(result, NewsResponse)
        assert result.articles[0].symbol == "AAPL"

    @pytest.mark.asyncio
    async def test_get_symbol_news_no_company_name(self, client: NewsAPIClient) -> None:
        transport = _make_transport(200, _make_response([_make_article()]))
        _inject_transport(client, transport)

        result = await client.get_symbol_news("MSFT")
        assert isinstance(result, NewsResponse)


class TestNewsAPIClientHeaders:
    def test_x_api_key_header_is_set(self, client: NewsAPIClient) -> None:
        headers = client._build_headers()
        assert headers["X-Api-Key"] == _TEST_API_KEY

    def test_x_api_key_empty_when_no_key(self) -> None:
        no_key_client = NewsAPIClient(
            api_key="", timeout_seconds=_TEST_TIMEOUT, user_agent=_TEST_USER_AGENT
        )
        headers = no_key_client._build_headers()
        assert headers["X-Api-Key"] == ""
