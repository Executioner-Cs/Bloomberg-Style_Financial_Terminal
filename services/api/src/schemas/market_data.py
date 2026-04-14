"""
Pydantic response schemas for market data endpoints.

These are the data contracts between the API and its consumers.
Fields match what is stored in ClickHouse (OHLCVRow) and Redis (quote snapshots).
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class OHLCVBar(BaseModel):
    """A single OHLCV candlestick bar."""

    ts: datetime = Field(description="Bar open timestamp (UTC).")
    open: float = Field(description="Opening price.")
    high: float = Field(description="Highest price during the interval.")
    low: float = Field(description="Lowest price during the interval.")
    close: float = Field(description="Closing price.")
    volume: float = Field(description="Volume traded during the interval.")
    adj_close: float | None = Field(
        default=None,
        description="Adjusted close. Null for crypto (no corporate actions).",
    )


class OHLCVResponse(BaseModel):
    """Response for GET /market-data/{symbol}/ohlcv."""

    symbol: str = Field(description="Ticker symbol.")
    timeframe: str = Field(description="Candle interval, e.g. '1D', '4H'.")
    bars: list[OHLCVBar] = Field(
        description="Ordered list of OHLCV bars (oldest first)."
    )
    source: str = Field(description="Data provider that sourced these bars.")


class QuoteResponse(BaseModel):
    """Response for GET /market-data/{symbol}/quote."""

    symbol: str = Field(description="Ticker symbol.")
    price: float | None = Field(description="Latest close price. Null if no data yet.")
    change_24h: float | None = Field(
        default=None,
        description="24-hour price change as a decimal fraction. e.g. 0.03 = +3%.",
    )
    volume_24h: float | None = Field(
        default=None, description="24-hour cumulative volume."
    )
    ts: datetime | None = Field(
        default=None, description="Timestamp of the latest bar (UTC)."
    )


class BulkQuotesResponse(BaseModel):
    """Response for GET /market-data/bulk-quotes."""

    quotes: dict[str, QuoteResponse] = Field(
        description="Map of symbol → latest quote. Missing symbols are omitted."
    )
