"""
ClickHouse OHLCV repository — worker service copy.

Why a separate copy: the worker and api are separate Python packages.
CLAUDE.md prohibits cross-service imports. This file is kept in sync
with services/api/src/repositories/ohlcv_repository.py manually.
"""

from __future__ import annotations

from datetime import UTC, datetime

import clickhouse_connect.driver.asyncclient

from src.models.ohlcv import OHLCVRow

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
    """Read/write access to the ClickHouse `terminal.ohlcv` table."""

    def __init__(
        self, client: clickhouse_connect.driver.asyncclient.AsyncClient
    ) -> None:
        self._ch = client

    async def insert_bars(self, bars: list[OHLCVRow]) -> None:
        """Bulk-insert OHLCV rows. Empty list is a no-op."""
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

    async def get_latest_ts(
        self,
        symbol: str,
        timeframe: str,
    ) -> datetime | None:
        """Return the most recent timestamp for a symbol/timeframe, or None."""
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
        if not isinstance(raw, datetime):
            return None
        if raw.tzinfo is None:
            return raw.replace(tzinfo=UTC)
        return raw
