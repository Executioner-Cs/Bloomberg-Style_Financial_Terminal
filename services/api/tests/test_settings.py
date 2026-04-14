"""
Tests for application settings (src/config.py).

Validates that Settings() resolves correctly and that values match the
architectural decisions documented in CLAUDE.md (port registry, auth expiry).
"""
from __future__ import annotations

from src.config import settings


def test_jwt_algorithm_is_hs256() -> None:
    assert settings.jwt_algorithm == "HS256"


def test_access_token_expires_in_15_minutes() -> None:
    """JWT access token expiry — CLAUDE.md Part XIII mandates 15 minutes."""
    assert settings.jwt_access_token_expire_minutes == 15


def test_refresh_token_expires_in_7_days() -> None:
    """Refresh token expiry — CLAUDE.md Part XIII mandates 7 days."""
    assert settings.jwt_refresh_token_expire_days == 7


def test_app_env_is_one_of_allowed_values() -> None:
    assert settings.app_env in {"development", "staging", "production"}


def test_clickhouse_http_port_is_iana_registered() -> None:
    """ClickHouse HTTP port 8123 is IANA-registered — see CLAUDE.md port registry."""
    assert settings.clickhouse_http_port == 8123


def test_clickhouse_native_port_is_iana_registered() -> None:
    """ClickHouse native TCP port 9000 is IANA-registered — see CLAUDE.md port registry."""
    assert settings.clickhouse_port == 9000


def test_ws_gateway_port_is_in_node_range() -> None:
    """WS gateway uses port 3001 — Node.js service range 3001-3099 per CLAUDE.md."""
    assert settings.ws_gateway_port == 3001


def test_database_pool_size_is_positive() -> None:
    assert settings.database_pool_size > 0


def test_database_max_overflow_is_non_negative() -> None:
    assert settings.database_max_overflow >= 0
