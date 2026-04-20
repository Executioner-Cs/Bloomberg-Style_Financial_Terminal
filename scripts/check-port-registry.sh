#!/usr/bin/env bash
# check-port-registry.sh — CI enforcement for CLAUDE.md Part III port policy.
#
# Extracts every host-port mapping from docker-compose files and verifies
# that each port is listed in the Port Registry in CLAUDE.md. Any port that
# appears in infrastructure config but not in the registry blocks merge.
#
# Exit codes:
#   0 — all ports are reconciled
#   1 — one or more ports are unregistered; merge is blocked
#
# Usage: scripts/check-port-registry.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLAUDE_MD="${REPO_ROOT}/CLAUDE.md"
COMPOSE_FILE="${REPO_ROOT}/infrastructure/docker-compose.yml"

# Terminal colours (disabled when not a TTY)
if [ -t 1 ]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RESET='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; RESET=''
fi

VIOLATIONS=0

if [ ! -f "$CLAUDE_MD" ]; then
  echo -e "${RED}ERROR${RESET}: CLAUDE.md not found at ${CLAUDE_MD}"
  exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  echo -e "${YELLOW}WARN${RESET}: docker-compose.yml not found at ${COMPOSE_FILE} — skipping port check"
  exit 0
fi

# ---------------------------------------------------------------------------
# Extract host-side ports from docker-compose.yml
# Matches "- HOST:CONTAINER" and "- HOST:CONTAINER/protocol" port mappings.
# ---------------------------------------------------------------------------
extract_compose_ports() {
  # Match lines like:  - "9000:9000"  or  - 5432:5432  or  - "8123:8123/tcp"
  grep -oE '^\s*-\s*"?([0-9]+):[0-9]+"?' "$COMPOSE_FILE" \
    | grep -oE '[0-9]+:[0-9]+' \
    | cut -d: -f1 \
    | sort -u
}

# ---------------------------------------------------------------------------
# Extract registered ports from CLAUDE.md Port Registry table
# Matches lines in the Port Registry table: | PORT | Service | ...
# ---------------------------------------------------------------------------
extract_registered_ports() {
  # Port Registry table rows begin with "| PORT " where PORT is numeric
  grep -oE '^\| [0-9]+' "$CLAUDE_MD" \
    | grep -oE '[0-9]+' \
    | sort -u
}

COMPOSE_PORTS=$(extract_compose_ports)
REGISTERED_PORTS=$(extract_registered_ports)

echo "Checking port registry consistency..."
echo ""

while IFS= read -r port; do
  if echo "$REGISTERED_PORTS" | grep -q "^${port}$"; then
    echo -e "  ${GREEN}✓${RESET} Port ${port} — registered in CLAUDE.md"
  else
    echo -e "  ${RED}✗${RESET} Port ${port} — MISSING from CLAUDE.md Port Registry"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done <<< "$COMPOSE_PORTS"

echo ""

if [ "$VIOLATIONS" -eq 0 ]; then
  echo -e "${GREEN}✓ All ports reconciled.${RESET}"
  exit 0
else
  echo -e "${RED}✗ ${VIOLATIONS} port(s) not listed in CLAUDE.md Port Registry. Merge blocked.${RESET}"
  echo "  Add the missing port(s) to the Port Registry in CLAUDE.md before merging."
  echo "  See CLAUDE.md Part III for the registration procedure."
  exit 1
fi
