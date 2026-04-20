# CLAUDE.md — Bloomberg Terminal Engineering Governance

# Last updated: 2026-04-18

# Authority: This document governs ALL code — human-written or AI-generated.

# Scope: Every file, every commit, every decision in this repository.

# Compliance: Non-negotiable. Violations block merges. No exceptions granted.

---

## GOVERNING PRINCIPLE

This is a production-grade financial terminal built without a team.
That constraint does not lower the bar. It raises it.

A team has reviewers to catch shortcuts. A solo developer does not.
Therefore every decision must be correct the first time:
architecturally sound, fully documented, tested, and traceable.

**There is no tech debt budget. There is no "we'll fix it later."
Do it right, or do not do it yet.**

**All external data sources must be permanently and unconditionally free.**
No credit card required. No paid tiers. No APIs that exhaust their free quota
before the first meaningful feature is complete. See ADR-005 for policy and
the approved source list. Any integration with a paid service is blocked.

### Product Vision

The long-term product is a keyboard-first, information-dense, workspace-oriented
terminal, evolving across four capability tiers:

1. **Terminal core** — docked/tabbed panels, symbol-linking bus, saved layouts,
   command palette, the first research panels (Chart, Quote, Watchlist, Macro,
   News, Filings).
2. **Power features** — Screener, Movers, Earnings, Economic Calendar, Alerts,
   Portfolio.
3. **AI analyst** — Why-Is-It-Moving, Compare Companies, Filing Summarizer,
   Earnings Brief, Ask Terminal.
4. **Rust performance layer** — stream gateway, screener engine, risk engine,
   replay engine — replacing the Node.js/Python hot paths where latency rules.

Core principles (non-negotiable):

- **Workspace-first** — the product is workspaces of panels, not pages.
- **Information-dense** — 11–12px rows, tabular numerics, zero SaaS chrome.
- **Keyboard-first** — mouse optional; every action is keyboard-addressable.
- **Instant feel** — the Part XII budgets define "instant".
- **Modular** — every feature is a registered panel app.

Visual spec: codified in `memory/project_visual_reference.md` and in the
Tailwind design tokens at `apps/web/tailwind.config.ts`. ROADMAP.md is the
granular execution track; every phase ties back to one of the four tiers above.

---

## PART I — NON-NEGOTIABLE ENGINEERING RULES

These four rules govern all work in this repository without exception.
No feature, hotfix, experiment, or scaffolding is exempt.

---

### RULE 1 — NO HARDCODED VALUES OR ARBITRARY CONFIGURATION

Hardcoded components, magic numbers, ad-hoc ports, unexplained timeouts,
convenience-based limits, and undocumented configuration choices are
**strictly prohibited**.

Every value that appears in code must originate from exactly one of:

1. A documented architectural decision (ADR)
2. A configuration file sourced from environment variables
3. A named constant with a comment citing its specification or rationale
4. A clearly justified design rationale committed to documentation before the code

If you cannot point to the source of a value, the value does not belong in the code.

**The standard is:** any engineer reading this codebase five years from now
must be able to understand _why_ every number exists without asking anyone.

---

### RULE 2 — PORT ALLOCATION MUST FOLLOW DOCUMENTED POLICY

Port selection is a permanent architectural decision.
It affects firewall rules, load balancer config, Docker networking,
developer mental models, and production infrastructure.
It is never a casual choice.

**Mandatory requirements for every port in use:**

- The port must be listed in the Port Registry (see Part II of this document)
- The port must have a written justification in the registry
- If the port assignment required a decision (i.e., multiple options existed),
  an ADR must document why this port was chosen over alternatives
- Port assignments communicated verbally or assumed from convention are rejected

**What is not a valid justification:**

- "It's the default"
- "3000 was taken"
- "It's common for Node apps"
- "I didn't think about it"

**What is a valid justification:**

- "ClickHouse's IANA-registered HTTP port is 8123. Deviation would break
  client driver defaults and require explicit override in all consumers."
- "Port 3001 is assigned to the WS gateway per the project's Node.js service
  range (3001–3099). Port 3000 is excluded from this range because it is the
  universal Node.js process default, creating ambiguity in multi-service
  environments where other tools may bind it."

---

### RULE 3 — MANDATORY PLAN MODE BEFORE ANY IMPLEMENTATION

No code is written before a plan is approved.
This applies to every change — features, bug fixes, refactors, scaffolds,
configuration changes, schema migrations, and CI pipeline edits.

**A plan must define:**

- **Intent**: What is being built and why
- **Scope boundary**: What is explicitly out of scope for this change
- **Constraints**: Performance budgets, API contracts, dependency limits
- **Dependencies**: What must exist before this work can begin
- **Risks**: What could go wrong, and the mitigation
- **Architectural alignment**: How this fits into the existing system design
- **Conflict check**: Does this change anything another part of the system relies on

A plan is approved when it is reviewed and confirmed in this session before
any file is created or modified.

**No exceptions. No "quick changes". No stubs "just to see if it works".**

---

### RULE 4 — ZERO TOLERANCE FOR UNPLANNED OR ILLOGICAL CHANGES

Any implementation that:

- deviates from the approved plan without re-approval
- introduces behavior not described in the plan
- uses values without documented rationale
- bypasses the planning step for any reason
- contradicts an existing ADR without creating a superseding ADR

**will be reverted and the work restarted from plan mode.**

Expedience is not a justification. A missed deadline caused by a planning
gap is preferable to an architectural defect that requires a rewrite.

---

## PART II — DESIGN BEFORE CODE

### Mandatory Design Checklist

This checklist must be completed and confirmed **before a single line of
implementation code is written**. Documentation, ADRs, and schema definitions
are the only artifacts permitted before the checklist is signed off.

