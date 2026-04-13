"""
Portfolios router — stub, implementation in Phase 4+.
Contract: routers call services only. No DB queries here.
"""
from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/portfolios")


@router.get("", summary="List portfolios")
async def list_portfolios() -> dict[str, object]:
    # TODO(#4): Implement portfolios endpoint
    return {"portfolios": [], "total": 0}
