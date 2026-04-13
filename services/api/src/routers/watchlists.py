"""
Watchlists router — stub, implementation in Phase 4+.
Contract: routers call services only. No DB queries here.
"""
from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/watchlists")


@router.get("", summary="List watchlists")
async def list_watchlists() -> dict[str, object]:
    # TODO(#4): Implement watchlists endpoint
    return {"watchlists": [], "total": 0}