```
DESIGN CHECKLIST — complete every item before coding begins

Intent
  [ ] One-sentence statement of what this change accomplishes
  [ ] One-sentence statement of what this change does NOT accomplish
  [ ] Confirmed: this change is the smallest meaningful unit of work

Architectural Alignment
  [ ] Reviewed the relevant ADRs for this domain
  [ ] Confirmed this change does not violate any existing ADR
  [ ] If it supersedes an ADR: new ADR drafted before implementation begins
  [ ] Confirmed layer boundaries are respected:
        router → service → repository (no skipping)
        React component → hook → TanStack Query (no direct fetches)
  [ ] Confirmed no new circular dependencies are introduced

Data Contracts
  [ ] All new API endpoints have a schema defined (request + response)
  [ ] All new Pydantic models have been defined with field descriptions
  [ ] All new TypeScript types have been defined
  [ ] All new database columns have been added to the migration (not ad-hoc)
  [ ] All new cache keys have been added to cache/keys.py

Configuration
  [ ] Every new value is sourced from an env var or named constant
  [ ] Every new env var is added to .env.example with a comment
  [ ] No new port is introduced without an entry in the Port Registry
  [ ] No new timeout, limit, or threshold is hardcoded

Dependencies
  [ ] What must be built before this work can start — listed explicitly
  [ ] No new package is introduced without a justification comment
  [ ] If the package is new to the project: ADR or documented rationale

Testing Plan
  [ ] Unit tests identified: which functions, which edge cases
  [ ] Integration tests identified: which endpoints, which database interactions
  [ ] E2E tests identified: which user flows are affected
  [ ] Coverage thresholds confirmed: will all minimums still be met?

Risks
  [ ] Performance impact assessed (does this touch a hot path?)
  [ ] Security impact assessed (does this touch auth, input validation, output?)
  [ ] Regression risk assessed (what working behavior could this break?)
  [ ] Migration risk assessed (does this change existing data shapes?)

Documentation
  [ ] ADR required? (new technology choice, breaking change, port assignment)
  [ ] Runbook update required? (new data source, new UI panel)
  [ ] CHANGELOG.md update required? (user-facing change)
  [ ] Endpoint docstring/JSDoc prepared before implementation

Sign-off
  [ ] All items above are checked
  [ ] Plan has been reviewed and approved in this session
  [ ] Branch name proposed and confirmed
  [ ] First commit's content and message have been agreed
```

---

## PART III — PORT ALLOCATION POLICY

### Policy Statement

Port assignments in this project are architectural decisions.
They are permanent, documented, and require justification.
No port may be used in any configuration file, environment variable,
or code without an entry in the registry below.

### Port Range Allocation

The project divides the unprivileged port space (1024–65535) into
named ranges by service category. A service MUST use a port from
its designated range unless an ADR documents the exception.

| Range     | Category                           | Rationale                                                                                                                                                                                                                             |
| --------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3001–3099 | Node.js application services       | Node.js services occupy this range. 3000 is excluded — it is the universal Node.js process default, causing ambiguity with external tooling (Next.js, CRA, Nodemon). 3001 is the first unambiguous project-defined Node service port. |
| 5100–5199 | Frontend dev servers               | Vite's default is 5173; this range is reserved for frontend tooling. Does not conflict with any standard system service.                                                                                                              |
| 5400–5499 | PostgreSQL                         | IANA-registered range. 5432 is the PostgreSQL default; deviation would break all driver defaults and require explicit override everywhere.                                                                                            |
| 6300–6400 | Redis and Redis-adjacent           | IANA-registered. 6379 is the Redis default. 6380 is reserved for Redis replicas or Sentinel.                                                                                                                                          |
| 8000–8099 | Python REST APIs (ASGI/WSGI)       | Python ecosystem convention for application servers. Avoids 8080 (de facto reverse proxy / Tomcat / Jenkins default) and 8888 (Jupyter Notebook default).                                                                             |
| 8100–8199 | ClickHouse                         | ClickHouse's IANA-registered HTTP interface occupies 8123. Native TCP protocol occupies 9000. Interserver replication uses 9009. These are not configurable without rebuild.                                                          |
| 8001      | RedisInsight (admin GUI)           | Redis Labs' official management UI default. Adjacent to Redis at 6379 only during local dev; not exposed in production.                                                                                                               |
| 9000–9099 | ClickHouse native protocol + admin | ClickHouse native TCP (9000), interserver (9009). Also MinIO S3 API (9090) under the optional `storage` Docker profile.                                                                                                               |
| 9001      | MinIO Console                      | MinIO's web console default. Optional profile only.                                                                                                                                                                                   |

### Port Registry — All Registered Ports

Every port used anywhere in this project must appear here.
Adding a port without updating this registry is a violation of Rule 1.

| Port | Service                            | Protocol | Environment  | Justification                                                                                                                                                                                                                                                       |
| ---- | ---------------------------------- | -------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3001 | WS Gateway (Node.js + Fastify)     | HTTP/WS  | dev + prod   | Node.js service range (3001–3099). Port 3000 excluded per range policy — it is the universal Node.js default and causes ambiguity. 3001 is the first clean port in the project-defined Node service range. ADR-003 documents the WS gateway architectural decision. |
| 5173 | Vite dev server (React SPA)        | HTTP     | dev only     | Vite's assigned default. Universally understood in the Vite ecosystem. Falls within the project's frontend dev server range (5100–5199). Not exposed in production — Nginx serves the built bundle.                                                                 |
| 5432 | PostgreSQL 16                      | TCP      | dev + prod   | IANA-registered PostgreSQL default. Deviation would require explicit override in every SQLAlchemy connection string, Alembic config, and pg_dump command. No benefit justifies the overhead.                                                                        |
| 6379 | Redis 7 Stack                      | TCP      | dev + prod   | IANA-registered Redis default. All Redis client libraries default to this port. Deviation requires explicit override everywhere.                                                                                                                                    |
| 8000 | FastAPI REST API                   | HTTP     | dev + prod   | Python ASGI convention. First available port in the 8000–8099 Python API range that avoids conflicts with 8080 (proxy tools, Jenkins, Tomcat) and 8888 (Jupyter).                                                                                                   |
| 8001 | RedisInsight GUI                   | HTTP     | dev only     | Redis Labs' official GUI tool default. Local development only; blocked at the firewall boundary in all other environments.                                                                                                                                          |
| 8123 | ClickHouse HTTP interface          | HTTP     | dev + prod   | ClickHouse's IANA-registered HTTP port. Used by the Python clickhouse-driver and all HTTP-based clients. Not configurable without recompiling ClickHouse.                                                                                                           |
| 9000 | ClickHouse native TCP              | TCP      | dev + prod   | ClickHouse's IANA-registered native protocol port. Used for high-throughput bulk INSERT operations. Not configurable without recompiling ClickHouse.                                                                                                                |
| 9001 | MinIO S3 API (host port)           | HTTP     | dev optional | MinIO's S3-compatible API listens on container port 9000 but is mapped to host port 9001 to avoid collision with ClickHouse native TCP (9000). Only active under `--profile storage`. Maps to AWS S3 endpoint in production.                                        |
| 9009 | ClickHouse interserver replication | TCP      | dev + prod   | ClickHouse's default interserver replication port. Required even in single-node setup when ClickHouse is configured for potential cluster expansion.                                                                                                                |
| 9090 | MinIO Console UI                   | HTTP     | dev optional | MinIO web console set via `--console-address ":9090"` in server command. Only active under `--profile storage`. Not present in production.                                                                                                                          |

### Adding a New Port

Before assigning any new port:

