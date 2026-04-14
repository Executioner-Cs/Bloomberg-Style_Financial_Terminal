"""
Pydantic response schemas for the instruments endpoints.

These are the data contracts between the API and its consumers.
Fields match the PostgreSQL instruments table (Instrument ORM model).
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class InstrumentResponse(BaseModel):
    """A single instrument record."""

    symbol: str = Field(description="Ticker symbol. Examples: BTC, AAPL, EUR/USD.")
    name: str = Field(description="Human-readable instrument name.")
    asset_class: str = Field(
        description="Asset class: 'equity', 'crypto', 'fx', or 'macro'."
    )
    exchange: str | None = Field(
        default=None,
        description="Exchange identifier. Null for crypto and macro series.",
    )
    currency: str = Field(description="Denomination currency (ISO 4217). Default: USD.")
    is_active: bool = Field(description="False when delisted or no longer tracked.")


class InstrumentListResponse(BaseModel):
    """Response for GET /instruments."""

    instruments: list[InstrumentResponse] = Field(
        description="Page of instruments matching the query."
    )
    total: int = Field(description="Total matching instruments (for pagination).")
    limit: int = Field(description="Page size used in this response.")
    offset: int = Field(description="Offset used in this response.")
