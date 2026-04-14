"""
Unit tests for the worker repository layer.

External dependencies (ClickHouse, PostgreSQL) are mocked — no real DB
connections are made. Tests validate query construction, data transformation,
and edge-case handling.
"""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.models.instrument import Instrument
from src.models.ohlcv import OHLCVRow
from src.repositories.instrument_repository import InstrumentRepository
from src.repositories.ohlcv_repository import OHLCVRepository


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_bar(
    symbol: str = "BITCOIN",
    ts: datetime | None = None,
    close: float = 44000.0,
) -> OHLCVRow:
    if ts is None:
        ts = datetime(2024, 1, 1, tzinfo=UTC)
    return OHLCVRow(
        symbol=symbol,
        timeframe="1D",
        ts=ts,
        open=close,
        high=close,
        low=close,
        close=close,
        volume=500.0,
        source="coingecko",
    )


def _make_ch_mock() -> MagicMock:
    ch = MagicMock()
    ch.insert = AsyncMock()
    ch.query = AsyncMock()
    return ch


# ---------------------------------------------------------------------------
# OHLCVRepository.insert_bars
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_insert_bars_empty_list_is_noop() -> None:
    ch = _make_ch_mock()
    repo = OHLCVRepository(ch)
    await repo.insert_bars([])
    ch.insert.assert_not_called()


@pytest.mark.asyncio
async def test_insert_bars_calls_clickhouse_insert() -> None:
    ch = _make_ch_mock()
    repo = OHLCVRepository(ch)
    bar = _make_bar()
    await repo.insert_bars([bar])
    ch.insert.assert_called_once()


@pytest.mark.asyncio
async def test_insert_bars_passes_correct_table() -> None:
    ch = _make_ch_mock()
    repo = OHLCVRepository(ch)
    await repo.insert_bars([_make_bar()])
    call_args = ch.insert.call_args
    assert call_args.args[0] == "terminal.ohlcv"


@pytest.mark.asyncio
async def test_insert_bars_passes_all_ten_columns() -> None:
    ch = _make_ch_mock()
    repo = OHLCVRepository(ch)
    await repo.insert_bars([_make_bar()])
    call_kwargs = ch.insert.call_args.kwargs
    assert len(call_kwargs["column_names"]) == 10


@pytest.mark.asyncio
async def test_insert_bars_multiple_rows() -> None:
    ch = _make_ch_mock()
    repo = OHLCVRepository(ch)
    bars = [
        _make_bar(ts=datetime(2024, 1, d, tzinfo=UTC))
        for d in range(1, 4)
    ]
    await repo.insert_bars(bars)
    call_kwargs = ch.insert.call_args.kwargs
    assert len(call_kwargs["data"]) == 3


# ---------------------------------------------------------------------------
# OHLCVRepository.get_latest_ts
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_latest_ts_returns_none_when_no_rows() -> None:
    ch = _make_ch_mock()
    result_mock = MagicMock()
    result_mock.result_rows = []
    ch.query.return_value = result_mock
    repo = OHLCVRepository(ch)

    ts = await repo.get_latest_ts("BITCOIN", "1D")
    assert ts is None


@pytest.mark.asyncio
async def test_get_latest_ts_returns_none_when_value_is_none() -> None:
    ch = _make_ch_mock()
    result_mock = MagicMock()
    result_mock.result_rows = [[None]]
    ch.query.return_value = result_mock
    repo = OHLCVRepository(ch)

    ts = await repo.get_latest_ts("BITCOIN", "1D")
    assert ts is None


@pytest.mark.asyncio
async def test_get_latest_ts_returns_utc_aware_datetime() -> None:
    ch = _make_ch_mock()
    expected_dt = datetime(2024, 1, 15, tzinfo=UTC)
    result_mock = MagicMock()
    result_mock.result_rows = [[expected_dt]]
    ch.query.return_value = result_mock
    repo = OHLCVRepository(ch)

    ts = await repo.get_latest_ts("BITCOIN", "1D")
    assert ts == expected_dt
    assert ts is not None and ts.tzinfo is not None


@pytest.mark.asyncio
async def test_get_latest_ts_makes_naive_datetime_utc_aware() -> None:
    ch = _make_ch_mock()
    naive_dt = datetime(2024, 1, 15)  # no tzinfo
    result_mock = MagicMock()
    result_mock.result_rows = [[naive_dt]]
    ch.query.return_value = result_mock
    repo = OHLCVRepository(ch)

    ts = await repo.get_latest_ts("BITCOIN", "1D")
    assert ts is not None
    assert ts.tzinfo is not None
    assert ts.year == 2024
    assert ts.month == 1


@pytest.mark.asyncio
async def test_get_latest_ts_passes_symbol_and_timeframe() -> None:
    ch = _make_ch_mock()
    result_mock = MagicMock()
    result_mock.result_rows = []
    ch.query.return_value = result_mock
    repo = OHLCVRepository(ch)

    await repo.get_latest_ts("ETHEREUM", "4H")
    call_kwargs = ch.query.call_args.kwargs
    assert call_kwargs["parameters"]["symbol"] == "ETHEREUM"
    assert call_kwargs["parameters"]["timeframe"] == "4H"


# ---------------------------------------------------------------------------
# InstrumentRepository.upsert
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_upsert_calls_session_execute_and_commit() -> None:
    session = MagicMock()
    session.execute = AsyncMock()
    session.commit = AsyncMock()
    repo = InstrumentRepository(session)

    instrument = Instrument(symbol="BTC", name="Bitcoin", asset_class="crypto")
    await repo.upsert(instrument)

    session.execute.assert_called_once()
    session.commit.assert_called_once()


@pytest.mark.asyncio
async def test_upsert_with_full_instrument() -> None:
    session = MagicMock()
    session.execute = AsyncMock()
    session.commit = AsyncMock()
    repo = InstrumentRepository(session)

    instrument = Instrument(
        symbol="AAPL",
        name="Apple Inc.",
        asset_class="equity",
        exchange="NASDAQ",
        currency="USD",
        is_active=True,
    )
    await repo.upsert(instrument)

    session.execute.assert_called_once()
