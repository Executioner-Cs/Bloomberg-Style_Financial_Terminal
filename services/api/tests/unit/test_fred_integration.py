"""
Unit tests for the FRED integration client.

All tests mock the fredapi library — zero real network calls.
Tests cover: successful series parse, empty series, exception handling.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

from src.integrations.fred import FredClient
from src.schemas.macro import MacroBar

# API key and timeout sourced from named constants — never hardcoded in tests.
_TEST_API_KEY = "test-key-placeholder"
_TEST_TIMEOUT = 30.0


def _make_series(values: dict[str, float]) -> pd.Series:
    """Build a pandas Series with DatetimeIndex, mimicking fredapi output."""
    index = pd.DatetimeIndex([pd.Timestamp(k, tz="UTC") for k in values.keys()])
    return pd.Series(list(values.values()), index=index)


_SAMPLE_GDP = {
    "2024-07-01": 28_000.0,
    "2024-10-01": 28_300.0,
    "2025-01-01": 28_600.0,
}


class TestFredClientGetSeries:
    @pytest.fixture
    def client(self) -> FredClient:
        return FredClient(api_key=_TEST_API_KEY, timeout_seconds=_TEST_TIMEOUT)

    @pytest.mark.asyncio
    async def test_get_series_returns_macro_bar_list(self, client: FredClient) -> None:
        series = _make_series(_SAMPLE_GDP)
        mock_fred = MagicMock()
        mock_fred.get_series.return_value = series

        with patch("src.integrations.fred.Fred", return_value=mock_fred):
            bars = await client.get_series("GDP")

        assert len(bars) == 3
        assert all(isinstance(b, MacroBar) for b in bars)

    @pytest.mark.asyncio
    async def test_get_series_values_are_correct(self, client: FredClient) -> None:
        series = _make_series(_SAMPLE_GDP)
        mock_fred = MagicMock()
        mock_fred.get_series.return_value = series

        with patch("src.integrations.fred.Fred", return_value=mock_fred):
            bars = await client.get_series("GDP")

        assert bars[0].value == pytest.approx(28_000.0)
        assert bars[1].value == pytest.approx(28_300.0)
        assert bars[2].value == pytest.approx(28_600.0)

    @pytest.mark.asyncio
    async def test_get_series_timestamps_are_utc_aware(self, client: FredClient) -> None:
        series = _make_series(_SAMPLE_GDP)
        mock_fred = MagicMock()
        mock_fred.get_series.return_value = series

        with patch("src.integrations.fred.Fred", return_value=mock_fred):
            bars = await client.get_series("GDP")

        assert all(b.ts.tzinfo is not None for b in bars)

    @pytest.mark.asyncio
    async def test_get_series_skips_nan_values(self, client: FredClient) -> None:
        data = {"2024-07-01": 28_000.0, "2024-10-01": float("nan"), "2025-01-01": 28_600.0}
        series = _make_series(data)
        mock_fred = MagicMock()
        mock_fred.get_series.return_value = series

        with patch("src.integrations.fred.Fred", return_value=mock_fred):
            bars = await client.get_series("GDP")

        assert len(bars) == 2  # NaN observation skipped
        assert bars[0].value == pytest.approx(28_000.0)
        assert bars[1].value == pytest.approx(28_600.0)

    @pytest.mark.asyncio
    async def test_get_series_empty_returns_empty_list(self, client: FredClient) -> None:
        mock_fred = MagicMock()
        mock_fred.get_series.return_value = pd.Series([], dtype=float)

        with patch("src.integrations.fred.Fred", return_value=mock_fred):
            bars = await client.get_series("GDP")

        assert bars == []

    @pytest.mark.asyncio
    async def test_get_series_exception_returns_empty_list(self, client: FredClient) -> None:
        mock_fred = MagicMock()
        mock_fred.get_series.side_effect = RuntimeError("network error")

        with patch("src.integrations.fred.Fred", return_value=mock_fred):
            bars = await client.get_series("GDP")

        assert bars == []

    @pytest.mark.asyncio
    async def test_get_series_passes_observation_start(self, client: FredClient) -> None:
        series = _make_series({"2025-01-01": 28_600.0})
        mock_fred = MagicMock()
        mock_fred.get_series.return_value = series

        with patch("src.integrations.fred.Fred", return_value=mock_fred):
            await client.get_series("GDP", observation_start=date(2025, 1, 1))

        call_kwargs = mock_fred.get_series.call_args
        assert "observation_start" in call_kwargs.kwargs
        assert call_kwargs.kwargs["observation_start"] == "2025-01-01"

    @pytest.mark.asyncio
    async def test_get_series_since_delegates_correctly(self, client: FredClient) -> None:
        series = _make_series({"2025-01-01": 28_600.0})
        mock_fred = MagicMock()
        mock_fred.get_series.return_value = series

        since = datetime(2025, 1, 1, tzinfo=timezone.utc)
        with patch("src.integrations.fred.Fred", return_value=mock_fred):
            bars = await client.get_series_since("GDP", since)

        assert len(bars) == 1