1. Identify the service category and locate its designated range in the table above
2. Verify the candidate port does not conflict with any registered port
3. Add the port to the registry with a complete justification entry
4. If the port falls outside all defined ranges, create an ADR before proceeding
5. Update the relevant `docker-compose.yml` service entry
6. Update `.env.example` with the port variable and a comment

**No port may appear in any file before step 3 is complete.**

---

## PART IV — HARDCODING VIOLATIONS

### Definition

A hardcoded value is any literal that:

- represents a configuration choice (port, timeout, URL, limit, key)
- will need to change between environments (dev, test, staging, production)
- must change if the architecture changes
- has no named constant or documentation explaining its origin

### Violation Examples — What Is Forbidden

The following patterns are violations. Each one would block a PR.

```typescript
// VIOLATION: port hardcoded — source is unknown, cannot change without grep-and-replace
const wsTarget = 'ws://localhost:3001';

// VIOLATION: timeout is a magic number — why 5000? what does it represent?
setTimeout(retry, 5000);

// VIOLATION: URL is hardcoded — breaks in every environment except the author's machine
fetch('http://localhost:8000/api/v1/instruments');

// VIOLATION: limit is a magic number — what is this limit for? what defines it?
if (results.length > 100) throw new Error('Too many results');

// VIOLATION: retry count is hardcoded — why 3? where is this policy documented?
for (let attempt = 0; attempt < 3; attempt++) { ... }

// VIOLATION: API version is a string literal scattered through the codebase
const url = `/api/v1/market-data/${symbol}/ohlcv`;

// VIOLATION: credential pattern — even in tests
const apiKey = 'test-key-12345';
```

```python
# VIOLATION: port hardcoded in Python service config
app.run(host="0.0.0.0", port=8000)  # where does 8000 come from?

# VIOLATION: URL assembled from string literals
url = f"http://localhost:3001/health"

# VIOLATION: rate limit magic number — not sourced from config
if request_count > 300:
    raise RateLimitError()

# VIOLATION: timeout with no justification
async with httpx.AsyncClient(timeout=30.0) as client: ...

# VIOLATION: cache TTL with no justification or reference to ToS
redis.setex(key, 3600, value)
```

### Correct Patterns — What Is Required

```typescript
// CORRECT: proxy targets come from env, read at config time
const apiProxyTarget = env['VITE_DEV_API_PROXY_TARGET'] ?? fallback;

// CORRECT: named constant with comment explaining the policy
/** 5 second base retry delay — doubles on each attempt per exponential backoff policy */
const BASE_RETRY_DELAY_MS = 5_000;

// CORRECT: URL constructed from typed constants
import { API_BASE_URL, API_V1_PREFIX } from '@/lib/api/constants';
fetch(`${API_BASE_URL}${API_V1_PREFIX}/instruments`);

// CORRECT: limits sourced from config
import { MAX_SCREENER_RESULTS } from '@/lib/config';
if (results.length > MAX_SCREENER_RESULTS) throw new QueryLimitError();
```

```python
# CORRECT: port sourced from settings, which reads from env
uvicorn.run(app, host="0.0.0.0", port=settings.api_port)

# CORRECT: URL assembled from settings
url = f"{settings.ws_gateway_internal_url}/health"

# CORRECT: rate limit sourced from settings, which validates at startup
if request_count > settings.rate_limit_free_tier_per_hour:
    raise RateLimitError()

# CORRECT: timeout from settings with a comment on where the value comes from
# yfinance has no published timeout; 30s is the self-imposed conservative limit (ADR-005).
async with httpx.AsyncClient(timeout=settings.yfinance_timeout_seconds) as client: ...

# CORRECT: cache TTL from settings, respecting ToS minimum cache window
# NewsAPI free tier: 100 req/day. 300s (5min) TTL limits calls while staying fresh.
await redis.setex(cache_key, settings.news_cache_ttl_seconds, serialized)
```

### CI Enforcement of Hardcoding Policy

The following patterns are detected by the `scripts/check-hardcoding.sh` script,
which runs as a required CI check and blocks merge on any match:

```
BLOCKED PATTERNS (checked in TypeScript/TSX files):
  - localhost:[0-9]{4,5}  (hardcoded local URLs)
  - 'http://[^']*'        (string literal HTTP URLs)
  - "http://[^"]*"        (string literal HTTP URLs)
  - ws://[^'"]*           (string literal WebSocket URLs)
  - port: [0-9]{4,5}      (hardcoded port in config objects)
  - timeout: [0-9]+       (numeric timeout literals)

BLOCKED PATTERNS (checked in Python files):
  - localhost:[0-9]{4,5}
  - port=[0-9]{4,5}
  - timeout=[0-9]+\.[0-9]  (float timeout literals)
  - ttl=[0-9]+             (integer TTL literals)

EXEMPTIONS (lines containing these strings are excluded from pattern checks):
  - # noqa: hardcoded — must be accompanied by a comment on the preceding line
    citing the ADR or specification that justifies the literal value.
    This exemption is for values that are genuinely fixed by external
    specification (e.g., IANA port assignments, protocol constants).
```

---

## PART V — CI ENFORCEMENT

### What CI Checks Are Required

Every pull request must pass all of the following checks before merge is permitted.
No check may be skipped. No bypass flags (`--no-verify`, `--force`) are permitted.

#### Tier 1 — Code Quality (blocks merge immediately on failure)

| Check                | Command                                      | Failure means                                    |
| -------------------- | -------------------------------------------- | ------------------------------------------------ |
| TypeScript typecheck | `pnpm run typecheck`                         | Type errors in any changed TS/TSX file           |
| ESLint               | `pnpm run lint`                              | Lint errors or warnings (zero-warning policy)    |
| Python mypy          | `mypy --strict services/api services/worker` | Type errors in any changed Python file           |
| Python ruff          | `ruff check .`                               | Any lint warning in changed Python files         |
| Python black         | `black --check .`                            | Formatting inconsistency in changed Python files |

#### Tier 2 — Tests (blocks merge on failure)

| Check                    | Command                                 | Failure means                |
| ------------------------ | --------------------------------------- | ---------------------------- |
| Frontend unit tests      | `pnpm --filter web test:ci`             | Any test failure             |
| Frontend coverage        | `pnpm --filter web test:coverage`       | Any threshold below minimums |
| Python unit tests        | `pytest services/api/tests/unit`        | Any test failure             |
| Python integration tests | `pytest services/api/tests/integration` | Any test failure             |
| Python coverage          | `pytest --cov --cov-fail-under=80`      | Coverage below threshold     |
| E2E tests                | `pnpm exec playwright test`             | Any E2E scenario failure     |

