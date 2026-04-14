"""
Unit tests for ORM and dataclass models.

Validates field types, constraints, and the OHLCVRow serialisation helper.
No database connection required — these test the Python model definitions only.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest

from src.models.ch.ohlcv import OHLCVRow
from src.models.pg.instrument import Instrument


# ---------------------------------------------------------------------------
# OHLCVRow dataclass
# ---------------------------------------------------------------------------


def test_ohlcv_row_is_immutable() -> None:
    """frozen=True means rows cannot be mutated after creation."""
    row = OHLCVRow(
        symbol="BTC",
        timeframe="1D",
        ts=datetime(2024, 1, 1, tzinfo=timezone.utc),
        open=40000.0,
        high=42000.0,
        low=39000.0,
        close=41000.0,
        volume=1000.0,
        source="coingecko",
    )
    with pytest.raises(AttributeError):
        row.close = 999.0  # type: ignore[misc]


def test_ohlcv_row_adj_close_defaults_to_none() -> None:
    row = OHLCVRow(
        symbol="BTC",
        timeframe="1D",
        ts=datetime(2024, 1, 1, tzinfo=timezone.utc),
        open=40000.0,
        high=42000.0,
        low=39000.0,
        close=41000.0,
        volume=1000.0,
        source="coingecko",
    )
    assert row.adj_close is None


def test_ohlcv_row_to_clickhouse_dict_contains_all_columns() -> None:
    """to_clickhouse_dict must include every column in the ClickHouse schema."""
    ts = datetime(2024, 6, 15, 12, 0, 0, tzinfo=timezone.utc)
    row = OHLCVRow(
        symbol="ETH",
        timeframe="4H",
        ts=ts,
        open=3000.0,
        high=3200.0,
        low=2900.0,
        close=3100.0,
        volume=500.0,
        source="coingecko",
        adj_close=None,
    )
    d = row.to_clickhouse_dict()
    expected_keys = {"symbol", "timeframe", "ts", "open", "high", "low", "close",
                     "volume", "adj_close", "source"}
    assert set(d.keys()) == expected_keys
    assert d["symbol"] == "ETH"
    assert d["ts"] is ts
    assert d["adj_close"] is None


def test_ohlcv_row_with_adj_close() -> None:
    row = OHLCVRow(
        symbol="AAPL",
        timeframe="1D",
        ts=datetime(2024, 1, 2, tzinfo=timezone.utc),
        open=185.0,
        high=188.0,
        low=184.0,
        close=187.0,
        volume=50_000_000.0,
        source="marketstack",
        adj_close=186.5,
    )
    assert row.adj_close == pytest.approx(186.5)
    assert row.to_clickhouse_dict()["adj_close"] == pytest.approx(186.5)


# ---------------------------------------------------------------------------
# Instrument ORM model
# ---------------------------------------------------------------------------


def test_instrument_tablename() -> None:
    assert Instrument.__tablename__ == "instruments"


def test_instrument_default_currency_is_usd() -> None:
    instrument = Instrument(
        symbol="BTC",
        name="Bitcoin",
        asset_class="crypto",
    )
    assert instrument.currency == "USD"


def test_instrument_default_is_active_true() -> None:
    instrument = Instrument(
        symbol="ETH",
        name="Ethereum",
        asset_class="crypto",
    )
    assert instrument.is_active is True


def test_instrument_id_is_uuid_type() -> None:
    instrument = Instrument(
        symbol="BTC",
        name="Bitcoin",
        asset_class="crypto",
    )
    assert isinstance(instrument.id, uuid.UUID)


def test_instrument_exchange_nullable() -> None:
    """exchange is NULL for crypto (multi-exchange) and macro series."""
    instrument = Instrument(
        symbol="BTC",
        name="Bitcoin",
        asset_class="crypto",
    )
    assert instrument.exchange is None
