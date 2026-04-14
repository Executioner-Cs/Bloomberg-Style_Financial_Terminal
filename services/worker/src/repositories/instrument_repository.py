"""
PostgreSQL instrument repository — worker service copy.

Why a separate copy: the worker and api are separate Python packages.
CLAUDE.md prohibits cross-service imports. This file is kept in sync
with services/api/src/repositories/instrument_repository.py manually.
"""

from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.instrument import Instrument


class InstrumentRepository:
    """Read/write access to the PostgreSQL `instruments` table."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def upsert(self, instrument: Instrument) -> None:
        """
        Insert a new instrument or update the existing row if symbol already exists.

        Idempotent — safe to re-run ingestion tasks without duplicating data.
        """
        stmt = (
            insert(Instrument)
            .values(
                symbol=instrument.symbol,
                name=instrument.name,
                asset_class=instrument.asset_class,
                exchange=instrument.exchange,
                currency=instrument.currency,
                is_active=instrument.is_active,
            )
            .on_conflict_do_update(
                index_elements=["symbol"],
                set_={
                    "name": instrument.name,
                    "asset_class": instrument.asset_class,
                    "exchange": instrument.exchange,
                    "currency": instrument.currency,
                    "is_active": instrument.is_active,
                    "updated_at": func.now(),
                },
            )
        )
        await self._session.execute(stmt)
        await self._session.commit()
