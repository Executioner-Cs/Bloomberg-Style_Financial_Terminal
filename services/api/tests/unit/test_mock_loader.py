"""
Unit tests for MockDataLoader.

Tests use the actual generated mock_data/ files (committed to git).
No mocking required — MockDataLoader reads from the filesystem.

MockDataLoader contract:
  - get_ohlcv(symbol, timeframe) → list[OHLCVRow], 365 bars, oldest-first
  - get_instruments() → list[InstrumentResponse], 50 instruments
  - get_quote(symbol) → QuoteResponse | None
  - get_macro_series(series_id) → MacroSeriesResponse | None
  - get_macro_rows(series_id) → list[MacroRow]
  - raises MockDataError for unknown symbols
"""

from __future__ import annotations

from datetime import timezone
from pathlib import Path

import pytest

from src.integrations.mock_loader import MockDataError, MockDataLoader
from src.models.ch.macro import MacroRow
from src.models.ch.ohlcv import OHLCVRow
from src.schemas.instruments import InstrumentResponse
from src.schemas.macro import MacroSeriesResponse
from src.schemas.market_data import QuoteResponse


def _find_mock_data_dir() -> Path:
    """Walk up from this file to the project root, return mock_data/."""
    current = Path(__file__).resolve().parent
    while current != current.parent:
        if (current / ".git").exists():
            return current / "mock_data"
        current = current.parent
    return Path(__file__).resolve().parents[5] / "mock_data"


@pytest.fixture(scope="module")
def loader() -> MockDataLoader:
    """Shared MockDataLoader pointing at the committed mock_data/ directory."""
    mock_dir = _find_mock_data_dir()
    assert mock_dir.exists(), (
        f"mock_data/ directory not found at {mock_dir}. "
        "Run scripts/generate_mock_data.py first."
    )
    return MockDataLoader(mock_dir)


# ---------------------------------------------------------------------------
# get_ohlcv
# ---------------------------------------------------------------------------


class TestGetOHLCV:
    def test_get_ohlcv_returns_list_of_ohlcv_rows(self, loader: MockDataLoader) -> None:
        rows = loader.get_ohlcv("BTC")
        assert len(rows) == 365
        assert all(isinstance(r, OHLCVRow) for r in rows)

    def test_get_ohlcv_symbol_and_timeframe_set(self, loader: MockDataLoader) -> None:
        rows = loader.get_ohlcv("AAPL", "1D")
        assert all(r.symbol == "AAPL" for r in rows)
        assert all(r.timeframe == "1D" for r in rows)

    def test_get_ohlcv_source_is_mock(self, loader: MockDataLoader) -> None:
        rows = loader.get_ohlcv("ETH")
        assert all(r.source == "mock" for r in rows)

    def test_get_ohlcv_timestamps_are_utc_aware(self, loader: MockDataLoader) -> None:
        rows = loader.get_ohlcv("MSFT")
        assert all(r.ts.tzinfo is not None for r in rows)
        assert all(r.ts.tzinfo == timezone.utc or str(r.ts.tzinfo) == "UTC" for r in rows)

    def test_get_ohlcv_prices_are_positive(self, loader: MockDataLoader) -> None:
        rows = loader.get_ohlcv("BTC")
        assert all(r.open > 0 for r in rows)
        assert all(r.high >= r.low for r in rows)
        assert all(r.close > 0 for r in rows)
        assert all(r.volume >= 0 for r in rows)

    def test_get_ohlcv_crypto_has_no_adj_close(self, loader: MockDataLoader) -> None:
        rows = loader.get_ohlcv("BTC")
        assert all(r.adj_close is None for r in rows)

    def test_get_ohlcv_equity_has_adj_close(self, loader: MockDataLoader) -> None:
        rows = loader.get_ohlcv("AAPL")
        assert all(r.adj_close is not None for r in rows)

    def test_get_ohlcv_raises_for_unknown_symbol(self, loader: MockDataLoader) -> None:
        with pytest.raises(MockDataError, match="Mock data file not found"):
            loader.get_ohlcv("UNKNOWN_XYZ_999")

    def test_get_ohlcv_equity_symbol(self, loader: MockDataLoader) -> None:
        rows = loader.get_ohlcv("NVDA")
        assert len(rows) == 365


# ---------------------------------------------------------------------------
# get_instruments
# ---------------------------------------------------------------------------


