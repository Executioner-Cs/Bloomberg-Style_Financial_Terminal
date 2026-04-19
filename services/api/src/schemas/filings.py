"""
Pydantic response schemas for SEC EDGAR filings endpoints.

These are the data contracts between the API and its consumers.
Source: SEC EDGAR full-text search API — ADR-005 (unlimited, no key required).
SEC ToS: https://www.sec.gov/developer — User-Agent header required.
"""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field

# Supported filing form types — Phase 1 scope.
# Source: SEC EDGAR form type taxonomy. Additions require updating this list.
SUPPORTED_FORM_TYPES: frozenset[str] = frozenset({"10-K", "10-Q", "8-K"})


class Filing(BaseModel):
    """A single SEC filing."""

    symbol: str = Field(description="Ticker symbol this filing belongs to.")
    form_type: str = Field(
        description="Filing form type. One of: '10-K', '10-Q', '8-K'."
    )
    filed_at: datetime = Field(
        description="Date and time the filing was submitted (UTC)."
    )
    period_of_report: date = Field(
        description="Period covered by the filing (fiscal year end or quarter end)."
    )
    accession_number: str = Field(
        description="EDGAR accession number, e.g. '0000320193-23-000106'."
    )
    filing_url: str = Field(description="Full URL to the EDGAR filing index page.")
    description: str | None = Field(
        default=None,
        description="Optional short description extracted from the filing header.",
    )


class FilingsResponse(BaseModel):
    """Response for GET /filings/{symbol}."""

    symbol: str = Field(description="Ticker symbol.")
    filings: list[Filing] = Field(description="List of filings, newest first.")
    total: int = Field(description="Total matching filings count.")