#### Tier 3 — Security (blocks merge on HIGH or CRITICAL findings)

| Check           | Command                                  | Failure means                              |
| --------------- | ---------------------------------------- | ------------------------------------------ | ------------------------------- |
| npm audit       | `npm audit --audit-level=high`           | HIGH or CRITICAL vulnerability             |
| pip-audit       | `pip-audit --vulnerability-service pypi` | HIGH or CRITICAL vulnerability             |
| Secret scan     | `git diff --name-only origin/develop     | xargs scripts/check-secrets.sh`            | Any credential pattern detected |
| Hardcoding scan | `scripts/check-hardcoding.sh`            | Any blocked pattern detected (see Part IV) |

#### Tier 4 — Architecture Governance (blocks merge on violation)

| Check                           | Tool                             | Failure means                                                                           |
| ------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------- |
| Conventional commit format      | commitlint                       | Commit message violates format                                                          |
| Branch naming                   | GitHub Actions branch name check | Branch name violates policy                                                             |
| PR requires plan approval label | GitHub Actions label check       | PR is missing the `plan-approved` label                                                 |
| Port registry consistency       | `scripts/check-port-registry.sh` | A port appears in config but not in CLAUDE.md registry                                  |
| ADR required check              | `scripts/check-adr-required.sh`  | PR touches a port, adds a dependency, or changes an API contract without a new ADR file |
| No direct-to-main commit        | Branch protection rule           | Any commit directly to `main` or `develop`                                              |
| No force push                   | Branch protection rule           | Any force push to any protected branch                                                  |

#### Tier 5 — Performance (advisory on PR, blocking on regression)

| Check                  | Tool                                       | Failure means                         |
| ---------------------- | ------------------------------------------ | ------------------------------------- |
| Lighthouse CI          | `lhci autorun`                             | FCP > 1.5s, TTI > 3.5s, or LCP > 2.5s |
| Bundle size            | `pnpm run build --reporter json`           | Initial chunk > 200KB gzipped         |
| Performance regression | Comparison to base branch Lighthouse score | Score drops by more than 5 points     |

### PR Template Requirements

Every PR must include a completed PR template. A PR with an incomplete
template will not be reviewed. The template enforces:

```markdown
## Plan Approval

- [ ] This PR was planned in a session before any code was written
- [ ] The `plan-approved` label has been applied

## Design Checklist (from CLAUDE.md Part II)

- [ ] All Design Before Code checklist items confirmed complete

## Hardcoding Compliance

- [ ] No hardcoded URLs, ports, timeouts, or limits introduced
- [ ] Every new configuration value is sourced from env vars or named constants
- [ ] If any `# noqa: hardcoded` exemptions were used: justification cited in PR description

## Port Registry

- [ ] No new ports introduced, OR
- [ ] New ports have been added to the Port Registry in CLAUDE.md with full justification

## ADR Compliance

- [ ] No architectural decisions made, OR
- [ ] New ADR(s) created and linked here: [ADR-XXX](docs/architecture/decisions/ADR-XXX.md)

## Testing

- [ ] All new code has tests at the required coverage level (CLAUDE.md Part VII)
- [ ] All existing tests still pass

## Documentation

