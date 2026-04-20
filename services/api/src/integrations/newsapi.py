"""
NewsAPI integration client.

Data source: NewsAPI.org — free tier: 100 req/day, development use only.
Terms: https://newsapi.org/terms — no republishing raw article content.
ADR-005: NewsAPI approved as the news data source.

Cache TTL: settings.news_cache_ttl_seconds (300s = 5 min default).
Rationale: 100 req/day budget; 5-min cache limits daily calls to ~288 maximum.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime

import httpx

from src.integrations.base import BaseIntegrationClient, IntegrationError
from src.schemas.news import NewsArticle, NewsResponse

logger = logging.getLogger(__name__)

# NewsAPI base URL — source: https://newsapi.org/docs/endpoints
_NEWSAPI_BASE_URL = "https://newsapi.org"

# Default page size for top-headlines endpoint. NewsAPI max is 100.
# 20 is the NewsAPI default — we use it unless overridden.
_DEFAULT_PAGE_SIZE = 20

# Maximum page size allowed by NewsAPI free tier.
# Source: https://newsapi.org/docs/endpoints/top-headlines
_MAX_PAGE_SIZE = 100


class NewsAPIClient(BaseIntegrationClient):
    """
    NewsAPI.org client — fetches top headlines and symbol-specific news.

    Subclasses BaseIntegrationClient for retry, backoff, and timeout handling.
    API key is sent via the X-Api-Key header per NewsAPI documentation.
    """

    provider_name = "newsapi"
    base_url = _NEWSAPI_BASE_URL

    def __init__(self, api_key: str, timeout_seconds: float, user_agent: str) -> None:
        # All params sourced from settings — never hardcoded. ADR-005.
        super().__init__(api_key=api_key)
        self._timeout_seconds = timeout_seconds
        self._user_agent = user_agent

    def _build_headers(self) -> dict[str, str]:
        """
        Override to inject X-Api-Key header.

        NewsAPI accepts the key as a header or query param; header is preferred
        per their documentation as it avoids key exposure in server logs.
        """
        return {
            "User-Agent": self._user_agent,
            "Accept": "application/json",
            "X-Api-Key": self._api_key or "",
        }

    def _get_client(self) -> httpx.AsyncClient:
        """Override to apply the configured timeout from settings."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                headers=self._build_headers(),
                timeout=httpx.Timeout(self._timeout_seconds),
                follow_redirects=True,
            )
        return self._client

    @staticmethod
    def _parse_published_at(raw: str | None) -> datetime | None:
        """Parse ISO-8601 datetime string from NewsAPI into a UTC-aware datetime."""
        if not raw:
            return None
        try:
            dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=UTC)
            return dt
        except ValueError:
            logger.debug("Could not parse NewsAPI datetime: %r", raw)
            return None

    def _article_from_raw(
        self, raw: dict[str, object], symbol: str | None = None
    ) -> NewsArticle | None:
        """
        Convert a raw NewsAPI article dict to a NewsArticle schema.

        Returns None if mandatory fields (title, url, publishedAt) are missing.
        NewsAPI sometimes returns removed articles with '[Removed]' fields.
        """
        title_raw = raw.get("title")
        url_raw = raw.get("url")
        published_raw = raw.get("publishedAt")

        # isinstance narrowing required: raw values are `object`, not str.
        if not isinstance(title_raw, str) or not isinstance(url_raw, str) or not isinstance(published_raw, str):
            return None

        # NewsAPI marks removed articles with literal "[Removed]" values.
        if title_raw == "[Removed]" or url_raw == "[Removed]":
            return None

        published_at = self._parse_published_at(published_raw)
        if published_at is None:
            return None

        source_raw = raw.get("source", {})
        source: dict[str, object] = source_raw if isinstance(source_raw, dict) else {}
        source_name_val = source.get("name")
        source_name: str = source_name_val if isinstance(source_name_val, str) else "Unknown"

        description_raw = raw.get("description")
        description: str | None = description_raw if isinstance(description_raw, str) else None

        return NewsArticle(
            title=title_raw,
            description=description,
            url=url_raw,
            published_at=published_at,
            source_name=source_name,
            symbol=symbol,
        )

    async def get_top_headlines(
        self,
        query: str | None = None,
        symbol: str | None = None,
        page: int = 1,
        page_size: int = _DEFAULT_PAGE_SIZE,
        language: str = "en",
    ) -> NewsResponse:
        """
        Fetch top headlines from NewsAPI.

        Args:
            query: Free-text search query. If None, fetches general business news.
            symbol: Ticker symbol to attach to returned articles (metadata only).
            page: 1-indexed page number. NewsAPI supports pagination via page param.
            page_size: Articles per page. Capped at _MAX_PAGE_SIZE.
            language: ISO 639-1 language code. NewsAPI free tier only supports "en".

        Returns:
            NewsResponse with articles sorted newest-first.
        """
        if page_size > _MAX_PAGE_SIZE:
            page_size = _MAX_PAGE_SIZE

        params: dict[str, str | int] = {
            "language": language,
            "page": page,
            "pageSize": page_size,
        }
        if query:
            params["q"] = query
        else:
            # Default to business category when no query is given.
            params["category"] = "business"

        raw_response = await self.get("/v2/top-headlines", params=params)
        if not isinstance(raw_response, dict):
            raise IntegrationError(self.provider_name, 0, "Unexpected response shape from NewsAPI")
        data: dict[str, object] = raw_response

        articles: list[NewsArticle] = []
        raw_articles = data.get("articles", [])
        article_list = raw_articles if isinstance(raw_articles, list) else []
        for raw_article in article_list:
            if not isinstance(raw_article, dict):
                continue
            article = self._article_from_raw(raw_article, symbol=symbol)
            if article is not None:
                articles.append(article)

        total_raw = data.get("totalResults", len(articles))
        total: int = total_raw if isinstance(total_raw, int) else len(articles)

        return NewsResponse(articles=articles, total=total, page=page)

    async def get_symbol_news(
        self,
        symbol: str,
        company_name: str | None = None,
        page: int = 1,
        page_size: int = _DEFAULT_PAGE_SIZE,
    ) -> NewsResponse:
        """
        Fetch news articles relevant to a specific ticker symbol.

        Searches for the symbol itself and optionally the company name.
        NewsAPI /everything endpoint is not available on free tier — we use
        /top-headlines with a query, which is free-tier compatible.

        Args:
            symbol: Ticker symbol, e.g. "AAPL".
            company_name: Optional company name to include in query, e.g. "Apple".
            page: 1-indexed page number.
            page_size: Articles per page.
        """
        query = f"{symbol} {company_name}" if company_name else symbol
        return await self.get_top_headlines(
            query=query, symbol=symbol, page=page, page_size=page_size
        )
