## Summary

## <!-- What does this PR do? 1-3 bullet points. -->

-

## Type of Change

- [ ] `feat` — new feature
- [ ] `fix` — bug fix
- [ ] `perf` — performance improvement
- [ ] `refactor` — no feature/bug
- [ ] `test` — test additions/corrections
- [ ] `docs` — documentation only
- [ ] `chore` — build/deps

## Plan Approval

- [ ] This PR was planned in a session before any code was written
- [ ] The `plan-approved` label has been applied to this PR

## Design Checklist (CLAUDE.md Part II)

- [ ] One-sentence intent and scope-boundary statements confirmed
- [ ] Relevant ADRs reviewed; no existing ADR violated
- [ ] Layer boundaries respected: router → service → repository; component → hook → TanStack Query
- [ ] All new API endpoints have a schema defined (request + response)
- [ ] All new TypeScript types defined; all new Pydantic models defined with field descriptions
- [ ] All new database columns in a migration (not ad-hoc)
- [ ] All new cache keys added to `cache/keys.py`
- [ ] Every new value sourced from env var or named constant
- [ ] Unit, integration, and E2E tests identified and written
- [ ] Performance impact, security impact, and regression risk assessed

## Hardcoding Compliance (CLAUDE.md Part IV)

- [ ] No hardcoded URLs, ports, timeouts, or limits introduced
- [ ] Every new configuration value sourced from env vars or named constants
- [ ] `scripts/check-hardcoding.sh` passes — zero violations
- [ ] If any `# noqa: hardcoded` exemptions used: justification cited below

<!-- If noqa exemptions are present, list them here with justification:
  File:line — value — reason (cite ADR or IANA specification)
-->

## Port Registry (CLAUDE.md Part III)

- [ ] No new ports introduced, **OR**
- [ ] New port(s) added to the Port Registry in `CLAUDE.md` with full justification
- [ ] `scripts/check-port-registry.sh` passes — all ports reconciled

## ADR Compliance (CLAUDE.md Part XIV)

- [ ] No architectural decisions made, **OR**
- [ ] New ADR(s) created for: new technology choice / port assignment / dependency / API contract change

<!-- Link new ADR files here:
  - [ADR-NNN Title](docs/architecture/decisions/ADR-NNN-description.md)
-->

## Testing

- [ ] All new code has tests at the required coverage level (CLAUDE.md Part XI)
- [ ] All existing tests still pass (`pnpm run test:unit`, `pytest`)
- [ ] E2E tests pass for affected user flows (`pnpm exec playwright test`)

## Code Quality

- [ ] `pnpm run typecheck` passes — zero TypeScript errors
- [ ] `pnpm run lint` passes — zero ESLint warnings (zero-warning policy)
- [ ] `mypy --strict` passes on all changed Python files
- [ ] `ruff check .` and `black --check .` pass

## Configuration

- [ ] New env vars documented in `.env.example` with rationale comment
- [ ] No secrets, API keys, or PII in the diff (`git diff` reviewed)

## Documentation

- [ ] `CHANGELOG.md` updated if this is a user-facing change
- [ ] ADR created if an architectural decision was made
- [ ] Runbook updated if a new data source or UI panel was added

## Test Evidence

<!-- Screenshot, curl output, or test output demonstrating the feature works. -->

## Breaking Changes

<!-- List any breaking changes to API contracts, database schemas, or plugin API. -->

None

## Related Issues

<!-- Link GitHub issues: "Closes #123" -->
