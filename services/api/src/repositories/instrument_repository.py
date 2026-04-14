"""
PostgreSQL repository for instrument records.

No business logic — only reads and writes to the instruments table.
All queries use SQLAlchemy ORM or text() with bound parameters (never raw
string concatenation — CLAUDE.md Part X prohibition).
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.pg.instrument import Instrument


class InstrumentRepository:
    """
    Read/write access to the PostgreSQL `instruments` table.

    All write operations are idempotent — safe to re-run ingestion tasks
    without duplicating data.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_symbol(self, symbol: str) -> Instrument | None:
        """
        Look up a single instrument by its ticker symbol.

        Args:
            symbol: Ticker symbol to look up (case-sensitive — stored as-is).

        Returns:
            Instrument instance, or None if not found.
        """
        stmt = select(Instrument).where(Instrument.symbol == symbol)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_instruments(
        self,
        asset_class: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[Instrument], int]:
        """
        Paginated list of instruments, optionally filtered by asset_class.

        Args:
            asset_class: Filter by asset class ('equity', 'crypto', 'fx', 'macro').
                         None returns all asset classes.
            limit: Maximum number of rows to return.
            offset: Number of rows to skip (for pagination).

        Returns:
            Tuple of (instruments page, total matching count).
        """
        from sqlalchemy import true

        # `true()` is the SQLAlchemy no-op filter clause (matches every row).
        # Using Python `True` would fail mypy's ColumnElement type constraint.
        clause = (
            Instrument.asset_class == asset_class if asset_class is not None else true()
        )

        count_stmt = select(func.count()).select_from(Instrument).where(clause)
        total_result = await self._session.execute(count_stmt)
        total: int = total_result.scalar_one()

        rows_stmt = (
            select(Instrument)
            .where(clause)
            .order_by(Instrument.symbol)
            .limit(limit)
            .offset(offset)
        )
        rows_result = await self._session.execute(rows_stmt)
        instruments = list(rows_result.scalars().all())

        return instruments, total

    async def upsert(self, instrument: Instrument) -> Instrument:
        """
        Insert a new instrument or update the existing row if symbol already exists.

        Why upsert: ingestion tasks run repeatedly. Re-seeding instruments
        must not fail or duplicate rows — ON CONFLICT updates name/asset_class
        so corrections propagate automatically.

        Args:
            instrument: Instrument instance to insert or update.

        Returns:
            The persisted Instrument (refreshed from DB after upsert).
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
                    # Refresh updated_at on every conflict update so the row
                    # reflects when it was last synced. func.now() is evaluated
                    # DB-side — no client clock dependency.
                    "updated_at": func.now(),
                },
            )
            .returning(Instrument)
        )
        result = await self._session.execute(stmt)
        await self._session.commit()
        row = result.scalar_one()
        return row
