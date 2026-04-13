"""
Base HTTP client for all external API integrations.

Why this exists: Every external API client needs retry logic, exponential
backoff, timeout handling, and User-Agent headers. DRY principle — one
implementation used by marketstack.py, edgar.py, fred.py, etc.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# Default timeout for all external API calls
DEFAULT_TIMEOUT_SECONDS = 30

# Maximum number of retries on transient failures (429, 5xx)
DEFAULT_MAX_RETRIES = 3

# Initial backoff in seconds (doubles each retry)
INITIAL_BACKOFF_SECONDS = 1.0


class IntegrationError(Exception):
    """Raised when an external API returns an unrecoverable error."""

    def __init__(self, provider: str, status_code: int, message: str) -> None:
        self.provider = provider
        self.status_code = status_code
        super().__init__(f"{provider} API error {status_code}: {message}")


class RateLimitError(IntegrationError):
    """Raised when an external API returns HTTP 429 Too Many Requests."""
    pass


class BaseIntegrationClient:
    """
    Base class for all external data provider API clients.

    Subclass this for each provider (marketstack.py, edgar.py, etc.).
    Provides retry, backoff, timeout, and error handling.
    Subclasses must define: provider_name, base_url.
    """

    provider_name: str = "unknown"
    base_url: str = ""

    def __init__(self, api_key: str | None = None) -> None:
        self._api_key = api_key
        self._client: httpx.AsyncClient | None = None

    def _build_headers(self) -> dict[str, str]:
        """Override in subclasses to add provider-specific headers."""
        return {
            "User-Agent": "Bloomberg-Terminal/1.0 contact@yourdomain.com",
            "Accept": "application/json",
        }

    async def _get_client(self) -> httpx.AsyncClient:
        """Lazily create and return the shared HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                headers=self._build_headers(),
                timeout=httpx.Timeout(DEFAULT_TIMEOUT_SECONDS),
                follow_redirects=True,
            )
        return self._client

    async def get(
        self,
        path: str,
        params: dict[str, Any] | None = None,
        max_retries: int = DEFAULT_MAX_RETRIES,
    ) -> Any:
        """
        Perform a GET request with retry and exponential backoff.
        Raises IntegrationError on unrecoverable failures.
        Raises RateLimitError on HTTP 429.
        """
        client = await self._get_client()
        backoff = INITIAL_BACKOFF_SECONDS

        for attempt in range(max_retries + 1):
            try:
                response = await client.get(path, params=params)

                if response.status_code == 429:
                    raise RateLimitError(
                        self.provider_name,
                        429,
                        "Rate limit exceeded",
                    )

                if response.status_code >= 500:
                    if attempt < max_retries:
                        logger.warning(
                            "%s returned %s on attempt %s, retrying in %.1fs",
                            self.provider_name,
                            response.status_code,
                            attempt + 1,
                            backoff,
                        )
                        await asyncio.sleep(backoff)
                        backoff *= 2
                        continue

                    raise IntegrationError(
                        self.provider_name,
                        response.status_code,
                        response.text[:200],
                    )

                response.raise_for_status()
                return response.json()

            except (httpx.TimeoutException, httpx.NetworkError) as exc:
                if attempt < max_retries:
                    logger.warning(
                        "%s network error on attempt %s: %s, retrying in %.1fs",
                        self.provider_name,
                        attempt + 1,
                        exc,
                        backoff,
                    )
                    await asyncio.sleep(backoff)
                    backoff *= 2
                    continue
                raise IntegrationError(self.provider_name, 0, str(exc)) from exc

        raise IntegrationError(self.provider_name, 0, "Max retries exceeded")

    async def close(self) -> None:
        """Close the HTTP client. Call this on application shutdown."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
