"""
ClickHouse macro series repository — worker service copy.

Why a separate copy: the worker and api are separate Python packages.
CLAUDE.md prohibits cross-service imports. This file is kept in sync
with services/api/src/repositories/macro_repository.py manually.

Table schema: infrastructure/init/clickhouse/02_create_macro_series.sql
Engine: ReplacingMergeTree on (series_id, ts) — safe to re-insert.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import clickhouse_connect.driver.asyncclient

from src.models.macro import MacroRow

_MACRO_COLUMNS = ("series_id", "ts", "value", "source")
_SELECT_COLS = ", ".join(_MACRO_COLUMNS)


class MacroRepository:
    """Read/write access to the ClickHouse `terminal.macro_series` table."""

    def __init__(
        self, client: clickhouse_connect.driver.asyncclient.AsyncClient
    ) -> None:
        self._ch = client

    async def insert_rows(self, rows: list[MacroRow]) -> None:
        """
        Bulk-insert macro series observations. Empty list is a no-op.

        Idempotent: ReplacingMergeTree deduplicates on (series_id, ts).
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

    async def get_latest_ts(self, series_id: str) -> datetime | None:
        """Return the most recent observation timestamp for *series_id*, or None."""
        query = (
            "SELECT max(ts) FROM terminal.macro_series "
            "WHERE series_id = %(series_id)s"
        )
        result = await self._ch.query(query, parameters={"series_id": series_id})
        rows = result.result_rows
        if not rows or rows[0][0] is None:
            return None
        raw: Any = rows[0][0]
        if not isinstance(raw, datetime):
            return None
        if raw.tzinfo is None:
            return raw.replace(tzinfo=UTC)
        return raw
