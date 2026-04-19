"""
Pytest configuration for the API test suite.

Environment variables are injected at module level — before any app import —
because Settings() is instantiated at module load time in src/config.py.
If these are missing, the app refuses to start (by design, see CLAUDE.md).
"""

from __future__ import annotations

import os

# Must precede all src.* imports. Settings() reads these at instantiation time.
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-unit-tests-only")
os.environ.setdefault(
    "EDGAR_USER_AGENT",
    "Bloomberg-Terminal-Test/1.0 test@bloomberg-terminal.test",
)
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://terminal:terminal_test@localhost:5432/terminal_test",
)
os.environ.setdefault(
    "SYNC_DATABASE_URL",
    "postgresql://terminal:terminal_test@localhost:5432/terminal_test",
)
os.environ.setdefault("API_BASE_URL", "http://localhost:8000")
os.environ.setdefault("CORS_ALLOWED_ORIGINS", "http://localhost:5173")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("CELERY_BROKER_URL", "redis://localhost:6379/1")
os.environ.setdefault("CELERY_RESULT_BACKEND", "redis://localhost:6379/2")
os.environ.setdefault("WS_GATEWAY_INTERNAL_API_URL", "http://localhost:8000")