- [ ] .env.example updated for any new env vars
- [ ] CHANGELOG.md updated (if user-facing change)
- [ ] Runbook(s) updated (if new data source or UI panel)
```

### Branch Protection Configuration

The following settings are enforced at the repository level and cannot
be overridden by any contributor:

- **`main`**: Requires 1 PR approval, all status checks passing, no force push,
  no direct commits, linear history required
- **`develop`**: Requires all status checks passing, no force push, no direct commits
- **All branches**: Secret scanning enabled, dependency review on PRs

---

## PART VI — LANGUAGE AND TYPING

### TypeScript (ALL frontend and ws-gateway code)

- `"strict": true` in every tsconfig — NON-NEGOTIABLE
- `noUncheckedIndexedAccess: true` — array[index] returns `T | undefined`
- `exactOptionalPropertyTypes: true` — optional means explicitly optional
- NEVER use `any` — use `unknown` and narrow with type guards
- NEVER use `@ts-ignore` — fix the type error
- `@ts-expect-error` allowed ONLY with an explanatory comment on the preceding line
- NEVER use `as` casts unless you own the data shape AND add a runtime assertion
- All exported functions must have explicit return type annotations
- Use `satisfies` operator for config objects — do not cast them
- Prefer `type` for data shapes; `interface` for extension points
- Use discriminated unions for all state machines and event types

### Python (ALL api and worker code)

- Python 3.12+ — use `X | Y` unions, `match` statements, `TypeAlias`
- `from __future__ import annotations` at the top of every module
- Type hints required on every function parameter and return value
- NO `Any` from typing — use proper types or bounded `TypeVar`
- Pydantic v2 for ALL data validation — never write manual isinstance checks
- `mypy --strict` must pass — configured in `pyproject.toml`
- `ruff` for linting — zero warnings, zero errors
- `black` for formatting — 88 character line length

---

## PART VII — FILE NAMING CONVENTIONS

### TypeScript / React

- React components: `PascalCase.tsx` (e.g., `ChartPanel.tsx`)
- Hooks: `use-kebab-case.ts` (e.g., `use-market-data.ts`)
- Utility functions: `kebab-case.ts` (e.g., `currency-format.ts`)
- Type files: `kebab-case.types.ts`
- Store files: `kebab-case.store.ts`
- API client files: `kebab-case.api.ts`
- Test files: co-located with source, `.test.ts` / `.test.tsx` suffix
- E2E tests: `apps/web/e2e/specs/kebab-case.spec.ts`

### Python

- All files: `snake_case.py`
- Routers: noun-plural (`instruments.py`, `watchlists.py`)
- Services: noun-singular + `_service` (`market_data_service.py`)
- Repositories: noun-singular + `_repository` (`ohlcv_repository.py`)
- Integrations: provider name (`yfinance.py`, `edgar.py`, `newsapi.py`)
- Tests: `test_` prefix matching source file

### General

- No abbreviations except: `api`, `url`, `id`, `ws`, `db`
- No `utils.ts` / `helpers.py` — name files after what they do
- One primary export per file

---

## PART VIII — DIRECTORY AND LAYER RULES

- NEVER create files in the root of `services/api/src/` — use the correct subdirectory
- NEVER put business logic in `routers/` — routers accept requests and call services only
- NEVER put database queries in services — services call repositories only
- NEVER import from `apps/web/` into `packages/` — packages have zero app dependencies
- NEVER put API calls directly in React components — use hooks with TanStack Query
- NEVER skip the router → service → repository chain for any reason

The layer boundary is an architectural constraint, not a guideline.
A router that queries a database directly is a defect, not a shortcut.

---

## PART IX — COMMIT AND BRANCH DISCIPLINE

### Branch Naming

Format: `<type>/<scope>/<short-description>`

- `feat/web/rsi-indicator`
- `fix/api/ohlcv-timezone`
- `perf/db/filing-index`
- `chore/deps/pydantic-v2-upgrade`

Rules:

- All lowercase, hyphens only (no underscores, no dots)
- Max 50 characters
- NEVER commit directly to `main` or `develop`
- `main` — production deployments only, merged via PR with CI passing
- `develop` — integration branch
- Feature branches cut from `develop`, merged back via PR

### Branch Discipline

- One branch = one meaningful unit of work
- Propose the branch name before starting — the name enforces the scope
- If you cannot describe the branch in one short phrase, it is too broad; split it
- Branch is always cut from `develop`, never from `main`

### Commit Message Format (Conventional Commits — enforced by commitlint)

Format: `<type>(<scope>): <imperative description>`

**Types:**

- `feat` — new user-visible feature
- `fix` — bug fix
- `perf` — performance improvement
- `refactor` — code change with no feature or bug
- `test` — adding or correcting tests
- `docs` — documentation only
- `ci` — CI/CD pipeline changes
- `chore` — build process, dependency updates
- `revert` — reverts a previous commit

**Scopes (must be one of):**
`api`, `worker`, `ws-gateway`, `web`, `db`, `infra`, `docs`, `deps`, `plugins`, `types`, `ui-components`

**Examples:**

```
feat(web): add RSI indicator to chart panel
fix(api): correct OHLCV timezone handling for non-UTC exchanges
perf(db): add composite index on ohlcv symbol+timeframe+ts
feat(worker): implement EDGAR 8-K RSS ingestion task
```

**Rules:**

- Imperative present tense: "add" not "added", "fix" not "fixes"
- Max 72 characters for the subject line
- Body required for breaking changes and non-obvious fixes
- BREAKING CHANGE footer required when API contracts change
- FORBIDDEN subject lines: "WIP", "fix stuff", "updates", "misc", "temp", "changes"

### Commit Discipline

- One commit = one verified, stable step forward
- Every commit must leave the codebase in a fully passing state:
  - Backend: health endpoint returns 200, affected endpoint returns expected response
  - Frontend: page renders with zero console errors, affected interaction works
  - Infra: `docker compose up` succeeds with all containers healthy
- NEVER commit code that has not been manually verified to work
- NEVER batch unrelated changes — one logical unit per commit

### Pre-Push Requirements

- All commits on the branch pass CI checks locally
- `git diff` reviewed — no secrets, no API keys in the diff
- Branch is scoped to exactly what the branch name describes

---

## PART X — ABSOLUTE PROHIBITIONS

### Architecture Violations

- NEVER call an external API from a router — always service → cache → integration
- NEVER store secrets in code, config files, or git history
- NEVER disable CORS in production — configure an explicit allowlist
- NEVER use `SELECT *` in ClickHouse — always name columns
- NEVER write raw SQL strings — use SQLAlchemy ORM or `text()` with bound parameters
- NEVER concatenate user input into SQL, Redis commands, or cache keys
- NEVER use synchronous HTTP in FastAPI routes — use `httpx.AsyncClient`
- NEVER use `time.sleep()` in async Python — use `asyncio.sleep()`
- NEVER swallow exceptions with bare `except:` or `except Exception: pass`

### Frontend Violations

- NEVER use `useEffect` for derived state — use `useMemo`
- NEVER use `useEffect` to sync two state slices — consolidate into one source
- NEVER call `setState` inside render
- NEVER use inline styles for layout — use Tailwind utility classes
- NEVER use `!important` in CSS
- NEVER import more than 3 `../` levels deep — use the `@/` path alias
- NEVER put API calls directly in components — hook → TanStack Query
- NEVER store sensitive data in `localStorage` or `sessionStorage`

### Data and Security Violations

- NEVER log raw API keys, tokens, or passwords
- NEVER expose internal error messages in API responses — use message + request_id
- NEVER skip Pydantic validation on POST/PUT endpoints
- NEVER hardcode rate limits — source from `config.py` and env vars
- NEVER commit API keys even in test files — mock them

### Tech Debt Patterns (BANNED)

- NEVER add a TODO without a GitHub issue number: `# TODO(#123): description`
- NEVER copy-paste more than 5 lines — extract a function
- NEVER write a function longer than 50 lines
- NEVER write a file longer than 400 lines
- NEVER add a dependency without a justification comment in package.json or pyproject.toml

---

## PART XI — TESTING REQUIREMENTS

### Coverage Minimums (enforced in CI — build fails below threshold)

| Layer                              | Minimum                                |
| ---------------------------------- | -------------------------------------- |
| Python services                    | 80% line coverage                      |
| Python repositories                | 70% line coverage                      |
| Python routers                     | 60% (integration tests cover the rest) |
| React hooks                        | 80% line coverage                      |
| React components                   | 60% (E2E covers the rest)              |
| Utility functions (both languages) | 90% line coverage                      |

### Required Test Types for Every New Feature

**Unit tests** (no I/O, all dependencies mocked):

- Every service method with a non-trivial branch
- Every utility function with edge cases
- Every Pydantic schema with invalid inputs
- Every TypeScript function with type-guarded branches

**Integration tests** (real database, no external HTTP):

- Every FastAPI endpoint (`httpx.AsyncClient` + test database)
- Every repository query with representative data

**E2E tests** (Playwright):

- Chart loads and renders candlesticks
- Watchlist: add/remove symbol
- Command palette: open, find symbol, navigate to chart
- Alert: create and receive notification
- Screener: build filter, run, inspect results

### Test Naming Conventions

- Python: `test_<function_name>_<scenario>`
  e.g., `test_get_ohlcv_returns_empty_for_unknown_symbol`
- TypeScript: `describe("<ComponentName>") > it("should <behavior>")`

### Test Prohibitions

- NEVER use `time.sleep()` — use mocks or async patterns
- NEVER test implementation details — test behavior and outputs
- NEVER share mutable state between tests
- NEVER make real HTTP calls in unit or integration tests — mock all external APIs

---

## PART XII — PERFORMANCE BUDGETS

### Frontend (Lighthouse CI)

| Metric                    | Budget                |
| ------------------------- | --------------------- |
| First Contentful Paint    | < 1.5s (simulated 4G) |
| Time to Interactive       | < 3.5s                |
| Largest Contentful Paint  | < 2.5s                |
| Total Blocking Time       | < 200ms               |
| Initial JS bundle         | < 200KB gzipped       |
| Total JS (async included) | < 1MB gzipped         |

