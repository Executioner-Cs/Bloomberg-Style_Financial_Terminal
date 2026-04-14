"""
Unit tests for worker data models.

Covers OHLCVRow (ClickHouse row dataclass) and Instrument (SQLAlchemy ORM model).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest

from src.models.instrument import Instrument
from src.models.ohlcv import OHLCVRow


# ---------------------------------------------------------------------------
# OHLCVRow
# ---------------------------------------------------------------------------


def _make_row(**kwargs: object) -> OHLCVRow:
    defaults: dict[str, object] = {
        "symbol": "BITCOIN",
        "timeframe": "1D",
        "ts": datetime(2024, 1, 1, tzinfo=UTC),
        "open": 40000.0,
        "high": 42000.0,
        "low": 39000.0,
        "close": 41000.0,
        "volume": 500.0,
        "source": "coingecko",
    }
    defaults.update(kwargs)
    return OHLCVRow(**defaults)  # type: ignore[arg-type]


def test_ohlcv_row_creation() -> None:
    row = _make_row()
    assert row.symbol == "BITCOIN"
    assert row.timeframe == "1D"
    assert row.close == pytest.approx(41000.0)
    assert row.source == "coingecko"
    assert row.adj_close is None


def test_ohlcv_row_with_adj_close() -> None:
    row = _make_row(adj_close=40900.0)
    assert row.adj_close == pytest.approx(40900.0)


def test_ohlcv_row_is_frozen() -> None:
    row = _make_row()
    with pytest.raises((AttributeError, TypeError)):
        row.close = 99999.0  # type: ignore[misc]


def test_to_clickhouse_dict_keys() -> None:
    row = _make_row()
    d = row.to_clickhouse_dict()
    expected_keys = {
        "symbol", "timeframe", "ts", "open", "high", "low",
        "close", "volume", "adj_close", "source",
    }
    assert set(d.keys()) == expected_keys


def test_to_clickhouse_dict_values() -> None:
    ts = datetime(2024, 6, 15, tzinfo=UTC)
    row = _make_row(
        symbol="ETHEREUM",
        timeframe="4H",
        ts=ts,
        open=3000.0,
        high=3100.0,
        low=2950.0,
        close=3050.0,
        volume=200.0,
        source="coingecko",
        adj_close=None,
    )
    d = row.to_clickhouse_dict()
    assert d["symbol"] == "ETHEREUM"
    assert d["timeframe"] == "4H"
    assert d["ts"] == ts
    assert d["open"] == pytest.approx(3000.0)
    assert d["high"] == pytest.approx(3100.0)
    assert d["low"] == pytest.approx(2950.0)
    assert d["close"] == pytest.approx(3050.0)
    assert d["volume"] == pytest.approx(200.0)
    assert d["source"] == "coingecko"
    assert d["adj_close"] is None


def test_to_clickhouse_dict_with_adj_close() -> None:
    row = _make_row(adj_close=40800.0)
    d = row.to_clickhouse_dict()
    assert d["adj_close"] == pytest.approx(40800.0)


# ---------------------------------------------------------------------------
# Instrument
# ---------------------------------------------------------------------------


def test_instrument_creation_minimal() -> None:
    instr = Instrument(symbol="BTC", name="Bitcoin", asset_class="crypto")
    assert instr.symbol == "BTC"
    assert instr.name == "Bitcoin"
    assert instr.asset_class == "crypto"
    assert instr.currency == "USD"
    assert instr.is_active is True
    assert instr.exchange is None


def test_instrument_creation_full() -> None:
    instr = Instrument(
        symbol="AAPL",
        name="Apple Inc.",
        asset_class="equity",
        exchange="NASDAQ",
        currency="USD",
        is_active=True,
    )
    assert instr.symbol == "AAPL"
    assert instr.exchange == "NASDAQ"


def test_instrument_has_uuid_by_default() -> None:
    instr = Instrument(symbol="ETH", name="Ethereum", asset_class="crypto")
    assert isinstance(instr.id, uuid.UUID)


def test_instrument_inactive() -> None:
    instr = Instrument(
        symbol="DEFUNCT",
        name="Defunct Coin",
        asset_class="crypto",
        is_active=False,
    )
    assert instr.is_active is False
