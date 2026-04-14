"""
ClickHouse OHLCV row dataclass.

Why a dataclass instead of ORM: ClickHouse is accessed via clickhouse-connect
which operates on dicts/lists of primitives. This dataclass provides type safety
at the repository boundary without introducing ORM overhead inappropriate for
a columnar store.

Table schema defined in ADR-002 and infrastructure/init/clickhouse/01_create_ohlcv.sql.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True, slots=True)
class OHLCVRow:
    """
    Represents a single OHLCV bar as stored in ClickHouse.

    frozen=True: rows are immutable after ingestion — ClickHouse is append-optimised.
    slots=True: reduces memory overhead when holding thousands of rows in memory
    during bulk insert operations.
    """

    symbol: str
    """Ticker symbol. Examples: BTC, ETH, AAPL. Matches instruments.symbol."""

    timeframe: str
    """
    Candle interval. Examples: '1D', '4H', '1H', '15m'.
    Matches the timeframe column in ClickHouse ORDER BY key.
    """

    ts: datetime
    """
    Bar open timestamp in UTC. DateTime64(3, 'UTC') in ClickHouse.
    Must be timezone-aware (tzinfo=UTC) before insert.
    """

    open: float
    """Opening price for the interval."""

    high: float
    """Highest price during the interval."""

    low: float
    """Lowest price during the interval."""

    close: float
    """Closing price for the interval."""

    volume: float
    """
    Total volume traded during the interval.
    Units vary by source: USD for CoinGecko, shares for equities.
    """

    source: str
    """
    Data provider identifier. Examples: 'coingecko', 'marketstack', 'alpha_vantage'.
    Stored as LowCardinality(String) — enables filtering by source without full scan.
    """

    adj_close: float | None = None
    """
    Split/dividend-adjusted closing price. NULL for crypto (no corporate actions).
    Populated for equities from providers that supply adjusted data.
    """

    def to_clickhouse_dict(self) -> dict[str, object]:
        """
        Convert to the dict format expected by clickhouse-connect's insert API.
        Columns must match the table schema ORDER exactly.
        """
        return {
            "symbol": self.symbol,
            "timeframe": self.timeframe,
            "ts": self.ts,
            "open": self.open,
            "high": self.high,
            "low": self.low,
            "close": self.close,
            "volume": self.volume,
            "adj_close": self.adj_close,
            "source": self.source,
        }
