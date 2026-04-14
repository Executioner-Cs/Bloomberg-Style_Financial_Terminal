"""
Users router — stub, implementation in Phase 4+.
Contract: routers call services only. No DB queries here.
"""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/users")


@router.get("", summary="List users")
async def list_users() -> dict[str, object]:
    # TODO(#4): Implement users endpoint
    return {"users": [], "total": 0}
