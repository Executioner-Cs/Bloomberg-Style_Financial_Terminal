#!/usr/bin/env bash
# check-hardcoding.sh — CI enforcement for CLAUDE.md Part IV hardcoding policy.
#
# Scans TypeScript/TSX and Python source files for patterns that indicate
# hardcoded configuration values (ports, URLs, timeouts, limits).
#
# Exit codes:
#   0 — no violations found
#   1 — one or more violations detected; merge is blocked
#
# Exemptions: lines containing "# noqa: hardcoded" (Python) or
# "// noqa: hardcoded" (TypeScript) are excluded from pattern checks.
# Each exemption must be accompanied by a comment on the preceding line
# citing the ADR or specification that justifies the literal value.
#
# Usage: scripts/check-hardcoding.sh [path...]
#   If no paths are given, scans the entire repository.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCAN_PATHS=("${@:-$REPO_ROOT}")

# Terminal colours (disabled when not a TTY)
if [ -t 1 ]; then
  RED='\033[0;31m'; YELLOW='\033[1;33m'; RESET='\033[0m'
else
  RED=''; YELLOW=''; RESET=''
fi

VIOLATIONS=0

log_violation() {
  local file="$1" line="$2" pattern="$3" match="$4"
  echo -e "${RED}HARDCODING VIOLATION${RESET}: ${file}:${line}"
  echo -e "  Pattern : ${YELLOW}${pattern}${RESET}"
  echo -e "  Match   : ${match}"
  echo ""
  VIOLATIONS=$((VIOLATIONS + 1))
}

# ---------------------------------------------------------------------------
# Helper: scan a single file for a pattern, skip exempted lines
# ---------------------------------------------------------------------------
scan_file() {
  local file="$1" pattern="$2" description="$3"
  # grep -n prints line numbers; filter out exempted lines
  while IFS=: read -r lineno match; do
    # Skip lines that contain a noqa exemption marker
    if echo "$match" | grep -qE 'noqa: hardcoded'; then
      continue
    fi
    log_violation "$file" "$lineno" "$description" "$match"
  done < <(grep -nE "$pattern" "$file" 2>/dev/null || true)
}

# ---------------------------------------------------------------------------
# TypeScript / TSX patterns
# ---------------------------------------------------------------------------
scan_ts_files() {
  local paths=("$@")
  while IFS= read -r -d '' file; do
    # localhost URLs with port
    scan_file "$file" \
      "localhost:[0-9]{4,5}" \
      "hardcoded localhost URL — use VITE_* env var"

    # String literal HTTP/HTTPS URLs (catches full URLs, not path-only strings)
    scan_file "$file" \
      "(\"http://[^\"]+\"|'http://[^']+'" \
      "hardcoded HTTP URL string literal — use API_BASE_URL constant"

    # String literal WebSocket URLs
    scan_file "$file" \
      "(\"ws://[^\"]+\"|'ws://[^']+')" \
      "hardcoded WebSocket URL — use VITE_DEV_WS_PROXY_TARGET"

    # Numeric port in config objects  (port: 8000)
    scan_file "$file" \
      "port:[[:space:]]*[0-9]{4,5}[^0-9]" \
      "hardcoded port number in object — source from env var"

    # Numeric timeout literals (timeout: 5000 or timeout: 30000)
    scan_file "$file" \
      "timeout:[[:space:]]*[0-9]{4,6}[^0-9]" \
      "hardcoded timeout value — use named constant with rationale comment"

  done < <(find "${paths[@]}" \
    -type f \( -name '*.ts' -o -name '*.tsx' \) \
    -not -path '*/node_modules/*' \
    -not -path '*/dist/*' \
    -not -path '*/coverage/*' \
    -not -path '*/e2e/*' \
    -print0)
}

# ---------------------------------------------------------------------------
# Python patterns
# ---------------------------------------------------------------------------
scan_py_files() {
  local paths=("$@")
  while IFS= read -r -d '' file; do
    # localhost URLs with port
    scan_file "$file" \
      "localhost:[0-9]{4,5}" \
      "hardcoded localhost URL — source from settings"

    # port= keyword argument with literal number
    scan_file "$file" \
      "port=[0-9]{4,5}[^0-9]" \
      "hardcoded port argument — source from settings.* port field"

    # Float timeout literals (timeout=30.0)
    scan_file "$file" \
      "timeout=[0-9]+\.[0-9]" \
      "hardcoded float timeout — source from settings.*timeout_seconds"

    # Integer TTL literals (ttl=3600 or setex(key, 3600))
    scan_file "$file" \
      "(ttl=[0-9]+|setex\([^,]+,[[:space:]]*[0-9]+)" \
      "hardcoded TTL/setex value — source from settings.*ttl or cache_ttl"

  done < <(find "${paths[@]}" \
    -type f -name '*.py' \
    -not -path '*/node_modules/*' \
    -not -path '*/__pycache__/*' \
    -not -path '*/dist/*' \
    -not -path '*/alembic/versions/*' \
    -print0)
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
echo "Scanning for hardcoding violations in: ${SCAN_PATHS[*]}"
echo ""

scan_ts_files "${SCAN_PATHS[@]}"
scan_py_files "${SCAN_PATHS[@]}"

if [ "$VIOLATIONS" -eq 0 ]; then
  echo "✓ No hardcoding violations found."
  exit 0
else
  echo -e "${RED}✗ ${VIOLATIONS} hardcoding violation(s) detected. Merge blocked.${RESET}"
  echo "  See CLAUDE.md Part IV for policy and exemption procedure."
  exit 1
fi
