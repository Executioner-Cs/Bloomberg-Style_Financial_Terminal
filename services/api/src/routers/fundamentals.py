"""
Fundamentals router — stub, implementation in Phase 4+.
Contract: routers call services only. No DB queries here.
"""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/fundamentals")


@router.get("", summary="List fundamentals")
async def list_fundamentals() -> dict[str, object]:
    # TODO(#4): Implement fundamentals endpoint
    return {"fundamentals": [], "total": 0}
