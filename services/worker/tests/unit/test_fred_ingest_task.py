"""
Unit tests for the FRED macro ingestion Celery task (mock mode).

Focus: verify the `refresh_macro_series` async implementation in mock mode
loads every configured series from MockDataLoader and writes them to the
ClickHouse repository. Live mode (network + FRED API) is out of scope —
covered by integration tests when a FRED key is provisioned.

Why mock mode is the default CI smoke test: ADR-006 guarantees
mock_data/ is committed to git, so the test runs deterministically on
every PR without external dependencies.
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.models.macro import MacroRow
from src.tasks.fred_ingest import _refresh_macro_series_async


def _find_mock_data_dir() -> Path:
    """Walk up from this file to the project root, return mock_data/."""
    current = Path(__file__).resolve().parent
    while current != current.parent:
        if (current / ".git").exists():
            return current / "mock_data"
        current = current.parent
    return Path(__file__).resolve().parents[5] / "mock_data"


@pytest.mark.asyncio
async def test_refresh_macro_series_mock_mode_inserts_all_series() -> None:
    """Mock mode: every configured series yields rows, all inserted."""
    mock_dir = _find_mock_data_dir()
    assert (
        mock_dir.exists()
    ), f"mock_data/ not found at {mock_dir}. Run scripts/generate_mock_data.py."

    captured_rows: list[MacroRow] = []

    async def _capture_insert(rows: list[MacroRow]) -> None:
        captured_rows.extend(rows)

    fake_ch = AsyncMock()
    fake_repo = MagicMock()
    fake_repo.insert_rows = AsyncMock(side_effect=_capture_insert)

    with (
        patch("src.tasks.fred_ingest.settings") as mock_settings,
        patch(
            "src.tasks.fred_ingest.clickhouse_connect.get_async_client",
            new=AsyncMock(return_value=fake_ch),
        ),
        patch("src.tasks.fred_ingest.MacroRepository", return_value=fake_repo),
    ):
        mock_settings.use_mock_data = True
        mock_settings.mock_data_dir = str(mock_dir)
        mock_settings.fred_series_ids = [
            "GDP",
            "CPIAUCSL",
            "FEDFUNDS",
            "DGS10",
            "UNRATE",
        ]
        mock_settings.clickhouse_host = "localhost"
        mock_settings.clickhouse_http_port = 8123
        mock_settings.clickhouse_database = "terminal"
        mock_settings.clickhouse_user = "default"
        mock_settings.clickhouse_password = ""

        result = await _refresh_macro_series_async()

    assert result["mode"] == "mock"
    assert result["series_processed"] == 5
    assert result["failed"] == []
    inserted = result["inserted"]
    assert isinstance(inserted, int) and inserted > 0
    assert len(captured_rows) == inserted
    series_seen = {row.series_id for row in captured_rows}
    assert series_seen == {"GDP", "CPIAUCSL", "FEDFUNDS", "DGS10", "UNRATE"}


@pytest.mark.asyncio
async def test_refresh_macro_series_live_mode_skipped_without_api_key() -> None:
    """Live mode without FRED_API_KEY returns skipped, no side effects."""
    with patch("src.tasks.fred_ingest.settings") as mock_settings:
        mock_settings.use_mock_data = False
        mock_settings.fred_api_key = ""
        result = await _refresh_macro_series_async()

    assert result == {
        "inserted": 0,
        "failed": [],
        "series_processed": 0,
        "mode": "skipped",
    }
