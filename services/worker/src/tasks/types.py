"""
Shared return type definitions for all Celery ingest tasks.

Why TypedDict: Celery tasks return plain dicts (JSON-serialisable for the
result backend). TypedDict enforces shape at static analysis time without
adding runtime cost — mypy validates callers without wrapping returns in
a class or dataclass.

All ingest tasks MUST return one of the TypedDicts defined here.
"""

from __future__ import annotations

from typing import TypedDict


class _OHLCVTaskResultBase(TypedDict):
    """Required fields present in every OHLCV ingest result."""

    inserted: int
    failed: list[str]
    mode: str


class OHLCVTaskResult(_OHLCVTaskResultBase, total=False):
    """
    Return shape for OHLCV ingestion tasks (CoinGecko, yfinance, FRED).

    Required fields (always present)
    ---------------------------------
    inserted : int
        Number of OHLCV rows successfully written to ClickHouse.
    failed : list[str]
        List of symbols or series that failed to fetch or insert.
    mode : str
        'live' when real API data was fetched; 'mock' when local fixture
        files were used (e.g. in development without live API keys).

    Optional fields (task-specific)
    --------------------------------
    coins_processed : int   — CoinGecko task
    symbols_processed : int — yfinance task
    series_processed : int  — FRED task
    """

    coins_processed: int
    symbols_processed: int
    series_processed: int


class SeedTaskResult(TypedDict):
    """
    Return shape for instrument/metadata seeding tasks.

    Fields
    ------
    upserted : int
        Number of rows inserted or updated in the instruments table.
    failed : list[str]
        List of symbols that could not be upserted.
    """

    upserted: int
    failed: list[str]
