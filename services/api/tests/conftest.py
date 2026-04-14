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
os.environ.setdefault("EDGAR_USER_AGENT", "Bloomberg-Terminal-Test/1.0 test@bloomberg-terminal.test")
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://terminal:terminal_test@localhost:5432/terminal_test",
)
os.environ.setdefault(
    "SYNC_DATABASE_URL",
    "postgresql://terminal:terminal_test@localhost:5432/terminal_test",
)