class TestGetInstruments:
    def test_get_instruments_returns_50_instruments(self, loader: MockDataLoader) -> None:
        instruments = loader.get_instruments()
        assert len(instruments) == 50

    def test_get_instruments_returns_instrument_response_objects(
        self, loader: MockDataLoader
    ) -> None:
        instruments = loader.get_instruments()
        assert all(isinstance(i, InstrumentResponse) for i in instruments)

    def test_get_instruments_has_crypto_and_equity(self, loader: MockDataLoader) -> None:
        instruments = loader.get_instruments()
        asset_classes = {i.asset_class for i in instruments}
        assert "crypto" in asset_classes
        assert "equity" in asset_classes

    def test_get_instruments_all_active(self, loader: MockDataLoader) -> None:
        instruments = loader.get_instruments()
        assert all(i.is_active for i in instruments)

    def test_get_instruments_btc_present(self, loader: MockDataLoader) -> None:
        instruments = loader.get_instruments()
        symbols = {i.symbol for i in instruments}
        assert "BTC" in symbols
        assert "AAPL" in symbols


# ---------------------------------------------------------------------------
# get_quote
# ---------------------------------------------------------------------------


class TestGetQuote:
    def test_get_quote_returns_quote_response(self, loader: MockDataLoader) -> None:
        quote = loader.get_quote("BTC")
        assert isinstance(quote, QuoteResponse)

    def test_get_quote_price_is_positive(self, loader: MockDataLoader) -> None:
        quote = loader.get_quote("AAPL")
        assert quote is not None
        assert quote.price is not None
        assert quote.price > 0

    def test_get_quote_symbol_matches(self, loader: MockDataLoader) -> None:
        quote = loader.get_quote("ETH")
        assert quote is not None
        assert quote.symbol == "ETH"

    def test_get_quote_returns_none_for_unknown_symbol(self, loader: MockDataLoader) -> None:
        quote = loader.get_quote("UNKNOWN_XYZ")
        assert quote is None

    def test_get_quote_ts_is_set(self, loader: MockDataLoader) -> None:
        quote = loader.get_quote("MSFT")
        assert quote is not None
        assert quote.ts is not None


# ---------------------------------------------------------------------------
# get_macro_series
# ---------------------------------------------------------------------------


class TestGetMacroSeries:
    def test_get_macro_series_returns_response(self, loader: MockDataLoader) -> None:
        result = loader.get_macro_series("GDP")
        assert isinstance(result, MacroSeriesResponse)

    def test_get_macro_series_has_bars(self, loader: MockDataLoader) -> None:
        result = loader.get_macro_series("GDP")
        assert result is not None
        assert len(result.bars) > 0

    def test_get_macro_series_series_id_matches(self, loader: MockDataLoader) -> None:
        result = loader.get_macro_series("CPIAUCSL")
        assert result is not None
        assert result.series_id == "CPIAUCSL"

    def test_get_macro_series_source_is_mock(self, loader: MockDataLoader) -> None:
        result = loader.get_macro_series("FEDFUNDS")
        assert result is not None
        assert result.source == "mock"

    def test_get_macro_series_returns_none_for_unknown(self, loader: MockDataLoader) -> None:
        result = loader.get_macro_series("UNKNOWN_SERIES")
        assert result is None

    def test_get_macro_series_timestamps_utc_aware(self, loader: MockDataLoader) -> None:
        result = loader.get_macro_series("UNRATE")
        assert result is not None
        assert all(bar.ts.tzinfo is not None for bar in result.bars)

    @pytest.mark.parametrize("series_id", ["GDP", "CPIAUCSL", "FEDFUNDS", "DGS10", "UNRATE"])
    def test_get_macro_series_all_five_series(
        self, loader: MockDataLoader, series_id: str
    ) -> None:
        result = loader.get_macro_series(series_id)
        assert result is not None
        assert len(result.bars) > 0


# ---------------------------------------------------------------------------
# get_macro_rows
# ---------------------------------------------------------------------------


class TestGetMacroRows:
    def test_get_macro_rows_returns_macro_row_list(self, loader: MockDataLoader) -> None:
        rows = loader.get_macro_rows("GDP")
        assert len(rows) > 0
        assert all(isinstance(r, MacroRow) for r in rows)

    def test_get_macro_rows_series_id_set(self, loader: MockDataLoader) -> None:
        rows = loader.get_macro_rows("CPIAUCSL")
        assert all(r.series_id == "CPIAUCSL" for r in rows)

    def test_get_macro_rows_source_is_mock(self, loader: MockDataLoader) -> None:
        rows = loader.get_macro_rows("FEDFUNDS")
        assert all(r.source == "mock" for r in rows)

    def test_get_macro_rows_returns_empty_for_unknown(self, loader: MockDataLoader) -> None:
        rows = loader.get_macro_rows("NONEXISTENT_SERIES")
        assert rows == []
