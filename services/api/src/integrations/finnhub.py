"""
Finnhub integration client.

Data source: Finnhub.io — free tier: 60 req/min, real-time quote data.
Terms: https://finnhub.io/terms — data for display only, no redistribution.
ADR-005: Finnhub approved as a supplemental quotes source.

Used as fallback when yfinance is unavailable or returns stale data.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

from src.integrations.base import BaseIntegrationClient
from src.schemas.market_data import QuoteResponse

logger = logging.getLogger(__name__)

# Finnhub API base URL — source: https://finnhub.io/docs/api
_FINNHUB_BASE_URL = "https://finnhub.io"


class FinnhubClient(BaseIntegrationClient):
    """
    Finnhub.io client — supplemental real-time quote data.

    Subclasses BaseIntegrationClient for retry, backoff, and timeout handling.
    API key is passed as a query parameter per Finnhub documentation.

    Usage:
        client = FinnhubClient(
            api_key=settings.finnhub_api_key,
            timeout_seconds=settings.finnhub_timeout_seconds,
        )
        quote = await client.get_quote("AAPL")
    """

    provider_name = "finnhub"
    base_url = _FINNHUB_BASE_URL

    def __init__(self, api_key: str, timeout_seconds: float, user_agent: str) -> None:
        # All params sourced from settings — never hardcoded. ADR-005.
        super().__init__(api_key=api_key)
        self._timeout_seconds = timeout_seconds
        self._user_agent = user_agent

    def _build_headers(self) -> dict[str, str]:
        return {
            "User-Agent": self._user_agent,
            "Accept": "application/json",
        }

    def _get_client(self) -> Any:
        """Override to apply the configured timeout from settings."""
        import httpx

        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                headers=self._build_headers(),
                timeout=httpx.Timeout(self._timeout_seconds),
                follow_redirects=True,
            )
        return self._client

    async def get_quote(self, symbol: str) -> QuoteResponse | None:
        """
        Fetch the latest real-time quote for *symbol* from Finnhub.

        Finnhub /api/v1/quote returns:
          c  — current price
          d  — change (absolute)
          dp — percent change
          h  — day high
          l  — day low
          o  — open price
          pc — previous close
          t  — timestamp (UNIX epoch)

        Returns None if Finnhub has no data for the symbol (c == 0.0).

        Args:
            symbol: Ticker symbol, e.g. "AAPL". Must be a valid Finnhub symbol.
        """
        # TODO(audit-H4): replace Any with dict[str, object] + isinstance narrowing
        data: dict[str, Any] = await self.get(  # type: ignore[assignment]
            "/api/v1/quote",
            params={"symbol": symbol, "token": self._api_key},
        )

        # Finnhub returns c=0 when the symbol is not found or has no data.
        current_price: float = float(data.get("c", 0.0))
        if current_price == 0.0:
            logger.debug("Finnhub returned no data for symbol %s", symbol)
            return None

        ts_epoch: int | None = data.get("t")
        ts: datetime | None = None
        if ts_epoch:
            ts = datetime.fromtimestamp(ts_epoch, tz=UTC)

        # dp is percent change (e.g. 1.5 means +1.5%). Convert to decimal fraction.
        dp: float | None = data.get("dp")
        change_24h: float | None = dp / 100.0 if dp is not None else None

        return QuoteResponse(
            symbol=symbol,
            price=current_price,
            change_24h=change_24h,
            volume_24h=None,  # Finnhub /quote does not return volume.
            ts=ts,
        )
