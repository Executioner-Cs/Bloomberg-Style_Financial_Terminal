"""
Yahoo Finance integration client via the yfinance library.

Why not BaseIntegrationClient: yfinance is a Python library that wraps
scraping internally — it has no HTTP client surface to configure. All
network I/O is synchronous and managed by the library itself.

Worker copy: returns OHLCVRow from src.models.ohlcv (worker model namespace).
Cannot import from api service — CLAUDE.md prohibits cross-service imports.

ADR-005: yfinance approved as the primary equities OHLCV source.
Risk: unofficial, Yahoo can block scraping. Mitigation: mock_data/ fallback.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, date
from functools import partial

import pandas as pd
import yfinance as yf

from src.models.ohlcv import OHLCVRow

logger = logging.getLogger(__name__)

# yfinance period strings — map our internal lookback days to yfinance period tokens.
# Source: yfinance documentation — these are the only accepted period values.
_PERIOD_MAP: dict[int, str] = {
    2: "5d",  # fetch 5 days to guarantee we get at least 2 trading days
    90: "3mo",
    365: "1y",
    730: "2y",
}

# Default period when no specific lookback is requested.
# 1y covers all Phase 1 use cases (backfill + incremental).
_DEFAULT_PERIOD = "1y"

# Timeframe label written into OHLCVRow. yfinance daily bars = "1D".
_DAILY_TIMEFRAME = "1D"

# Data source label written into OHLCVRow — used for audit and filtering.
_SOURCE = "yfinance"


def _period_for_days(days: int) -> str:
    """Return the smallest yfinance period string that covers *days* calendar days."""
    for threshold, period_str in sorted(_PERIOD_MAP.items()):
        if days <= threshold:
            return period_str
    return _DEFAULT_PERIOD


def _fetch_sync(symbol: str, period: str, timeout_seconds: float) -> list[OHLCVRow]:
    """
    Synchronous yfinance fetch — must be called inside run_in_executor.

    yfinance.Ticker.history is blocking network I/O; running it in an executor
    prevents blocking the event loop.
    """
    ticker = yf.Ticker(symbol)
    df: pd.DataFrame = ticker.history(
        period=period,
        interval="1d",
        auto_adjust=False,
        actions=False,
        timeout=timeout_seconds,
    )

    if df.empty:
        logger.warning(
            "yfinance returned empty DataFrame for %s (period=%s)", symbol, period
        )
        return []

    rows: list[OHLCVRow] = []
    for ts, row in df.iterrows():
        if isinstance(ts, pd.Timestamp):
            dt = ts.to_pydatetime()
        else:
            dt = pd.Timestamp(ts).to_pydatetime()

        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)

        adj_close_raw = row.get("Adj Close")
        adj_close: float | None = None
        if adj_close_raw is not None and not pd.isna(adj_close_raw):
            adj_close = float(adj_close_raw)

        rows.append(
            OHLCVRow(
                symbol=symbol,
                timeframe=_DAILY_TIMEFRAME,
                ts=dt,
                open=float(row["Open"]),
                high=float(row["High"]),
                low=float(row["Low"]),
                close=float(row["Close"]),
                volume=float(row["Volume"]),
                source=_SOURCE,
                adj_close=adj_close,
            )
        )
    return rows


class YFinanceClient:
    """
    Async wrapper around the synchronous yfinance library.

    All blocking calls are dispatched to the default executor so the
    event loop is never blocked.

    Usage:
        client = YFinanceClient(timeout_seconds=settings.yfinance_timeout_seconds)
        bars = await client.get_ohlcv("AAPL", days=365)
    """

    def __init__(self, timeout_seconds: float) -> None:
        # Timeout sourced from settings — never hardcoded. ADR-005.
        self._timeout = timeout_seconds

    async def get_ohlcv(self, symbol: str, days: int = 365) -> list[OHLCVRow]:
        """
        Fetch daily OHLCV bars for *symbol* covering approximately *days* calendar days.

        Runs the blocking yfinance call in the default thread pool executor.
        Returns an empty list if Yahoo Finance has no data for the symbol.

        Args:
            symbol: Ticker symbol, e.g. "AAPL". Must match Yahoo Finance symbol.
            days: Approximate lookback in calendar days. Mapped to the smallest
                  yfinance period string that covers the requested range.
        """
        period = _period_for_days(days)
        loop = asyncio.get_running_loop()
        fn = partial(_fetch_sync, symbol, period, self._timeout)
        try:
            rows = await loop.run_in_executor(None, fn)
        except Exception as exc:
            logger.exception(
                "yfinance fetch failed for symbol %s (period=%s): %s",
                symbol,
                period,
                exc,
            )
            return []
        logger.debug(
            "yfinance fetched %d bars for %s (period=%s)", len(rows), symbol, period
        )
        return rows

    async def get_ohlcv_since(self, symbol: str, since: date) -> list[OHLCVRow]:
        """
        Fetch daily bars for *symbol* since *since* date (inclusive).

        Convenience wrapper that selects the correct period based on how far
        back *since* is from today.
        """
        today = date.today()
        days = (today - since).days + 1
        return await self.get_ohlcv(symbol, days=days)