### API

| Metric                           | Budget   |
| -------------------------------- | -------- |
| P50, cached endpoints            | < 50ms   |
| P99, cached endpoints            | < 200ms  |
| P50, ClickHouse OHLCV (1Y daily) | < 100ms  |
| P99, ClickHouse OHLCV            | < 500ms  |
| Screener, uncached complex query | < 2s P99 |

### Real-Time

| Metric                                               | Budget       |
| ---------------------------------------------------- | ------------ |
| WS fan-out latency (server receive → client receive) | < 50ms       |
| Price update frequency (per symbol per client)       | max 1/second |

### Workspace Interaction (terminal-specific)

These are the user-felt targets that define whether the product
_feels_ like a Bloomberg-class terminal. Measured in the browser via
`performance.mark` / `performance.measure`; regressions block release.

| Metric                                                   | Budget  |
| -------------------------------------------------------- | ------- |
| Panel focus switch (keyboard or click → focused)         | < 50ms  |
| Symbol link propagation (setActiveSymbol → panel render) | < 150ms |
| Panel drag / resize frame rate (dockview layout)         | ≥ 60fps |
| Workspace restore (mount → all panels rendered)          | < 500ms |
| Command palette open (Ctrl+K → first paint)              | instant |
| Type-to-search first result render                       | < 100ms |

**Rationale:** Terminal authenticity comes from speed more than
visuals — see `memory/project_visual_reference.md`. These targets
define "instant feel" for the product.

### Panel Data Discipline

Every panel MUST:

- Pause TanStack Query polling when not visible in the layout
  (`enabled: isVisible` on every `useQuery` inside a panel).
- Use Zustand selectors (`useStore(s => s.slice)`), never
  whole-store subscriptions, to avoid re-render storms on the
  symbol-linking bus.
- Use virtualized tables (`react-virtual` or `ag-grid`) for any
  list that can exceed 100 rows — screener results, news, filings,
  watchlist, movers.
- Memoize dense row components (`React.memo` + stable keys) —
  ticking numbers in a watchlist must not re-render untouched rows.

---

## PART XIII — SECURITY RULES

### Authentication

- JWT access tokens: 15-minute expiry
- Refresh tokens: 7-day expiry, rotated on each use, httpOnly Secure cookie
- API keys: SHA-256 hashed in DB, shown to user exactly once
- Passwords: bcrypt minimum cost factor 12

### Input Validation

- All user-supplied strings: enforce max length in Pydantic schemas
- Symbol validation: regex `^[A-Z0-9./\-]{1,20}$`
- Date range limits: max 10 years for OHLCV requests
- Screener: max 10 filters, max 5 sort fields per query

### Rate Limiting

| Tier      | Limit                                      |
| --------- | ------------------------------------------ |
| Anonymous | 60 requests/hour per IP                    |
| Free tier | 300 requests/hour per user                 |
| Pro tier  | 3000 requests/hour per user                |
| WebSocket | max 50 symbol subscriptions per connection |

All limits sourced from `config.py` — never hardcoded.

### HTTP Security Headers (Nginx)

- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Content-Security-Policy`: explicit allowlist, no `unsafe-inline`, no `unsafe-eval`
- `Referrer-Policy: strict-origin-when-cross-origin`

### Dependency Security

- `npm audit` and `pip-audit` in CI — HIGH/CRITICAL blocks merge
- `dependabot` configured for automated patch PRs
- Docker base images: pinned to SHA digest, not floating tags

---

## PART XIV — DOCUMENTATION REQUIREMENTS

### Code Documentation

- Every public function/class/method: docstring (Python) or JSDoc (TypeScript)
- Docstrings explain WHY, not WHAT
- Complex algorithms: comment citing source or reference
- Every Pydantic model field: `description` parameter
- Every FastAPI endpoint: `summary`, `description`, `response_model`

### Architecture Decision Records (ADRs)

- Location: `docs/architecture/decisions/`
- Required when: choosing between viable options, making a breaking change,
  assigning a new port, introducing a new external dependency
- Format: Title · Status · Context · Decision · Consequences
- ADRs are IMMUTABLE — create a superseding ADR; never edit old ones

### Runbooks

- New external data source: update `docs/runbooks/adding-data-source.md`
- New UI panel: update `docs/runbooks/adding-ui-panel.md`
- Step-by-step, verifiable, written by the person doing the work

### Changelog

- `CHANGELOG.md` updated in every PR with a user-facing change
- Format: Keep a Changelog (https://keepachangelog.com)

---

## PART XV — HOW TO ADD A NEW DATA SOURCE

Follow in order. No steps skipped.

1. **Read the ToS.** Document rate limits, caching minimums, attribution requirements,
   redistribution restrictions. Create an ADR if any policy affects architecture.

2. **Create the integration client** in `services/api/src/integrations/<provider>.py`:
   - Subclass `BaseIntegrationClient` (retry, backoff, timeout included)
   - All methods fully type-annotated, returning Pydantic schemas
   - `User-Agent` header with contact info where required (EDGAR requires this)
   - Rate limit tracking with Redis counters
   - All timeouts and retry counts sourced from settings — never hardcoded
   - Unit tests with `httpx` mock transport — zero real HTTP calls in tests

3. **Add env vars** to `.env.example` (with comment) and `config.py` (pydantic-settings field).

4. **Create the ingestion task** in `services/worker/src/tasks/`:
   - Explicit Celery task name, `max_retries`, `time_limit` — all from settings
   - Idempotent: re-running must not duplicate data
   - Add to Celery Beat schedule in `celery_app.py`

5. **Add cache layer** in the consuming service:
   - TTL respects ToS minimum (sourced from settings)
   - Cache key added to `services/api/src/cache/keys.py`
   - Cache-aside pattern: check → miss → fetch → store → return

6. **Expose via REST endpoint** following existing router patterns.

7. **Add integration test** with a VCR cassette (record once, replay in CI).

8. **Update** `docs/runbooks/adding-data-source.md`.

---

## PART XVI — HOW TO ADD A NEW UI PANEL

Follow in order. No steps skipped.

1. **Define the data contract first.** What endpoints or WS channels does it need?
   Build backend before frontend.

2. **Create the panel directory**: `apps/web/src/panels/<panel-name>-panel/`
   Required files:
   - `index.tsx` — barrel export
   - `<PanelName>Panel.tsx` — root component
   - `<PanelName>Panel.test.tsx` — component tests

3. **Panel interface** (all panels must accept exactly these props):

   ```typescript
   interface PanelProps {
     panelId: string; // unique instance ID for layout state
     isActive: boolean; // whether this panel has keyboard focus
     onClose: () => void;
   }
   ```

4. **Data fetching**: TanStack Query hooks only. Create `use<PanelName>Data()` in the panel directory. No direct `fetch()` calls.

5. **Keyboard navigation**: Every panel must be fully keyboard-navigable.
   Register shortcuts with `useKeyboardShortcuts` when `isActive === true`.

6. **Loading and error states**: `<PanelSkeleton>` and `<PanelError>` from `packages/ui-components`.

7. **Register** in `apps/web/src/panels/index.ts`.

8. **Register in command palette**: openable via Ctrl+K.

9. **Add E2E test** in `apps/web/e2e/specs/<panel-name>.spec.ts`.

10. **Update** `docs/runbooks/adding-ui-panel.md`.

---

## PART XVII — PLUGIN DEVELOPMENT RULES

1. Plugins are isolated — cannot import from main application source
2. Bundles are self-contained — all dependencies bundled into `dist/bundle.js`
3. Permissions are declared in `manifest.json` — host refuses undeclared permissions
4. Storage is namespaced — keys auto-prefixed with plugin ID
5. Plugin crashes must not crash the terminal — all code inside React Error Boundary
6. Performance budget: must not drop page below 30fps for more than 500ms
7. Plugins declare `minApiVersion` — host checks compatibility on load
8. Forbidden without exception: `eval()`, `Function()` constructor, dynamic script injection
9. Plugin PRs require: manifest review, security review, performance results, plugin README

---

## PART XVIII — ENVIRONMENT VARIABLES DISCIPLINE

- ALL env vars declared in `.env.example` with a comment
- NEVER use default values for secrets in production — fail loudly if missing
- FastAPI app MUST REFUSE to start if required env vars are absent
- Separate env files per environment: `.env.development`, `.env.test`
- `.env` is ALWAYS in `.gitignore`
- Use `pydantic-settings` BaseSettings for all config parsing and validation

---

## PART XIX — PRE-COMMIT SELF-REVIEW CHECKLIST

Before every commit, verify every item. No exceptions.

**Governance**

- [ ] This change was planned before any code was written
- [ ] Every value in the diff originates from env vars, named constants, or documented rationale
- [ ] No new port introduced without a Port Registry entry in CLAUDE.md
- [ ] No architectural decision made without an ADR

**Code Quality**

- [ ] `pnpm run typecheck` passes — zero TypeScript errors
- [ ] `pnpm run lint` passes — zero ESLint errors or warnings
- [ ] `mypy --strict` passes on all changed Python files
- [ ] `ruff check .` and `black --check .` pass

**Testing**

- [ ] All new code has tests at the required coverage level
- [ ] All existing tests still pass
- [ ] No real HTTP calls introduced in unit or integration tests

**Configuration**

- [ ] New env vars documented in `.env.example`
- [ ] No secrets, API keys, or PII in the diff (`git diff` reviewed)

**Documentation**

- [ ] `CHANGELOG.md` updated if this is a user-facing change
- [ ] ADR created if an architectural decision was made
- [ ] Runbook updated if a new data source or UI panel was added

**Commit**

- [ ] Commit message follows Conventional Commits format
- [ ] Commit scope is one of the approved scopes
- [ ] This commit leaves the codebase in a fully passing, verifiable state

---

## PART XX — DEVELOPER TOOLS

These tools are installed globally and available in every session.
All skills live in `~/.claude/skills/` and are invoked via the Skill tool.

### graphify — Codebase Knowledge Graph

Installed via: `pip install graphifyy && graphify install`
Skill: `~/.claude/skills/graphify/SKILL.md` | Trigger: `/graphify`
Last regenerated: 2026-04-18 (post-Phase-1 merge). Re-run after any large refactor.

Run `/graphify .` from the project root to build an interactive knowledge graph of the
codebase (AST extraction + semantic clustering). Useful before large refactors or when
onboarding to an unfamiliar area. The graph is regenerated incrementally — only changed
files are reprocessed.

**When to use:** Before planning cross-service changes, when tracing call graphs,
when understanding module dependency clusters.

**Output:** `graph_output/` directory (gitignored) — HTML, JSON, and markdown reports.

### stop-slop — Anti-AI-Slop Writing

Installed via: `curl -sL https://raw.githubusercontent.com/hardikpandya/stop-slop/main/SKILL.md -o ~/.claude/skills/stop-slop/SKILL.md`
Skill: `~/.claude/skills/stop-slop/SKILL.md` | Trigger: `/stop-slop`

Enforces direct, specific, active-voice prose. Eliminates throat-clearing openers,
false agency ("this code aims to…"), em dashes, rhetorical setups, passive voice,
and all patterns that make output sound AI-generated.

**When to use:** When drafting documentation, PR descriptions, ADRs, runbooks, or
any user-facing text. Apply before committing any prose to the repo.

### owasp-security — Security Code Review

Installed via: `curl -sL https://raw.githubusercontent.com/agamm/claude-code-owasp/main/.claude/skills/owasp-security/SKILL.md -o ~/.claude/skills/owasp-security/SKILL.md`
Skill: `~/.claude/skills/owasp-security/SKILL.md` | Trigger: `/owasp-security`

Checks code against OWASP Top 10:2025, ASVS 5.0, and Agentic AI Security (ASI01-ASI10).
Covers input validation, authentication, access control, data protection, error handling,
and language-specific security quirks for Python and TypeScript.

**When to use:** Automatically activates when reviewing auth code, handling user input,
working with cryptography, or designing API endpoints. Also invoke explicitly with
`/owasp-security` before any security-sensitive PR.

### caveman — Token-Efficient Communication

Installed via: `claude plugin marketplace add JuliusBrussee/caveman && claude plugin install caveman@caveman`
Plugin: Claude Code plugin (not a skill file) | Trigger: `/caveman`

Reduces output token usage by ~75% while retaining technical accuracy. Useful during
long sessions to stay within context budgets.

**Permitted uses:**

- `/caveman` — compressed explanations and analysis
- `/caveman-review` — terse PR feedback (one line: location + problem + fix)

**Prohibited:** `/caveman-commit` — its output format (`L<Line>: <problem>. <fix>.`)
violates this project's commitlint rules (Conventional Commits enforced in CI).
All commit messages must follow `type(scope): imperative description` — see Part IX.

### frontend-design — Anti-Generic UI/UX (Anthropic Official)

Installed via: `curl` from `anthropics/skills` repo (skills.sh)
Skill: `~/.claude/skills/frontend-design/SKILL.md` | Trigger: `/frontend-design`

Creates distinctive, production-grade interfaces. Avoids generic AI aesthetics
(Inter font, purple gradients, overused component patterns). Enforces bold
typography, intentional color palettes, and purposeful motion.

