"""
Search router — stub, implementation in Phase 4+.
Contract: routers call services only. No DB queries here.
"""
from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/search")


@router.get("", summary="List search")
async def list_search() -> dict[str, object]:
    # TODO(#4): Implement search endpoint
    return {"search": [], "total": 0}
