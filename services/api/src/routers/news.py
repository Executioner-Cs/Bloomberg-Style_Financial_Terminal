"""
News router — stub, implementation in Phase 4+.
Contract: routers call services only. No DB queries here.
"""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/news")


@router.get("", summary="List news")
async def list_news() -> dict[str, object]:
    # TODO(#4): Implement news endpoint
    return {"news": [], "total": 0}