**When to use:** Automatically activates when building or styling web UI,
React components, dashboards, or pages. Invoke with `/frontend-design` when
designing new panels. The terminal's existing CSS palette (#0a0a0f, #f59e0b,
JetBrains Mono) already follows this philosophy — maintain consistency with it.

### Trail of Bits Security Skills

Marketplace: `claude plugin marketplace add trailofbits/skills`
Installed plugins: `semgrep-rule-creator`, `static-analysis`, `variant-analysis`

- **`semgrep-rule-creator@trailofbits`** — write Semgrep rules to detect
  vulnerability patterns across the codebase
- **`static-analysis@trailofbits`** — SAST: trace data flows, flag unsafe
  patterns in Python and TypeScript
- **`variant-analysis@trailofbits`** — given one vulnerability, find all
  similar variants across the entire codebase

**When to use:** Before any PR touching auth, input validation, DB queries,
API endpoints, or dependency upgrades. Use alongside `/owasp-security`.

### Not installed — Snyk

Requires a paid API key. Add in a future session when provisioned.

### Not installed — Chrome DevTools MCP

Requires a running MCP server. Add when E2E infrastructure is active.

---

## PART XXI — ENGINEERING LAWS AND PROFESSIONAL OBLIGATIONS

These principles are derived from established software engineering laws and
professional practice standards. They complement the rules above and apply
to every architectural, implementation, and process decision in this project.

---

### 21.1 — COMPLEXITY AND SCOPE

**Gall's Law — Start simple, evolve complexity.**
A complex system that works evolved from a simple system that worked.
A complex system designed from scratch does not work.
Build the minimum viable version first. Evolve from there.
Never launch a fully-engineered solution before a working simple one exists.

**Zawinski's Law — Resist scope creep actively.**
Every system tends to expand until it does everything.
For every proposed feature: is this critical to the core workflow?
If the answer requires justification, the answer is no.
New scope requires a new ADR. No ADR, no feature.

**Greene's Law — Every line of code is a liability.**
Code costs money to test, maintain, debug, and understand.
Write only what is necessary. Prefer deleting to adding.
Reuse existing libraries before writing new logic.
If a feature can be deferred without harming the product, defer it.

**Law of Leaky Abstractions — Know the layer beneath yours.**
All non-trivial abstractions leak under edge cases and failure.
Never rely on a framework abstraction in a production-critical path
without understanding what it hides. Log at the raw level when debugging.

---

### 21.2 — ESTIMATION AND DELIVERY

**Hofstadter's Law — Estimates are always wrong. Plan for it.**
It always takes longer than expected, even when you account for this law.
Break features into micro-deliverables. Each must be independently verifiable.
Double initial estimates for any work touching multiple layers.
A plan with no buffer is not a plan — it is a wish.

**Pareto Principle — 80% of bugs live in 20% of the code.**
High-risk code clusters in older shared utilities and integration boundaries.
Before a release, identify which 20% of the codebase has the most history
of bugs and focus test coverage there. SonarCloud metrics guide this.

---

### 21.3 — TESTING AND QUALITY

**Law of Diminishing Returns — Test the right things, not all things.**
Coverage beyond 80–90% produces diminishing value while inflating test
maintenance cost. Focus tests on business logic, data flows, and integrations.
Do not test language guarantees, framework internals, or getter/setter trivia.
The coverage thresholds in this project reflect this: they are minimums, not targets.

**Boy Scout Rule — Leave code better than you found it.**
Fix typos, extract magic numbers to constants, remove dead code, and add
missing types while working on a feature. Improve 1% at a time.
Compounding small improvements outperform periodic rewrites.

**Entropy is inevitable — schedule refactoring.**
Clean architecture decays without active maintenance. Technical debt accrues
interest. Treat refactoring as a recurring cost, not an optional activity.
If you cannot schedule it, it will be paid in production incidents.

---

### 21.4 — DATA AND INTEGRATION INTEGRITY

**Plan data before UI.**
Integration architecture, data ownership, sync requirements, and API failure
handling must be defined before any UI design is locked in.
Data structure changes discovered mid-UI design create patchwork fixes
that compound into maintenance failures. Schema first, interface second.

**Postel's Law — Be strict on output, careful on input.**
Validate all inputs at every system boundary. Sanitize before storing.
Standardize outputs — internal systems downstream depend on stable contracts.
This project enforces this via Pydantic on all API inputs and TypeScript
strict types on all frontend data shapes.

---

### 21.5 — PROFESSIONAL OBLIGATIONS

**Public interest over expediency.**
This terminal handles financial data. Errors here have economic consequences.
Never ship code with known defects to meet a deadline.
Never disable a safety check to unblock a feature.
The user's financial data deserves the same care as production banking software.

**Competence boundary — only work within verified skill.**
Do not implement cryptography, financial calculations, or compliance logic
without verifying the approach against a specification or established reference.
Document the reference. If no reference exists, do not implement it yet.

**Traceability is a professional obligation, not a preference.**
Every decision — architectural, implementation, configuration — must be
traceable to a documented rationale. This is not bureaucracy. It is the
minimum standard for work that others (or future you) must maintain.
ADRs, commit messages, and constants with comments are the mechanism.

**Decisions are made once, documented permanently.**
An undocumented decision will be re-litigated. Every time it is re-litigated,
it costs time and introduces inconsistency. Write it down once. Never again.

---

### 21.6 — AI-ASSISTED DEVELOPMENT DISCIPLINE

**AI tools accelerate output, not judgment.**
AI-generated code is produced faster than it can be verified. Faster wrong
output is a more efficient detour. Every AI suggestion must be reviewed with
the same rigour as human-written code: types, tests, architecture alignment.

**AI cannot substitute for architecture.**
Do not use AI generation to skip planning, replace code review, or defer
documentation. The planning requirements in Part III apply to AI-assisted
work without exception. Plan first. Generate second. Review always.

**AI output is not trusted at boundaries.**
Any AI-generated code touching auth, input validation, database queries,
cryptography, or external API integration requires explicit security review
before merge. Use `/owasp-security` and the Trail of Bits SAST tools.

---

### 21.7 — POST-LAUNCH DISCIPLINE

**Launch is the beginning, not the finish line.**
The plan for what happens after release must exist before release.
Monitoring, support ownership, bug triage process, rollback procedure,
and a prioritised improvement backlog are required, not optional.
A launch without a post-launch plan is a controlled crash.

**Measure before optimising.**
No performance work begins without a measurement baseline.
Lighthouse CI, ClickHouse query plans, and Redis hit rates are the tools.
Optimise what the data shows is slow. Not what intuition suggests.
