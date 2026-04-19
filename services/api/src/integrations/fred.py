"""
FRED (Federal Reserve Economic Data) integration client via the fredapi library.

Why not BaseIntegrationClient: fredapi is a Python library with its own
HTTP session. There is no HTTP client surface to configure or override.
All network I/O is synchronous and managed by the library itself.

ADR-005: FRED approved as the macro data source. Free API key required;
register at https://fred.stlouisfed.org/docs/api/api_key.html.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, date, datetime
from functools import partial

import pandas as pd
from fredapi import Fred

from src.schemas.macro import MacroBar

logger = logging.getLogger(__name__)

# Data source label written into MacroBar and MacroRow — used for audit.
_SOURCE = "fred"


def _fetch_series_sync(
    api_key: str,
    series_id: str,
    observation_start: date | None,
    timeout_seconds: float,
) -> list[MacroBar]:
    """
    Synchronous FRED fetch — must be called inside run_in_executor.

    fredapi.Fred.get_series is blocking network I/O.

    Returns observations as MacroBar list, oldest-first.
    """
    # fredapi does not expose a timeout parameter; the underlying requests session
    # timeout is set via an undocumented attribute. Per ADR-005, we accept this
    # limitation — FRED is a low-frequency source (weekly ingestion).
    client = Fred(api_key=api_key)

    kwargs: dict[str, object] = {}
    if observation_start is not None:
        kwargs["observation_start"] = observation_start.isoformat()

    series: pd.Series = client.get_series(series_id, **kwargs)

    if series.empty:
        logger.warning("FRED returned empty series for %s", series_id)
        return []

    bars: list[MacroBar] = []
    for idx, value in series.items():
        if pd.isna(value):
            # FRED sometimes includes NaN for unreleased future observations — skip.
            continue

        # fredapi returns pd.Timestamp as index.
        if isinstance(idx, pd.Timestamp):
            dt = idx.to_pydatetime()
        else:
            dt = pd.Timestamp(idx).to_pydatetime()

        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)

        bars.append(MacroBar(ts=dt, value=float(value)))

    return bars


class FredClient:
    """
    Async wrapper around the synchronous fredapi library.

    All blocking calls are dispatched to the default executor so the
    event loop is never blocked.

    Usage:
        client = FredClient(
            api_key=settings.fred_api_key,
            timeout_seconds=settings.fred_timeout_seconds,
        )
        bars = await client.get_series("GDP")
    """

    def __init__(self, api_key: str, timeout_seconds: float) -> None:
        # API key and timeout sourced from settings — never hardcoded. ADR-005.
        self._api_key = api_key
        self._timeout = timeout_seconds

    async def get_series(
        self,
        series_id: str,
        observation_start: date | None = None,
    ) -> list[MacroBar]:
        """
        Fetch all observations for *series_id* from FRED.

        Args:
            series_id: FRED series identifier, e.g. "GDP", "CPIAUCSL".
            observation_start: If provided, only observations on or after this
                date are returned. Use to fetch only new data since last ingest.

        Returns:
            List of MacroBar observations, oldest-first. Empty list if FRED
            returns no data or the series does not exist.
        """
        loop = asyncio.get_running_loop()
        fn = partial(
            _fetch_series_sync,
            self._api_key,
            series_id,
            observation_start,
            self._timeout,
        )
        try:
            bars = await loop.run_in_executor(None, fn)
        except Exception as exc:
            logger.exception("FRED fetch failed for series %s: %s", series_id, exc)
            return []
        logger.debug("FRED fetched %d observations for series %s", len(bars), series_id)
        return bars

    async def get_series_since(self, series_id: str, since: datetime) -> list[MacroBar]:
        """
        Fetch observations for *series_id* on or after *since*.

        Convenience wrapper for incremental ingestion — pass the latest stored
        observation datetime to fetch only new data.
        """
        return await self.get_series(series_id, observation_start=since.date())
