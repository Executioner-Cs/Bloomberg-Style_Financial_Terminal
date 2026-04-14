"""
Macro router — stub, implementation in Phase 4+.
Contract: routers call services only. No DB queries here.
"""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/macro")


@router.get("", summary="List macro")
async def list_macro() -> dict[str, object]:
    # TODO(#4): Implement macro endpoint
    return {"macro": [], "total": 0}
