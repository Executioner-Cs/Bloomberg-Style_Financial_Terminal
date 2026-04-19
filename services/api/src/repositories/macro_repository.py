"""
ClickHouse repository for macro series data.

Why a dedicated repository layer: keeps all ClickHouse query logic in one place,
makes the service layer testable by mocking this class, and enforces the
router → service → repository boundary (CLAUDE.md Part VIII).

No business logic here — only reads and writes to the macro_series table.
Column list is explicit — never SELECT * (CLAUDE.md Part X).

Table schema: infrastructure/init/clickhouse/02_create_macro_series.sql
Engine: ReplacingMergeTree on (series_id, ts) — safe to re-insert.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from clickhouse_connect.driver.asyncclient import AsyncClient

from src.models.ch.macro import MacroRow

# Explicit column list — SELECT * is prohibited (CLAUDE.md Part X).
# Order must match the table schema ORDER BY clause.
_MACRO_COLUMNS = ("series_id", "ts", "value", "source")
_SELECT_COLS = ", ".join(_MACRO_COLUMNS)


class MacroRepository:
    """
    Read/write access to the ClickHouse `terminal.macro_series` table.

    All writes are idempotent: ReplacingMergeTree deduplicates on (series_id, ts),
    so re-inserting the same observation is safe (the last write wins).
    """

    def __init__(self, client: AsyncClient) -> None:
        self._ch = client

    async def insert_rows(self, rows: list[MacroRow]) -> None:
        """
        Bulk-insert macro series observations into ClickHouse.

        Idempotent: ReplacingMergeTree deduplicates on (series_id, ts).
        Empty input list is a no-op.

        Args:
            rows: MacroRow instances to insert. Must have UTC-aware ts.
        """
        if not rows:
            return

        data = [
            [row.to_clickhouse_dict()[col] for col in _MACRO_COLUMNS] for row in rows
        ]
        await self._ch.insert(
            "terminal.macro_series",
            data=data,
            column_names=list(_MACRO_COLUMNS),
        )

    async def get_series(
        self,
        series_id: str,
        from_date: datetime,
        to_date: datetime,
    ) -> list[MacroRow]:
        """
        Fetch observations for *series_id* within a date range.

        Args:
            series_id: FRED series identifier, e.g. "GDP".
            from_date: Inclusive start datetime (UTC).
            to_date: Inclusive end datetime (UTC).

        Returns:
            List of MacroRow ordered by ts ascending.
        """
        query = (
            f"SELECT {_SELECT_COLS} FROM terminal.macro_series "
            "WHERE series_id = %(series_id)s "
            "AND ts >= %(from_date)s "
            "AND ts <= %(to_date)s "
            "ORDER BY ts ASC"
        )
        result = await self._ch.query(
            query,
            parameters={
                "series_id": series_id,
                "from_date": from_date,
                "to_date": to_date,
            },
        )
        return [_row_from_result(row) for row in result.result_rows]

    async def get_latest_ts(self, series_id: str) -> datetime | None:
        """
        Return the most recent observation timestamp for *series_id*.

        Used by the ingestion task for incremental fetching: only request
        FRED data newer than this timestamp.

        Returns:
            Latest ts as a UTC-aware datetime, or None if no rows exist.
        """
        query = (
            "SELECT max(ts) FROM terminal.macro_series "
            "WHERE series_id = %(series_id)s"
        )
        result = await self._ch.query(query, parameters={"series_id": series_id})
        rows = result.result_rows
        if not rows or rows[0][0] is None:
            return None
        raw = rows[0][0]
        if not isinstance(raw, datetime):
            return None
        if raw.tzinfo is None:
            return raw.replace(tzinfo=UTC)
        return raw

    async def get_all_series_latest(self) -> dict[str, tuple[float, datetime] | None]:
        """
        Return the most recent (value, ts) per series_id for all tracked series.

        Used by the GET /macro/ list endpoint to show latest snapshot per series
        without a per-series round-trip. Returns a dict keyed by series_id.
        """
        query = (
            "SELECT series_id, argMax(value, ts), max(ts) "
            "FROM terminal.macro_series "
            "GROUP BY series_id"
        )
        result = await self._ch.query(query)
        out: dict[str, tuple[float, datetime] | None] = {}
        for row in result.result_rows:
            sid: str = row[0]
            value: float = float(row[1])
            ts: datetime = row[2]
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=UTC)
            out[sid] = (value, ts)
        return out


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------


def _row_from_result(row: tuple[Any, ...]) -> MacroRow:
    """
    Convert a ClickHouse result row tuple to a MacroRow dataclass.

    Column order must match _MACRO_COLUMNS exactly:
    (series_id, ts, value, source)
    """
    ts: datetime = row[1]
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=UTC)

    return MacroRow(
        series_id=row[0],
        ts=ts,
        value=float(row[2]),
        source=row[3],
    )
