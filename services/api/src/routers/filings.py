"""
Filings router — stub, implementation in Phase 4+.
Contract: routers call services only. No DB queries here.
"""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/filings")


@router.get("", summary="List filings")
async def list_filings() -> dict[str, object]:
    # TODO(#4): Implement filings endpoint
    return {"filings": [], "total": 0}
