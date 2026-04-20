#!/usr/bin/env bash
# check-adr-required.sh — CI enforcement: ADR required for architectural changes.
#
# Detects whether a PR introduces changes that require a new ADR:
#   1. New port assignments (appears in docker-compose but not in last commit)
#   2. New package.json / pyproject.toml dependencies (new entries in [project.dependencies])
#   3. Changes to API contracts (new FastAPI route definitions)
#
# If any trigger is detected and no new ADR file exists in the diff, merge is blocked.
#
# Exit codes:
#   0 — no ADR required, or ADR present
#   1 — ADR required but missing; merge is blocked
#
# Usage: scripts/check-adr-required.sh [base_ref]
#   base_ref defaults to origin/develop

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_REF="${1:-origin/develop}"
ADR_DIR="${REPO_ROOT}/docs/architecture/decisions"

# Terminal colours (disabled when not a TTY)
if [ -t 1 ]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RESET='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; RESET=''
fi

TRIGGERS=()
ADR_REQUIRED=0

# ---------------------------------------------------------------------------
# Get git diff against base ref
# ---------------------------------------------------------------------------
if ! git rev-parse --verify "${BASE_REF}" > /dev/null 2>&1; then
  echo -e "${YELLOW}WARN${RESET}: Base ref '${BASE_REF}' not found — skipping ADR check"
  exit 0
fi

DIFF=$(git diff "${BASE_REF}" --name-only 2>/dev/null || true)
DIFF_CONTENT=$(git diff "${BASE_REF}" 2>/dev/null || true)

# ---------------------------------------------------------------------------
# Trigger 1: New port in docker-compose
# A new port is a "+" line in the compose diff with the port mapping pattern.
# ---------------------------------------------------------------------------
NEW_PORTS=$(echo "$DIFF_CONTENT" \
  | grep -E '^\+[^+].*"?[0-9]+:[0-9]+"?' \
  | grep -v '^+++' \
  | grep -oE '[0-9]+:[0-9]+' \
  | cut -d: -f1 \
  || true)

if [ -n "$NEW_PORTS" ]; then
  TRIGGERS+=("New port(s) in docker-compose: $(echo "$NEW_PORTS" | tr '\n' ' ')")
  ADR_REQUIRED=1
fi

# ---------------------------------------------------------------------------
# Trigger 2: New dependencies in package.json or pyproject.toml
# Detects added "+" lines in dependency sections.
# ---------------------------------------------------------------------------
DEP_FILES_CHANGED=$(echo "$DIFF" | grep -E '(package\.json|pyproject\.toml)$' || true)
if [ -n "$DEP_FILES_CHANGED" ]; then
  NEW_DEPS=$(echo "$DIFF_CONTENT" \
    | grep -E '^\+[^+].*(\"[a-z@][a-z0-9/_-]+\":|\"|[a-z][a-z0-9-]+>=)' \
    | grep -v '^+++' \
    | head -5 \
    || true)
  if [ -n "$NEW_DEPS" ]; then
    TRIGGERS+=("New package dependency detected in ${DEP_FILES_CHANGED}")
    ADR_REQUIRED=1
  fi
fi

# ---------------------------------------------------------------------------
# Trigger 3: New FastAPI route (new @router.get/post/put/delete with path)
# ---------------------------------------------------------------------------
NEW_ROUTES=$(echo "$DIFF_CONTENT" \
  | grep -E '^\+[^+].*@router\.(get|post|put|delete|patch)\(' \
  | grep -v '^+++' \
  || true)
if [ -n "$NEW_ROUTES" ]; then
  TRIGGERS+=("New API endpoint(s) added — contract change may require ADR")
  ADR_REQUIRED=1
fi

# ---------------------------------------------------------------------------
# Check if a new ADR file exists in this diff
# ---------------------------------------------------------------------------
NEW_ADR=$(echo "$DIFF" | grep -E '^docs/architecture/decisions/ADR-[0-9]' || true)

# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------
echo "Checking ADR requirements for changes against ${BASE_REF}..."
echo ""

if [ "$ADR_REQUIRED" -eq 0 ]; then
  echo -e "${GREEN}✓ No ADR-triggering changes detected.${RESET}"
  exit 0
fi

echo "ADR-triggering changes detected:"
for trigger in "${TRIGGERS[@]}"; do
  echo -e "  ${YELLOW}→${RESET} ${trigger}"
done
echo ""

if [ -n "$NEW_ADR" ]; then
  echo -e "${GREEN}✓ ADR present in this PR:${RESET}"
  echo "$NEW_ADR" | while IFS= read -r adr; do
    echo "    $adr"
  done
  exit 0
else
  echo -e "${RED}✗ ADR required but none found in this PR. Merge blocked.${RESET}"
  echo ""
  echo "  Create a new ADR at: ${ADR_DIR}/ADR-NNN-description.md"
  echo "  See CLAUDE.md Part XIV for ADR format requirements."
  exit 1
fi
