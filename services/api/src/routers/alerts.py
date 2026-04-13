"""
Alerts router — stub, implementation in Phase 4+.
Contract: routers call services only. No DB queries here.
"""
from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/alerts")


@router.get("", summary="List alerts")
async def list_alerts() -> dict[str, object]:
    # TODO(#4): Implement alerts endpoint
    return {"alerts": [], "total": 0}
