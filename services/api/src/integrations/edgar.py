"""
SEC EDGAR integration client.

Data source: EDGAR Full-Text Search API (EFTS) — unlimited, no API key required.
EDGAR ToS: https://www.sec.gov/developer — User-Agent header required.

ADR-005: EDGAR approved as the filings data source. US government data.
User-Agent must include a valid contact email per ToS (see EDGAR_USER_AGENT env var).
"""

from __future__ import annotations

import logging
from datetime import UTC, date, datetime
from typing import Any
from urllib.parse import urljoin

from src.integrations.base import BaseIntegrationClient
from src.schemas.filings import SUPPORTED_FORM_TYPES, Filing, FilingsResponse

logger = logging.getLogger(__name__)

# EDGAR EFTS base URL — the full-text search index API.
# Source: https://efts.sec.gov/LATEST/search-index documentation.
_EFTS_BASE_URL = "https://efts.sec.gov"

# EDGAR data API base URL — used to resolve accession URLs.
# Source: https://www.sec.gov/developer
_DATA_BASE_URL = "https://www.sec.gov"

# Maximum results per EFTS page. EDGAR caps at 10 per request per their API spec.
# Source: EDGAR EFTS documentation (implicit limit on result set).
_MAX_RESULTS_PER_PAGE = 10

# Accession number format used to build the filing index URL.
# Format: {cik}/{accession_no_dashes}/index.json
# Source: https://www.sec.gov/developer (EDGAR API conventions)
_FILING_INDEX_PATH_TEMPLATE = (
    "/Archives/edgar/data/{cik}/{accession}/{filename}-index.htm"
)


class EDGARClient(BaseIntegrationClient):
    """
    SEC EDGAR EFTS client — fetches recent filings for a given ticker symbol.

    Subclasses BaseIntegrationClient for retry, backoff, and timeout handling.
    EDGAR ToS requires a User-Agent header — passed via settings.edgar_user_agent.
    """

    provider_name = "edgar"
    base_url = _EFTS_BASE_URL

    def __init__(self, user_agent: str, timeout_seconds: float) -> None:
        # Both params sourced from settings — never hardcoded. ADR-005.
        super().__init__()
        self._user_agent = user_agent
        self._timeout_seconds = timeout_seconds

    def _build_headers(self) -> dict[str, str]:
        """
        Override to inject the EDGAR-required User-Agent header.

        EDGAR ToS mandates a User-Agent of format:
        "CompanyName/Version contact@email.com"
        Requests without this header may be rate-limited or blocked.
        """
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

    def _build_filing_url(self, cik: str, accession_number: str) -> str:
        """
        Build the EDGAR filing index URL for a given CIK and accession number.

        Accession numbers in EDGAR are stored without dashes in the path
        but displayed with dashes in the accession_number field.
        Source: https://www.sec.gov/developer (EDGAR API conventions).
        """
        # Remove dashes from accession number for use in URL path.
        accession_no_dashes = accession_number.replace("-", "")
        # The index file name uses the dashed accession number.
        filename = accession_number
        path = _FILING_INDEX_PATH_TEMPLATE.format(
            cik=cik,
            accession=accession_no_dashes,
            filename=filename,
        )
        return urljoin(_DATA_BASE_URL, path)

    @staticmethod
    def _parse_date(raw: str | None) -> date | None:
        """Parse EDGAR date string (YYYY-MM-DD) into a date object."""
        if not raw:
            return None
        try:
            return date.fromisoformat(raw)
        except ValueError:
            return None

    @staticmethod
    def _parse_datetime(raw: str | None) -> datetime | None:
        """Parse EDGAR datetime string into a UTC-aware datetime."""
        if not raw:
            return None
        try:
            dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=UTC)
            return dt
        except ValueError:
            return None

    async def get_recent_filings(
        self,
        symbol: str,
        form_types: list[str] | None = None,
        start_date: date | None = None,
        limit: int = _MAX_RESULTS_PER_PAGE,
    ) -> FilingsResponse:
        """
        Fetch recent filings for *symbol* from EDGAR EFTS.

        Args:
            symbol: Ticker symbol, e.g. "AAPL". Used as the search query.
            form_types: List of form types to filter by. Defaults to all
                        SUPPORTED_FORM_TYPES (10-K, 10-Q, 8-K).
            start_date: Only include filings on or after this date.
            limit: Maximum number of filings to return. EDGAR caps at 10/page.

        Returns:
            FilingsResponse with the matching filings, newest-first.
        """
        if form_types is None:
            form_types = list(SUPPORTED_FORM_TYPES)

        # Validate form types against supported set — prevent arbitrary API queries.
        invalid = set(form_types) - SUPPORTED_FORM_TYPES
        if invalid:
            raise ValueError(
                f"Unsupported form types: {invalid}. Supported: {SUPPORTED_FORM_TYPES}"
            )

        params: dict[str, str] = {
            "q": f'"{symbol}"',
            "forms": ",".join(sorted(form_types)),
            "dateRange": "custom",
            "_source": "filing",
        }
        if start_date is not None:
            params["startdt"] = start_date.isoformat()

        data: dict[str, Any] = await self.get(
            "/LATEST/search-index",
            params=params,
        )

        hits: list[dict[str, Any]] = data.get("hits", {}).get("hits", [])
        filings: list[Filing] = []

        for hit in hits[:limit]:
            src: dict[str, Any] = hit.get("_source", {})
            filed_at = self._parse_datetime(src.get("file_date"))
            period_of_report = self._parse_date(src.get("period_of_report"))

            if filed_at is None or period_of_report is None:
                logger.debug(
                    "Skipping EDGAR hit with missing dates: %s", hit.get("_id")
                )
                continue

            cik: str = src.get("entity_id", "").lstrip("0") or src.get("entity_id", "")
            accession_number: str = src.get("file_num", hit.get("_id", ""))
            filing_url = self._build_filing_url(cik, accession_number)

            filings.append(
                Filing(
                    symbol=symbol,
                    form_type=src.get("form_type", ""),
                    filed_at=filed_at,
                    period_of_report=period_of_report,
                    accession_number=accession_number,
                    filing_url=filing_url,
                    description=src.get("file_description"),
                )
            )

        return FilingsResponse(symbol=symbol, filings=filings, total=len(filings))
