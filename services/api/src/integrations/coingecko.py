"""
CoinGecko API integration client.

Why CoinGecko: Free tier requires no API key. Provides OHLCV data for the top
crypto assets (BTC, ETH, and up to 250 others) via the /coins/{id}/ohlc endpoint.

Rate limits (free tier, no key): 10-30 requests/minute depending on endpoint.
Source: https://www.coingecko.com/en/api/documentation
Tracked in Redis: keys.api_quota("coingecko", period).
Limit sourced from settings.coingecko_requests_per_minute — never hardcoded.

OHLCV endpoint note: /coins/{id}/ohlc returns data in OHLC format (no volume).
We use /coins/{id}/market_chart for full OHLCV including volume.
Days parameter: 1=hourly, 2-90=daily, 91+=weekly (CoinGecko behaviour).
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime

from pydantic import BaseModel, Field

from src.config import settings
from src.integrations.base import BaseIntegrationClient
from src.models.ch.ohlcv import OHLCVRow

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Raw API response schemas (internal — not exposed to router layer)
# ---------------------------------------------------------------------------


class _CoinListItem(BaseModel):
    """Single item from GET /coins/list."""

    id: str = Field(description="CoinGecko coin ID. e.g. 'bitcoin', 'ethereum'.")
    symbol: str = Field(description="Ticker symbol. e.g. 'btc', 'eth'.")
    name: str = Field(description="Human-readable name. e.g. 'Bitcoin'.")


class _MarketChartResponse(BaseModel):
    """
    Raw response from GET /coins/{id}/market_chart.

    prices, market_caps, total_volumes are lists of [timestamp_ms, value] pairs.
    """

    prices: list[list[float]] = Field(description="[[timestamp_ms, price], ...] pairs.")
    market_caps: list[list[float]] = Field(
        description="[[timestamp_ms, market_cap], ...] pairs."
    )
    total_volumes: list[list[float]] = Field(
        description="[[timestamp_ms, volume], ...] pairs."
    )


# ---------------------------------------------------------------------------
# CoinGecko client
# ---------------------------------------------------------------------------


class CoinGeckoClient(BaseIntegrationClient):
    """
    CoinGecko API client for crypto OHLCV and coin list data.

    Inherits retry, backoff, timeout, and error handling from BaseIntegrationClient.
    No API key required for the free tier.
    """

    provider_name = "coingecko"

    def __init__(self) -> None:
        # No API key for free tier. Base URL comes from settings for testability.
        super().__init__(api_key=None)
        # Override base_url after super().__init__ so settings is already loaded.
        self.base_url = settings.coingecko_base_url

    async def get_ohlcv(
        self,
        coin_id: str,
        vs_currency: str,
        days: int,
    ) -> list[OHLCVRow]:
        """
        Fetch OHLCV bars for a coin from the /coins/{id}/market_chart endpoint.

        Why market_chart over /ohlc: market_chart includes volume data.
        /ohlc only returns open/high/low/close without volume.

        Args:
            coin_id: CoinGecko coin ID (e.g. 'bitcoin', 'ethereum').
            vs_currency: Quote currency (e.g. 'usd').
            days: Number of days of history. 1=hourly granularity, 2-90=daily.

        Returns:
            List of OHLCVRow instances ordered by timestamp ascending.
        """
        raw = await self.get(
            f"/coins/{coin_id}/market_chart",
            params={
                "vs_currency": vs_currency,
                "days": days,
                "interval": "daily",
                "precision": "full",
            },
        )
        parsed = _MarketChartResponse.model_validate(raw)

        # Build a lookup from timestamp_ms → volume for joining with prices.
        volume_by_ts: dict[int, float] = {
            int(entry[0]): entry[1] for entry in parsed.total_volumes
        }

        rows: list[OHLCVRow] = []
        for price_entry in parsed.prices:
            ts_ms = int(price_entry[0])
            close = price_entry[1]
            ts = datetime.fromtimestamp(ts_ms / 1000, tz=UTC)
            rows.append(
                OHLCVRow(
                    symbol=coin_id.upper(),
                    timeframe="1D",
                    ts=ts,
                    # market_chart daily gives one price point per day (closing price).
                    # open/high/low are set equal to close — market_chart does not
                    # provide intraday OHLC. Use /ohlc endpoint for true candles.
                    open=close,
                    high=close,
                    low=close,
                    close=close,
                    volume=volume_by_ts.get(ts_ms, 0.0),
                    source=self.provider_name,
                )
            )

        return rows

    async def get_coin_list(self) -> list[_CoinListItem]:
        """
        Fetch the full list of coins from /coins/list.

        Used to seed the instruments table with CoinGecko IDs.
        This endpoint returns thousands of coins — filter by top-N after fetching.
        """
        raw = await self.get("/coins/list", params={"include_platform": "false"})
        if not isinstance(raw, list):
            logger.error(
                "coingecko /coins/list returned unexpected type: %s", type(raw)
            )
            return []
        return [_CoinListItem.model_validate(item) for item in raw]

    async def get_top_coins_by_market_cap(self, limit: int) -> list[_CoinListItem]:
        """
        Fetch top coins ranked by market cap from /coins/markets.

        Why this over get_coin_list: /coins/list returns all ~10k coins.
        /coins/markets returns coins pre-ranked by market cap, so we can
        fetch exactly the top-N without client-side sorting.

        Args:
            limit: Number of top coins to return (max 250 per CoinGecko API).
        """
        # CoinGecko markets endpoint returns max 250 per page.
        # Max 250 per CoinGecko API constraint — sourced from API docs, not hardcoded.
        per_page = min(limit, settings.coingecko_markets_per_page_max)
        raw = await self.get(
            "/coins/markets",
            params={
                "vs_currency": "usd",
                "order": "market_cap_desc",
                "per_page": per_page,
                "page": 1,
                "sparkline": "false",
            },
        )
        if not isinstance(raw, list):
            return []
        return [
            _CoinListItem(
                id=item["id"],
                symbol=item["symbol"],
                name=item["name"],
            )
            for item in raw
            if isinstance(item, dict)
        ]
