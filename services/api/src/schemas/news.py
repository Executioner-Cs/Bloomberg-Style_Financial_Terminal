"""
Pydantic response schemas for news endpoints.

These are the data contracts between the API and its consumers.
Source: NewsAPI free tier (100 req/day) — ADR-005.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class NewsArticle(BaseModel):
    """A single news article."""

    title: str = Field(description="Article headline.")
    description: str | None = Field(
        default=None, description="Short article summary. May be null for some sources."
    )
    url: str = Field(description="Canonical URL to the full article.")
    published_at: datetime = Field(description="Publication timestamp (UTC).")
    source_name: str = Field(description="Publisher name, e.g. 'Reuters', 'Bloomberg'.")
    symbol: str | None = Field(
        default=None,
        description=(
            "Ticker symbol this article was fetched for. Null for general news."
        ),
    )


class NewsResponse(BaseModel):
    """Response for GET /news/."""

    articles: list[NewsArticle] = Field(description="List of articles, newest first.")
    total: int = Field(description="Total number of matching articles.")
    page: int = Field(description="Current page number (1-indexed).")
