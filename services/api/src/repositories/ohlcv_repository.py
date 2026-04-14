"""
ClickHouse repository for OHLCV data.

Why a dedicated repository layer: keeps all ClickHouse query logic in one place,
makes the service layer testable by mocking this class, and enforces the
router → service → repository boundary (CLAUDE.md Part VIII).

No business logic here — only reads and writes to the ohlcv table.
Column list is explicit — never SELECT * (CLAUDE.md Part X).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from clickhouse_connect.driver.asyncclient import AsyncClient

from src.models.ch.ohlcv import OHLCVRow

# Explicit column list — SELECT * is prohibited (CLAUDE.md Part X).
_OHLCV_COLUMNS = (
    "symbol",
    "timeframe",
    "ts",
    "open",
    "high",
    "low",
    "close",
    "volume",
    "adj_close",
    "source",
)
_SELECT_COLS = ", ".join(_OHLCV_COLUMNS)


class OHLCVRepository:
    """
    Read/write access to the ClickHouse `terminal.ohlcv` table.

    All methods are idempotent — re-running a task that calls insert_bars
    will not produce duplicate rows because ClickHouse MergeTree deduplicates
    rows with identical (symbol, timeframe, ts) via ReplacingMergeTree semantics
    when dedup is needed, but for our use case inserts are append-only with
    natural deduplication by the task logic checking get_latest_ts first.
    """

    def __init__(self, client: AsyncClient) -> None:
        self._ch = client

    async def insert_bars(self, bars: list[OHLCVRow]) -> None:
        """
        Bulk-insert OHLCV rows into ClickHouse.

        Converts each OHLCVRow to a dict and passes as a column-value list.
        The caller is responsible for deduplication (check get_latest_ts first).

        Args:
            bars: List of OHLCVRow instances to insert. Empty list is a no-op.
        """
        if not bars:
            return

        data = [
            [row.to_clickhouse_dict()[col] for col in _OHLCV_COLUMNS] for row in bars
        ]
        await self._ch.insert(
            "terminal.ohlcv",
            data=data,
            column_names=list(_OHLCV_COLUMNS),
        )

    async def get_bars(
        self,
        symbol: str,
        timeframe: str,
        from_date: datetime,
        to_date: datetime,
    ) -> list[OHLCVRow]:
        """
        Fetch OHLCV bars for a symbol/timeframe within a date range.

        Args:
            symbol: Ticker symbol (e.g. 'BITCOIN', 'ETH').
            timeframe: Candle interval (e.g. '1D', '4H').
            from_date: Inclusive start datetime (UTC).
            to_date: Inclusive end datetime (UTC).

        Returns:
            List of OHLCVRow ordered by ts ascending.
        """
        query = (
            f"SELECT {_SELECT_COLS} FROM terminal.ohlcv "
            "WHERE symbol = %(symbol)s "
            "AND timeframe = %(timeframe)s "
            "AND ts >= %(from_date)s "
            "AND ts <= %(to_date)s "
            "ORDER BY ts ASC"
        )
        result = await self._ch.query(
            query,
            parameters={
                "symbol": symbol,
                "timeframe": timeframe,
                "from_date": from_date,
                "to_date": to_date,
            },
        )
        return [_row_from_result(row) for row in result.result_rows]

    async def get_latest_ts(
        self,
        symbol: str,
        timeframe: str,
    ) -> datetime | None:
        """
        Return the most recent timestamp for a symbol/timeframe combination.

        Used by the ingestion task to determine the incremental window:
        only fetch data newer than this timestamp from CoinGecko.

        Returns:
            Latest ts as a UTC datetime, or None if no rows exist.
        """
        query = (
            "SELECT max(ts) FROM terminal.ohlcv "
            "WHERE symbol = %(symbol)s "
            "AND timeframe = %(timeframe)s"
        )
        result = await self._ch.query(
            query,
            parameters={"symbol": symbol, "timeframe": timeframe},
        )
        rows = result.result_rows
        if not rows or rows[0][0] is None:
            return None
        raw = rows[0][0]
        # ClickHouse returns DateTime64 as a datetime — ensure it is tz-aware.
        if not isinstance(raw, datetime):
            return None
        from datetime import UTC

        if raw.tzinfo is None:
            return raw.replace(tzinfo=UTC)
        return raw


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------


def _row_from_result(row: tuple[Any, ...]) -> OHLCVRow:
    """
    Convert a ClickHouse result row tuple to an OHLCVRow dataclass.

    Column order must match _OHLCV_COLUMNS exactly.
    """
    from datetime import UTC

    ts: datetime = row[2]
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=UTC)

    return OHLCVRow(
        symbol=row[0],
        timeframe=row[1],
        ts=ts,
        open=float(row[3]),
        high=float(row[4]),
        low=float(row[5]),
        close=float(row[6]),
        volume=float(row[7]),
        adj_close=float(row[8]) if row[8] is not None else None,
        source=row[9],
    )
