"""
SQLAlchemy 2.0 ORM model for the instruments table.

Why a mapped dataclass: combines Python dataclass ergonomics with SQLAlchemy's
ORM machinery. All columns are explicitly typed — no implicit Any from Column().
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Shared declarative base for all PostgreSQL models."""


class Instrument(Base):
    """
    Represents a tradeable instrument across all asset classes.

    asset_class values: 'equity', 'crypto', 'fx', 'macro'
    Enforced at the application layer (InstrumentRepository.upsert) and
    validated in the InstrumentResponse Pydantic schema.
    """

    __tablename__ = "instruments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        doc="Surrogate key. UUID avoids int sequence contention in multi-region setups.",
    )
    symbol: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        unique=True,
        doc="Ticker symbol. Unique per instrument. Examples: BTC, AAPL, EUR/USD.",
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        doc="Human-readable instrument name. Example: Bitcoin, Apple Inc.",
    )
    asset_class: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        doc="Asset class: 'equity', 'crypto', 'fx', or 'macro'.",
    )
    exchange: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        doc="Exchange identifier. NULL for crypto (multi-exchange) and macro series.",
    )
    currency: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="USD",
        doc="Denomination currency. ISO 4217 code. Defaults to USD.",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        doc="False when an instrument is delisted or no longer tracked.",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        doc="Row creation timestamp (UTC).",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        doc="Last upsert timestamp (UTC). Updated by InstrumentRepository on write.",
    )
