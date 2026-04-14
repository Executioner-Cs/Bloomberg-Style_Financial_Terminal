"""
SQLAlchemy 2.0 ORM model for the instruments table — worker service copy.

Why a separate copy: the worker and api are separate Python packages.
CLAUDE.md prohibits cross-service imports. This file is kept in sync
with services/api/src/models/pg/instrument.py manually.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, MappedAsDataclass, mapped_column


class Base(DeclarativeBase):
    """Shared declarative base for all PostgreSQL models in the worker."""


class Instrument(MappedAsDataclass, Base):
    """Represents a tradeable instrument across all asset classes."""

    __tablename__ = "instruments"

    symbol: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    asset_class: Mapped[str] = mapped_column(String(50), nullable=False)
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default_factory=uuid.uuid4
    )
    exchange: Mapped[str | None] = mapped_column(
        String(50), nullable=True, default=None
    )
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="USD")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        init=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        init=False,
    )
