"""
Unit tests for OHLCVRepository and InstrumentRepository.

Both repositories are tested with mocked DB clients — no real ClickHouse or
PostgreSQL connection required. Tests verify query construction and data mapping.
"""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.models.ch.ohlcv import OHLCVRow
from src.repositories.ohlcv_repository import OHLCVRepository

# ---------------------------------------------------------------------------
# OHLCVRepository
# ---------------------------------------------------------------------------


def _make_ch_client() -> MagicMock:
    """Return a mock ClickHouse async client."""
    client = MagicMock()
    client.insert = AsyncMock()
    client.query = AsyncMock()
    return client


def _make_row(ts: datetime, close: float = 42000.0) -> OHLCVRow:
    return OHLCVRow(
        symbol="BITCOIN",
        timeframe="1D",
        ts=ts,
        open=close,
        high=close,
        low=close,
        close=close,
        volume=500.0,
        source="coingecko",
    )


@pytest.mark.asyncio
async def test_ohlcv_insert_bars_calls_clickhouse_insert() -> None:
    """insert_bars calls ch.insert with the correct table name."""
    ch = _make_ch_client()
    repo = OHLCVRepository(ch)

    ts = datetime(2024, 1, 1, tzinfo=UTC)
    rows = [_make_row(ts)]
    await repo.insert_bars(rows)

    ch.insert.assert_awaited_once()
    call_kwargs = ch.insert.call_args
    assert call_kwargs.args[0] == "terminal.ohlcv"


@pytest.mark.asyncio
async def test_ohlcv_insert_bars_empty_is_noop() -> None:
    """insert_bars with an empty list must NOT call ch.insert."""
    ch = _make_ch_client()
    repo = OHLCVRepository(ch)

    await repo.insert_bars([])

    ch.insert.assert_not_awaited()


@pytest.mark.asyncio
async def test_ohlcv_insert_bars_data_shape() -> None:
    """Inserted data rows have correct column count (10 columns per row)."""
    ch = _make_ch_client()
    repo = OHLCVRepository(ch)

    ts = datetime(2024, 1, 1, tzinfo=UTC)
    rows = [_make_row(ts), _make_row(ts)]
    await repo.insert_bars(rows)

    inserted_data = ch.insert.call_args.kwargs["data"]
    assert len(inserted_data) == 2
    # 10 columns: symbol/timeframe/ts/open/high/low/close/volume/adj_close/source
    assert len(inserted_data[0]) == 10


@pytest.mark.asyncio
async def test_ohlcv_get_latest_ts_returns_datetime() -> None:
    """get_latest_ts returns a tz-aware datetime when ClickHouse has data."""
    ts = datetime(2024, 6, 1, tzinfo=UTC)
    mock_result = MagicMock()
    mock_result.result_rows = [(ts,)]

    ch = _make_ch_client()
    ch.query.return_value = mock_result

    repo = OHLCVRepository(ch)
    result = await repo.get_latest_ts("BITCOIN", "1D")

    assert result == ts
    assert result is not None
    assert result.tzinfo is not None


@pytest.mark.asyncio
async def test_ohlcv_get_latest_ts_returns_none_when_no_data() -> None:
    """get_latest_ts returns None when ClickHouse result rows are empty."""
    mock_result = MagicMock()
    mock_result.result_rows = []

    ch = _make_ch_client()
    ch.query.return_value = mock_result

    repo = OHLCVRepository(ch)
    result = await repo.get_latest_ts("UNKNOWN", "1D")

    assert result is None


@pytest.mark.asyncio
async def test_ohlcv_get_latest_ts_makes_naive_ts_aware() -> None:
    """If ClickHouse returns a naive datetime, it is given UTC tzinfo."""
    naive_ts = datetime(2024, 6, 1)  # no tzinfo
    mock_result = MagicMock()
    mock_result.result_rows = [(naive_ts,)]

    ch = _make_ch_client()
    ch.query.return_value = mock_result

    repo = OHLCVRepository(ch)
    result = await repo.get_latest_ts("BITCOIN", "1D")

    assert result is not None
    assert result.tzinfo == UTC


@pytest.mark.asyncio
async def test_ohlcv_get_bars_returns_ohlcv_rows() -> None:
    """get_bars parses ClickHouse result rows into OHLCVRow instances."""
    ts = datetime(2024, 1, 1, tzinfo=UTC)
    # Tuple order matches _OHLCV_COLUMNS: symbol, timeframe, ts, open, high, low,
    # close, volume, adj_close, source
    mock_row = (
        "BITCOIN",
        "1D",
        ts,
        40000.0,
        42000.0,
        39000.0,
        41000.0,
        500.0,
        None,
        "coingecko",
    )
    mock_result = MagicMock()
    mock_result.result_rows = [mock_row]

    ch = _make_ch_client()
    ch.query.return_value = mock_result

    repo = OHLCVRepository(ch)
    rows = await repo.get_bars("BITCOIN", "1D", ts, ts)

    assert len(rows) == 1
    row = rows[0]
    assert row.symbol == "BITCOIN"
    assert row.close == pytest.approx(41000.0)
    assert row.adj_close is None
    assert row.source == "coingecko"
