"""
Pydantic response schemas for macro data endpoints.

These are the data contracts between the API and its consumers.
Fields match what is stored in ClickHouse (MacroRow).
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

# FRED series metadata: human-readable units for each series ID.
# Sourced from FRED documentation — never hardcoded in business logic.
FRED_SERIES_UNITS: dict[str, str] = {
    "GDP": "Billions of Dollars",
    "CPIAUCSL": "Index 1982-1984=100",
    "FEDFUNDS": "Percent",
    "DGS10": "Percent",
    "UNRATE": "Percent",
}

FRED_SERIES_NAMES: dict[str, str] = {
    "GDP": "Gross Domestic Product",
    "CPIAUCSL": "Consumer Price Index for All Urban Consumers",
    "FEDFUNDS": "Federal Funds Effective Rate",
    "DGS10": "Market Yield on U.S. Treasury Securities at 10-Year Constant Maturity",
    "UNRATE": "Unemployment Rate",
}


class MacroBar(BaseModel):
    """A single macro series observation."""

    ts: datetime = Field(description="Observation date (UTC).")
    value: float = Field(description="Observation value. Units depend on the series.")


class MacroSeriesResponse(BaseModel):
    """Response for GET /macro/{series_id}."""

    series_id: str = Field(
        description="FRED series identifier, e.g. 'GDP', 'CPIAUCSL'."
    )
    name: str = Field(description="Human-readable series name.")
    unit: str = Field(
        description="Measurement unit, e.g. 'Percent', 'Billions of Dollars'."
    )
    bars: list[MacroBar] = Field(description="Ordered observations (oldest first).")
    source: str = Field(description="Data provider that sourced these observations.")


class MacroSeriesMeta(BaseModel):
    """Metadata for a single macro series (no bar data)."""

    series_id: str = Field(description="FRED series identifier.")
    name: str = Field(description="Human-readable series name.")
    unit: str = Field(description="Measurement unit.")
    latest_value: float | None = Field(
        default=None, description="Most recent observation value."
    )
    latest_ts: datetime | None = Field(
        default=None, description="Most recent observation date (UTC)."
    )


class MacroSeriesListResponse(BaseModel):
    """Response for GET /macro/ — all available macro series metadata."""

    series: list[MacroSeriesMeta] = Field(description="List of available macro series.")
