"""
Unit tests for MacroRepository.

All tests use mocked ClickHouse client — no real database connection required.
Tests cover: insert_rows, get_series, get_latest_ts, get_all_series_latest,
and the private _row_from_result helper.
"""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.models.ch.macro import MacroRow
from src.repositories.macro_repository import MacroRepository, _row_from_result


def _make_ch_client() -> MagicMock:
    client = MagicMock()
    client.insert = AsyncMock()
    client.query = AsyncMock()
    return client


def _make_row(
    series_id: str = "GDP",
    value: float = 25000.0,
    ts: datetime | None = None,
) -> MacroRow:
    return MacroRow(
        series_id=series_id,
        ts=ts or datetime(2024, 1, 1, tzinfo=UTC),
        value=value,
        source="fred",
    )


class TestMacroRepositoryInsertRows:
    @pytest.mark.asyncio
    async def test_insert_rows_calls_clickhouse_insert(self) -> None:
        ch = _make_ch_client()
        repo = MacroRepository(ch)
        row = _make_row()

        await repo.insert_rows([row])

        ch.insert.assert_called_once()
        call_kwargs = ch.insert.call_args
        assert call_kwargs[0][0] == "terminal.macro_series"

    @pytest.mark.asyncio
    async def test_insert_rows_empty_is_noop(self) -> None:
        ch = _make_ch_client()
        repo = MacroRepository(ch)

        await repo.insert_rows([])

        ch.insert.assert_not_called()

    @pytest.mark.asyncio
    async def test_insert_rows_passes_column_names(self) -> None:
        ch = _make_ch_client()
        repo = MacroRepository(ch)

        await repo.insert_rows([_make_row()])

        _, kwargs = ch.insert.call_args
        assert "column_names" in kwargs
        assert set(kwargs["column_names"]) == {"series_id", "ts", "value", "source"}

    @pytest.mark.asyncio
    async def test_insert_rows_multiple_rows(self) -> None:
        ch = _make_ch_client()
        repo = MacroRepository(ch)
        rows = [_make_row(value=float(i)) for i in range(5)]

        await repo.insert_rows(rows)

        ch.insert.assert_called_once()
        _, kwargs = ch.insert.call_args
        assert len(kwargs["data"]) == 5


class TestMacroRepositoryGetSeries:
    @pytest.mark.asyncio
    async def test_get_series_returns_macro_rows(self) -> None:
        ch = _make_ch_client()
        ts = datetime(2024, 1, 1, tzinfo=UTC)
        ch.query.return_value.result_rows = [("GDP", ts, 25000.0, "fred")]
        repo = MacroRepository(ch)

        result = await repo.get_series("GDP", from_date=ts, to_date=ts)

        assert len(result) == 1
        assert isinstance(result[0], MacroRow)
        assert result[0].series_id == "GDP"
        assert result[0].value == 25000.0

    @pytest.mark.asyncio
    async def test_get_series_empty_result(self) -> None:
        ch = _make_ch_client()
        ch.query.return_value.result_rows = []
        repo = MacroRepository(ch)
        ts = datetime(2024, 1, 1, tzinfo=UTC)

        result = await repo.get_series("UNRATE", from_date=ts, to_date=ts)

        assert result == []

    @pytest.mark.asyncio
    async def test_get_series_adds_utc_to_naive_ts(self) -> None:
        ch = _make_ch_client()
        naive_ts = datetime(2024, 1, 1)  # no tzinfo
        ch.query.return_value.result_rows = [("GDP", naive_ts, 25000.0, "fred")]
        repo = MacroRepository(ch)

        result = await repo.get_series("GDP", from_date=naive_ts, to_date=naive_ts)

        assert result[0].ts.tzinfo is not None


class TestMacroRepositoryGetLatestTs:
    @pytest.mark.asyncio
    async def test_get_latest_ts_returns_datetime(self) -> None:
        ch = _make_ch_client()
        ts = datetime(2024, 10, 1, tzinfo=UTC)
        ch.query.return_value.result_rows = [[ts]]
        repo = MacroRepository(ch)

        result = await repo.get_latest_ts("GDP")

        assert result == ts

    @pytest.mark.asyncio
    async def test_get_latest_ts_returns_none_when_no_rows(self) -> None:
        ch = _make_ch_client()
        ch.query.return_value.result_rows = []
        repo = MacroRepository(ch)

        result = await repo.get_latest_ts("GDP")

        assert result is None

    @pytest.mark.asyncio
    async def test_get_latest_ts_returns_none_when_value_is_none(self) -> None:
        ch = _make_ch_client()
        ch.query.return_value.result_rows = [[None]]
        repo = MacroRepository(ch)

        result = await repo.get_latest_ts("GDP")

        assert result is None

    @pytest.mark.asyncio
    async def test_get_latest_ts_adds_utc_to_naive(self) -> None:
        ch = _make_ch_client()
        naive_ts = datetime(2024, 10, 1)
        ch.query.return_value.result_rows = [[naive_ts]]
        repo = MacroRepository(ch)

        result = await repo.get_latest_ts("GDP")

        assert result is not None
        assert result.tzinfo is not None

    @pytest.mark.asyncio
    async def test_get_latest_ts_returns_none_for_non_datetime(self) -> None:
        ch = _make_ch_client()
        ch.query.return_value.result_rows = [["not-a-datetime"]]
        repo = MacroRepository(ch)

        result = await repo.get_latest_ts("GDP")

        assert result is None


class TestMacroRepositoryGetAllSeriesLatest:
    @pytest.mark.asyncio
    async def test_get_all_series_latest_returns_dict(self) -> None:
        ch = _make_ch_client()
        ts = datetime(2024, 10, 1, tzinfo=UTC)
        ch.query.return_value.result_rows = [
            ("GDP", 25000.0, ts),
            ("UNRATE", 4.2, ts),
        ]
        repo = MacroRepository(ch)

        result = await repo.get_all_series_latest()

        assert "GDP" in result
        assert "UNRATE" in result
        assert result["GDP"] is not None
        value, _ts = result["GDP"]
        assert value == 25000.0

    @pytest.mark.asyncio
    async def test_get_all_series_latest_empty(self) -> None:
        ch = _make_ch_client()
        ch.query.return_value.result_rows = []
        repo = MacroRepository(ch)

        result = await repo.get_all_series_latest()

        assert result == {}


class TestRowFromResult:
    def test_row_from_result_maps_columns_correctly(self) -> None:
        ts = datetime(2024, 1, 1, tzinfo=UTC)
        row = ("CPIAUCSL", ts, 314.5, "fred")

        result = _row_from_result(row)  # type: ignore[arg-type]

        assert result.series_id == "CPIAUCSL"
        assert result.ts == ts
        assert result.value == 314.5
        assert result.source == "fred"

    def test_row_from_result_adds_utc_to_naive_ts(self) -> None:
        naive_ts = datetime(2024, 1, 1)
        row = ("GDP", naive_ts, 25000.0, "fred")

        result = _row_from_result(row)  # type: ignore[arg-type]

        assert result.ts.tzinfo is not None
