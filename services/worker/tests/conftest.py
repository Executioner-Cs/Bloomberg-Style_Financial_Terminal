"""
Pytest configuration for the worker test suite.

Environment variables are injected at module level — before any src.* import —
because WorkerSettings() is instantiated at module load time in
src/config.py. If these are missing or invalid, the worker refuses to start
(by design, see CLAUDE.md).

Mirrors services/api/tests/conftest.py. The EDGAR_USER_AGENT value avoids
'example.com' so the field validator (config.py:edgar_user_agent_must_be_real)
accepts it under unit-test conditions.
"""

from __future__ import annotations

import os

# Must precede all src.* imports. WorkerSettings() reads these at instantiation.
os.environ.setdefault(
    "EDGAR_USER_AGENT",
    "Bloomberg-Terminal-Test/1.0 test@bloomberg-terminal.test",
)
# Test environment defaults — IANA-registered service ports
# (PostgreSQL 5432, Redis 6379) registered in CLAUDE.md Part III Port Registry.
# noqa: hardcoded
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://terminal:terminal_test@localhost:5432/terminal_test",  # noqa: hardcoded
)
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")  # noqa: hardcoded
os.environ.setdefault(
    "CELERY_BROKER_URL", "redis://localhost:6379/1"  # noqa: hardcoded
)
os.environ.setdefault(
    "CELERY_RESULT_BACKEND", "redis://localhost:6379/2"  # noqa: hardcoded
)
