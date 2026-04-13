"""
Screener router — stub, implementation in Phase 4+.
Contract: routers call services only. No DB queries here.
"""
from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/screener")


@router.get("", summary="List screener")
async def list_screener() -> dict[str, object]:
    # TODO(#4): Implement screener endpoint
    return {"screener": [], "total": 0}
