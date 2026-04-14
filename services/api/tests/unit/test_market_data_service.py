"""
Unit tests for MarketDataService.

All external dependencies (OHLCVRepository, Redis) are mocked.
Tests verify the cache-aside pattern: cache hit skips repo, cache miss calls repo.
"""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest

from src.models.ch.ohlcv import OHLCVRow
from src.services.market_data_service import MarketDataService

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _make_row(
    ts: datetime,
    close: float = 50000.0,
    volume: float = 100.0,
) -> OHLCVRow:
    return OHLCVRow(
        symbol="BITCOIN",
        timeframe="1D",
        ts=ts,
        open=close,
        high=close,
        low=close,
        close=close,
        volume=volume,
        source="coingecko",
    )


def _make_service(
    repo: object | None = None,
    redis: object | None = None,
) -> MarketDataService:
    repo = repo or AsyncMock()
    redis = redis or AsyncMock()
    return MarketDataService(ohlcv_repo=repo, redis=redis)  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# get_ohlcv — cache-aside
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_ohlcv_cache_miss_calls_repository() -> None:
    """On cache miss, the repository is queried and result is stored in Redis."""
    ts = datetime(2024, 1, 1, tzinfo=UTC)
    row = _make_row(ts)

    repo = AsyncMock()
    repo.get_bars.return_value = [row]

    redis = AsyncMock()
    redis.get.return_value = None  # cache miss

    service = _make_service(repo, redis)
    result = await service.get_ohlcv("BITCOIN", "1D", ts, ts)

    repo.get_bars.assert_awaited_once()
    redis.setex.assert_awaited_once()
    assert len(result.bars) == 1
    assert result.bars[0].close == pytest.approx(50000.0)


@pytest.mark.asyncio
async def test_get_ohlcv_cache_hit_skips_repository() -> None:
    """On cache hit, the repository is NOT called — value served from Redis."""
    from src.schemas.market_data import OHLCVBar, OHLCVResponse

    ts = datetime(2024, 1, 1, tzinfo=UTC)
    cached_response = OHLCVResponse(
        symbol="BITCOIN",
        timeframe="1D",
        bars=[
            OHLCVBar(
                ts=ts,
                open=48000.0,
                high=48000.0,
                low=48000.0,
                close=48000.0,
                volume=200.0,
            )
        ],
        source="coingecko",
    )

    repo = AsyncMock()
    redis = AsyncMock()
    redis.get.return_value = cached_response.model_dump_json()

    service = _make_service(repo, redis)
    result = await service.get_ohlcv("BITCOIN", "1D", ts, ts)

    repo.get_bars.assert_not_awaited()
    assert result.bars[0].close == pytest.approx(48000.0)


@pytest.mark.asyncio
async def test_get_ohlcv_empty_bars_returns_unknown_source() -> None:
    """When ClickHouse has no data, source defaults to 'unknown'."""
    ts = datetime(2024, 1, 1, tzinfo=UTC)
    repo = AsyncMock()
    repo.get_bars.return_value = []

    redis = AsyncMock()
    redis.get.return_value = None

    service = _make_service(repo, redis)
    result = await service.get_ohlcv("BITCOIN", "1D", ts, ts)

    assert result.source == "unknown"
    assert result.bars == []


# ---------------------------------------------------------------------------
# get_quote — cache-aside and 24h change calculation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_quote_cache_miss_calls_repository() -> None:
    """Quote cache miss: fetches latest bars, computes change, stores in Redis."""
    ts_today = datetime(2024, 6, 15, tzinfo=UTC)
    ts_yesterday = datetime(2024, 6, 14, tzinfo=UTC)
    rows = [_make_row(ts_yesterday, close=40000.0), _make_row(ts_today, close=44000.0)]

    repo = AsyncMock()
    repo.get_bars.return_value = rows

    redis = AsyncMock()
    redis.get.return_value = None

    service = _make_service(repo, redis)
    result = await service.get_quote("BITCOIN")

    assert result.price == pytest.approx(44000.0)
    # 24h change: (44000 - 40000) / 40000 = 0.1
    assert result.change_24h == pytest.approx(0.1)
    redis.setex.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_quote_cache_hit_skips_repository() -> None:
    """Quote cache hit: repository is not called."""
    from src.schemas.market_data import QuoteResponse

    cached = QuoteResponse(symbol="BITCOIN", price=99999.0)
    repo = AsyncMock()
    redis = AsyncMock()
    redis.get.return_value = cached.model_dump_json()

    service = _make_service(repo, redis)
    result = await service.get_quote("BITCOIN")

    repo.get_bars.assert_not_awaited()
    assert result.price == pytest.approx(99999.0)


@pytest.mark.asyncio
async def test_get_quote_no_data_returns_none_price() -> None:
    """If ClickHouse has no rows for the symbol, price is None."""
    repo = AsyncMock()
    repo.get_bars.return_value = []

    redis = AsyncMock()
    redis.get.return_value = None

    service = _make_service(repo, redis)
    result = await service.get_quote("UNKNOWN")

    assert result.price is None
    assert result.change_24h is None


@pytest.mark.asyncio
async def test_get_quote_single_bar_no_change() -> None:
    """With only one bar, 24h change is None (no previous bar to compare)."""
    ts = datetime(2024, 1, 1, tzinfo=UTC)
    repo = AsyncMock()
    repo.get_bars.return_value = [_make_row(ts, close=30000.0)]

    redis = AsyncMock()
    redis.get.return_value = None

    service = _make_service(repo, redis)
    result = await service.get_quote("BITCOIN")

    assert result.price == pytest.approx(30000.0)
    assert result.change_24h is None


# ---------------------------------------------------------------------------
# get_bulk_quotes — error isolation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_bulk_quotes_skips_failed_symbol() -> None:
    """If one symbol raises, it is omitted from results — others are unaffected."""
    ts = datetime(2024, 1, 1, tzinfo=UTC)
    good_row = _make_row(ts, close=50000.0)

    redis = AsyncMock()
    redis.get.return_value = None

    repo = AsyncMock()

    def side_effect(*args: object, **kwargs: object) -> list[OHLCVRow]:
        symbol = args[0] if args else kwargs.get("symbol", "")
        if symbol == "BADCOIN":
            raise RuntimeError("simulated failure")
        return [good_row]

    repo.get_bars.side_effect = side_effect

    service = _make_service(repo, redis)
    results = await service.get_bulk_quotes(["BITCOIN", "BADCOIN"])

    assert "BITCOIN" in results
    assert "BADCOIN" not in results
    assert results["BITCOIN"].price == pytest.approx(50000.0)
