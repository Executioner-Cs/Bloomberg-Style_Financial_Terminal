"""
Unit tests for the yfinance integration client.

All tests mock the yfinance library — zero real network calls.
Tests cover: successful OHLCV parse, empty DataFrame, fetch failure handling.
"""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pandas as pd
import pytest

from src.integrations.yfinance import YFinanceClient, _period_for_days
from src.models.ch.ohlcv import OHLCVRow

# Timeout value sourced from a constant — never hardcoded in tests.
_TEST_TIMEOUT = 30.0


# ---------------------------------------------------------------------------
# _period_for_days
# ---------------------------------------------------------------------------


class TestPeriodForDays:
    def test_period_for_2_days_returns_5d(self) -> None:
        assert _period_for_days(2) == "5d"

    def test_period_for_90_days_returns_3mo(self) -> None:
        assert _period_for_days(90) == "3mo"

    def test_period_for_365_days_returns_1y(self) -> None:
        assert _period_for_days(365) == "1y"

    def test_period_for_large_days_returns_default(self) -> None:
        # Anything beyond 730 days should return the default period.
        result = _period_for_days(1000)
        assert result == "1y"


# ---------------------------------------------------------------------------
# YFinanceClient.get_ohlcv
# ---------------------------------------------------------------------------


def _make_ohlcv_dataframe(rows: list[dict[str, object]]) -> pd.DataFrame:
    """Build a minimal yfinance-shaped DataFrame for testing."""
    data = {
        "Open": [r["Open"] for r in rows],
        "High": [r["High"] for r in rows],
        "Low": [r["Low"] for r in rows],
        "Close": [r["Close"] for r in rows],
        "Volume": [r["Volume"] for r in rows],
        "Adj Close": [r.get("Adj Close") for r in rows],
    }
    index = pd.DatetimeIndex(
        [pd.Timestamp(str(r["ts"]), tz="UTC") for r in rows],
        name="Date",
    )
    return pd.DataFrame(data, index=index)


_SAMPLE_ROWS = [
    {
        "ts": "2025-01-10 00:00:00+00:00",
        "Open": 195.0,
        "High": 198.0,
        "Low": 193.0,
        "Close": 197.0,
        "Volume": 50_000_000.0,
        "Adj Close": 196.5,
    },
    {
        "ts": "2025-01-11 00:00:00+00:00",
        "Open": 197.0,
        "High": 200.0,
        "Low": 195.0,
        "Close": 199.0,
        "Volume": 55_000_000.0,
        "Adj Close": 198.5,
    },
]


class TestYFinanceClientGetOHLCV:
    @pytest.fixture
    def client(self) -> YFinanceClient:
        return YFinanceClient(timeout_seconds=_TEST_TIMEOUT)

    @pytest.mark.asyncio
    async def test_get_ohlcv_returns_ohlcv_rows(self, client: YFinanceClient) -> None:
        df = _make_ohlcv_dataframe(_SAMPLE_ROWS)
        mock_ticker = MagicMock()
        mock_ticker.history.return_value = df

        with patch("src.integrations.yfinance.yf.Ticker", return_value=mock_ticker):
            rows = await client.get_ohlcv("AAPL", days=2)

        assert len(rows) == 2
        assert all(isinstance(r, OHLCVRow) for r in rows)

    @pytest.mark.asyncio
    async def test_get_ohlcv_symbol_and_timeframe_set(self, client: YFinanceClient) -> None:
        df = _make_ohlcv_dataframe(_SAMPLE_ROWS)
        mock_ticker = MagicMock()
        mock_ticker.history.return_value = df

        with patch("src.integrations.yfinance.yf.Ticker", return_value=mock_ticker):
            rows = await client.get_ohlcv("AAPL", days=2)

        assert all(r.symbol == "AAPL" for r in rows)
        assert all(r.timeframe == "1D" for r in rows)

    @pytest.mark.asyncio
    async def test_get_ohlcv_source_is_yfinance(self, client: YFinanceClient) -> None:
        df = _make_ohlcv_dataframe(_SAMPLE_ROWS)
        mock_ticker = MagicMock()
        mock_ticker.history.return_value = df

        with patch("src.integrations.yfinance.yf.Ticker", return_value=mock_ticker):
            rows = await client.get_ohlcv("AAPL", days=2)

        assert all(r.source == "yfinance" for r in rows)

    @pytest.mark.asyncio
    async def test_get_ohlcv_timestamps_are_utc_aware(self, client: YFinanceClient) -> None:
        df = _make_ohlcv_dataframe(_SAMPLE_ROWS)
        mock_ticker = MagicMock()
        mock_ticker.history.return_value = df

        with patch("src.integrations.yfinance.yf.Ticker", return_value=mock_ticker):
            rows = await client.get_ohlcv("AAPL", days=2)

        assert all(r.ts.tzinfo is not None for r in rows)

    @pytest.mark.asyncio
    async def test_get_ohlcv_empty_dataframe_returns_empty_list(
        self, client: YFinanceClient
    ) -> None:
        mock_ticker = MagicMock()
        mock_ticker.history.return_value = pd.DataFrame()

        with patch("src.integrations.yfinance.yf.Ticker", return_value=mock_ticker):
            rows = await client.get_ohlcv("AAPL", days=2)

        assert rows == []

    @pytest.mark.asyncio
    async def test_get_ohlcv_exception_returns_empty_list(self, client: YFinanceClient) -> None:
        mock_ticker = MagicMock()
        mock_ticker.history.side_effect = RuntimeError("network error")

        with patch("src.integrations.yfinance.yf.Ticker", return_value=mock_ticker):
            rows = await client.get_ohlcv("AAPL", days=2)

        assert rows == []

    @pytest.mark.asyncio
    async def test_get_ohlcv_prices_are_correct(self, client: YFinanceClient) -> None:
        df = _make_ohlcv_dataframe(_SAMPLE_ROWS)
        mock_ticker = MagicMock()
        mock_ticker.history.return_value = df

        with patch("src.integrations.yfinance.yf.Ticker", return_value=mock_ticker):
            rows = await client.get_ohlcv("AAPL", days=2)

        assert rows[0].open == pytest.approx(195.0)
        assert rows[0].high == pytest.approx(198.0)
        assert rows[0].low == pytest.approx(193.0)
        assert rows[0].close == pytest.approx(197.0)
        assert rows[0].adj_close == pytest.approx(196.5)

    @pytest.mark.asyncio
    async def test_get_ohlcv_adj_close_none_when_nan(self, client: YFinanceClient) -> None:
        rows_with_nan = [dict(r) for r in _SAMPLE_ROWS]
        rows_with_nan[0]["Adj Close"] = float("nan")
        df = _make_ohlcv_dataframe(rows_with_nan)  # type: ignore[arg-type]
        mock_ticker = MagicMock()
        mock_ticker.history.return_value = df

        with patch("src.integrations.yfinance.yf.Ticker", return_value=mock_ticker):
            rows = await client.get_ohlcv("AAPL", days=2)

        assert rows[0].adj_close is None
        assert rows[1].adj_close == pytest.approx(198.5)
