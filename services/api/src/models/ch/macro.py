"""
ClickHouse macro series row dataclass.

Why a dataclass: same reasoning as OHLCVRow — ClickHouse is accessed via
clickhouse-connect which operates on dicts/lists of primitives. Frozen + slots
for immutability and memory efficiency.

Table schema defined in infrastructure/init/clickhouse/02_create_macro_series.sql.
ReplacingMergeTree: deduplicates on (series_id, ts) — safe to re-insert.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True, slots=True)
class MacroRow:
    """
    Represents a single macro series observation as stored in ClickHouse.

    frozen=True: rows are immutable after ingestion.
    slots=True: reduces memory overhead during bulk insert operations.
    """

    series_id: str
    """FRED series identifier. Examples: 'GDP', 'CPIAUCSL', 'FEDFUNDS'."""

    ts: datetime
    """Observation date in UTC. DateTime64(3, 'UTC') in ClickHouse."""

    value: float
    """Numeric observation value. Units vary by series (billions USD, percent, etc.)."""

    source: str
    """Data provider. Examples: 'fred', 'mock'."""

    def to_clickhouse_dict(self) -> dict[str, object]:
        """
        Convert to the dict format expected by clickhouse-connect's insert API.
        Columns must match the table schema ORDER exactly.
        """
        return {
            "series_id": self.series_id,
            "ts": self.ts,
            "value": self.value,
            "source": self.source,
        }
