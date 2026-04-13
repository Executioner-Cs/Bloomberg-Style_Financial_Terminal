# CLAUDE.md — Bloomberg Terminal Project Rules
# Last updated: 2026-04-13 (added branching and commit workflow)
# This file governs ALL AI-assisted code generation in this project.
# Read it entirely before writing a single line of code.

---

## CRITICAL PRINCIPLE

This is a production financial application built by a solo developer.
There is NO tech debt budget. Every shortcut taken now is a maintenance
burden with no team to absorb it.

**When in doubt: do it right or do not do it yet.**

---

## LANGUAGE & TYPING

### TypeScript (ALL frontend and ws-gateway code)
- `"strict": true` in tsconfig.json — NON-NEGOTIABLE. No exceptions.
- `noUncheckedIndexedAccess: true` — array access returns T | undefined
- `exactOptionalPropertyTypes: true` — optional means explicitly optional
- NEVER use `any`. Use `unknown` and narrow with type guards.
- NEVER use `@ts-ignore`. Fix the type error.
- `@ts-expect-error` allowed ONLY with a comment explaining why, on its own line.
- NEVER cast with `as` unless you own the data shape AND add a runtime assertion.
- All exported functions must have explicit return type annotations.
- Use `satisfies` operator for config objects.
- Prefer `type` over `interface` for data shapes; `interface` for extension points.
- Use discriminated unions for all state machines and event types.

### Python (ALL api and worker code)
- Python 3.12+ — use modern syntax: `X | Y` unions, `match` statements.
- `from __future__ import annotations` at top of every module.
- Type hints REQUIRED on every function parameter and return value.
- NO `Any` from typing — use proper types or bounded `TypeVar`.
- Pydantic v2 for ALL data validation — never validate manually with if/isinstance.
- `mypy --strict` must pass. Configured in `pyproject.toml` under `[tool.mypy]`.
- `ruff` for linting (replaces flake8 + isort + pylint). Zero warnings allowed.
- `black` for formatting — 88 character line length.

---

## FILE NAMING CONVENTIONS

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
- Routers: noun-plural (e.g., `instruments.py`, `watchlists.py`)
- Services: noun-singular + `_service` (e.g., `market_data_service.py`)
- Repositories: noun-singular + `_repository` (e.g., `ohlcv_repository.py`)
- Integrations: provider name (e.g., `marketstack.py`, `edgar.py`)
- Tests: `test_` prefix matching source file

### General
- No abbreviations in file names (ok: `api`, `url`, `id`, `ws`)
- No `utils.ts` / `helpers.py` dumping grounds — name files after what they DO
- One primary export per file

---

## DIRECTORY RULES
- NEVER create files in root of `services/api/src/` — use correct subdirectory
- NEVER put business logic in `routers/` — routers call services only
- NEVER put database queries in services — service calls repository, always
- NEVER import from `apps/web/` into `packages/` — packages have zero app dependencies
- NEVER put API calls directly in React components — use hooks with TanStack Query

---

## COMMIT MESSAGE FORMAT (Conventional Commits — enforced by commitlint)

Format: `<type>(<scope>): <imperative description>`

**Types:**
- `feat`     — new user-visible feature
- `fix`      — bug fix
- `perf`     — performance improvement
- `refactor` — code change, no feature/bug
- `test`     — adding or correcting tests
- `docs`     — documentation only
- `ci`       — CI/CD pipeline changes
- `chore`    — build process, dependency updates
- `revert`   — reverts a previous commit

**Scopes (must be one of):**
`api`, `worker`, `ws-gateway`, `web`, `db`, `infra`, `docs`, `deps`, `plugins`, `types`, `ui-components`

**Examples:**
```
feat(web): add RSI indicator to chart panel
fix(api): correct OHLCV timezone handling for non-UTC exchanges
perf(db): add index on filings.filed_at for pagination query
feat(worker): implement EDGAR 8-K RSS ingestion task
```

**Rules:**
- Imperative present tense: "add" not "added", "fix" not "fixes"
- Max 72 characters for subject line
- Body required for breaking changes and non-obvious fixes
- BREAKING CHANGE: footer required when API contracts change
- FORBIDDEN: "WIP", "fix stuff", "updates", "misc changes", "temp"

---

## BRANCH NAMING

Format: `<type>/<scope>/<short-description>`

Examples:
- `feat/web/rsi-indicator`
- `fix/api/ohlcv-timezone`
- `perf/db/filing-index`
- `chore/deps/pydantic-v2-upgrade`

**Rules:**
- All lowercase, hyphens only (no underscores, no dots)
- Max 50 characters total
- NEVER commit directly to `main` or `develop`
- `main` — production deployments only (CI deploys on merge)
- `develop` — integration branch
- Feature branches cut from `develop`, merged back via PR

---

## BRANCHING AND COMMIT WORKFLOW

### Branch discipline
- One branch = one meaningful unit of work. Never mix unrelated changes.
- Propose the branch name before starting — the name enforces the scope.
- If you cannot describe the branch in one short phrase, it is too broad. Split it.
- Branch is cut from `develop`. Never from `main`.

### Commit discipline
- One commit = one verified, stable step forward.
- Every commit must leave the codebase in a fully passing state.
  - Backend: health check passes, affected endpoint returns expected response.
  - Frontend: page renders, zero console errors, affected interaction works.
  - Infra: `docker compose up` comes up clean with no errors.
- NEVER commit code that has not been manually verified to work.
- NEVER batch unrelated changes into one commit — one logical change per commit.

### Before every commit
- Run the pre-commit checklist from the section below.
- Explicitly verify: does this change break anything that was working before?
- If unsure about regression: test the affected flow end-to-end before committing.

### Before every push
- All commits on the branch pass CI checks locally (typecheck, lint, tests).
- No secrets or API keys in the diff (`git diff` reviewed before push).
- Branch is scoped to exactly what the branch name describes — nothing extra.

---

## ABSOLUTE PROHIBITIONS

### Architecture violations
- NEVER call an external API from a router — always through service → cache check first
- NEVER store secrets in code, config files, or git history. Env vars only.
- NEVER disable CORS in production — configure it explicitly with an allowlist
- NEVER use `SELECT *` in ClickHouse — always name columns explicitly
- NEVER write raw SQL strings in Python — use SQLAlchemy ORM or `text()` with bound parameters
- NEVER concatenate user input into SQL, Redis commands, or cache keys
- NEVER use synchronous HTTP calls in FastAPI routes — use `httpx.AsyncClient`
- NEVER use `time.sleep()` in async Python — use `asyncio.sleep()`
- NEVER swallow exceptions with bare `except:` or `except Exception: pass`

### Frontend violations
- NEVER use `useEffect` for derived state — use `useMemo`
- NEVER use `useEffect` to sync two pieces of state — consolidate into one source of truth
- NEVER call `setState` inside render
- NEVER use inline styles for layout — use Tailwind utility classes
- NEVER use `!important` in CSS — signals a specificity architecture failure
- NEVER import more than 3 `../` levels deep — use path alias `@/`
- NEVER put API calls directly in components — hook → TanStack Query
- NEVER store sensitive data in `localStorage` or `sessionStorage`

### Data & security violations
- NEVER log raw API keys, tokens, or passwords — even in DEBUG logs
- NEVER expose internal error messages to API responses (use generic message + request_id)
- NEVER skip Pydantic validation on POST/PUT endpoints
- NEVER hardcode rate limits in code — source from `config.py` / env vars
- NEVER commit API keys even in test files — mock them

### Tech debt patterns (BANNED)
- NEVER add a TODO without a GitHub issue number: `# TODO(#123): description`
- NEVER copy-paste more than 5 lines — extract a function
- NEVER write a function longer than 50 lines — extract helpers
- NEVER write a file longer than 400 lines — split the module
- NEVER add a dependency without a comment in package.json/pyproject.toml explaining why

---

## TESTING REQUIREMENTS

### Coverage minimums (enforced in CI — build fails below threshold)
- Python services layer: 80% line coverage
- Python repositories layer: 70% line coverage
- Python routers: 60% (integration tests cover the rest)
- React hooks: 80% line coverage
- React components: 60% (E2E covers the rest)
- Utility functions (both languages): 90% line coverage

### Required test types for every new feature

**Unit tests** (no I/O, all dependencies mocked):
- Every service method with a non-trivial branch
- Every utility function with edge cases
- Every Pydantic schema with invalid inputs
- Every TypeScript function with type-guarded branches

**Integration tests** (real database, no external HTTP):
- Every FastAPI endpoint (use `httpx.AsyncClient` + test database)
- Every repository query with representative data

**E2E tests** (Playwright, real browser):
- Chart loads and renders candlesticks
- Watchlist: add/remove symbol
- Command palette: open, find symbol, navigate to chart
- Alert: create and receive notification
- Screener: build filter, run, inspect results

### Test naming conventions
- Python: `test_<function_name>_<scenario>` (e.g., `test_get_ohlcv_returns_empty_for_unknown_symbol`)
- TypeScript: `describe("<ComponentName>") > it("should <behavior>")` pattern

### Test prohibitions
- NEVER use `time.sleep()` in tests — use mocks or async patterns
- NEVER test implementation details — test behavior and outputs
- NEVER share mutable state between tests — each test fully independent
- NEVER make real HTTP calls in unit or integration tests — mock all external APIs

---

## PERFORMANCE BUDGETS (Lighthouse CI in GitHub Actions)

### Frontend
- First Contentful Paint: < 1.5s (simulated 4G)
- Time to Interactive: < 3.5s
- Largest Contentful Paint: < 2.5s
- Total Blocking Time: < 200ms
- Initial JS bundle: < 200KB gzipped
- Total JS (async included): < 1MB gzipped

### API
- P50 response time for cached endpoints: < 50ms
- P99 response time for cached endpoints: < 200ms
- P50 response time for ClickHouse OHLCV queries (1Y daily): < 100ms
- P99 response time for ClickHouse OHLCV queries: < 500ms
- Screener endpoint (uncached, complex query): < 2s P99

### Real-time
- WebSocket message fan-out latency (server receive → client receive): < 50ms
- Price update frequency: throttled to 1 update/second per symbol per client

---

## SECURITY RULES

### Authentication
- JWT access tokens: 15-minute expiry
- Refresh tokens: 7-day expiry, rotated on each use, stored in httpOnly Secure cookie
- API keys: stored as SHA-256 hash in database, shown to user exactly once
- Passwords: bcrypt minimum cost factor 12

### Input validation
- All user-supplied strings: enforce max length limits in Pydantic schemas
- Symbol validation: regex `^[A-Z0-9./\-]{1,20}$`
- Date range limits: max 10 years for OHLCV requests
- Screener: max 10 filters per query, max 5 sort fields

### Rate limiting
- Anonymous: 60 requests/hour per IP
- Free tier: 300 requests/hour per user
- Pro tier: 3000 requests/hour per user
- WebSocket subscriptions: max 50 symbols per connection

### HTTP Security Headers (set by Nginx)
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Content-Security-Policy`: explicitly defined allowlist, no `unsafe-inline`, no `unsafe-eval`
- `Referrer-Policy: strict-origin-when-cross-origin`

### Dependency security
- `npm audit` and `pip-audit` run in CI — HIGH/CRITICAL vulnerabilities block merge
- `dependabot` configured for automated patch PRs
- Docker base images: always pin to SHA digest, not floating tags

---

## DOCUMENTATION REQUIREMENTS

### Code documentation
- Every public function/class/method: docstring (Python) or JSDoc (TypeScript)
- Docstrings explain WHY, not WHAT (the code explains what)
- Complex algorithms: comment citing source/reference paper
- Every Pydantic model field: `description` parameter
- Every FastAPI endpoint: `summary`, `description`, `response_model`

### Architecture Decision Records (ADRs)
- Location: `docs/architecture/decisions/`
- Required when: choosing between two viable tech options, making a breaking change
- Format: Title · Status · Context · Decision · Consequences
- ADRs are IMMUTABLE — create a new ADR to supersede, never edit old ones

### Runbooks
- New external data source: update `docs/runbooks/adding-data-source.md`
- New UI panel: update `docs/runbooks/adding-ui-panel.md`
- Runbooks must be step-by-step, verifiable, written by the person doing the work

### Changelog
- `CHANGELOG.md` updated in every PR that changes user-facing behavior
- Format: Keep a Changelog (https://keepachangelog.com)

---

## HOW TO ADD A NEW DATA SOURCE

Follow this checklist in order. Do NOT skip steps.

1. **Read the ToS first.** Document rate limits, caching requirements, attribution
   requirements, and redistribution restrictions. Create an ADR if a policy affects architecture.

2. **Create the integration client** in `services/api/src/integrations/<provider>.py`:
   - Subclass `BaseIntegrationClient` (provides retry, backoff, timeout)
   - All methods fully type-annotated, returning Pydantic schemas
   - Include `User-Agent` header with contact info where required (SEC EDGAR requires this)
   - Implement rate limit tracking with Redis counters
   - Unit tests with `httpx` mock transport — ZERO real HTTP calls in tests

3. **Add required environment variables** to:
   - `.env.example` with description comment
   - `services/api/src/config.py` as a `pydantic-settings` field
   - CI secrets documentation in `docs/runbooks/`

4. **Create the ingestion task** in `services/worker/src/tasks/`:
   - Explicit Celery task name, `max_retries`, `time_limit`
   - Idempotent logic — re-running must not create duplicates
   - Add to Celery Beat schedule in `celery_app.py`

5. **Add a cache layer** in the consuming service:
   - Determine appropriate TTL (respect ToS caching minimums)
   - Add cache key constant to `services/api/src/cache/keys.py`
   - Cache-aside pattern: check cache → miss → fetch → store → return

6. **Expose via REST endpoint** following existing router patterns.

7. **Add integration test** with a VCR cassette (record real response once, replay in CI).

8. **Update** `docs/runbooks/adding-data-source.md` with this provider's specifics.

---

## HOW TO ADD A NEW UI PANEL

Follow this checklist in order.

1. **Define the panel's data contract first.** What REST endpoints or WebSocket channels
   does it consume? If endpoints don't exist, build them first (backend before frontend).

2. **Create the panel directory**: `apps/web/src/panels/<panel-name>-panel/`
   Required files:
   - `index.tsx` — barrel export
   - `<PanelName>Panel.tsx` — root panel component
   - `<PanelName>Panel.test.tsx` — component tests
   - Sub-components in the same directory

3. **Panel component interface** (ALL panels MUST accept these props):
   ```typescript
   interface PanelProps {
     panelId: string;    // Unique instance ID for layout state
     isActive: boolean;  // Whether this panel has keyboard focus
     onClose: () => void;
   }
   ```

4. **Data fetching**: TanStack Query hooks only. Create `use<PanelName>Data()` in same directory.
   No direct `fetch()` calls inside components, ever.

5. **Keyboard navigation**: Every panel must be fully keyboard-navigable.
   Register panel-specific shortcuts with `useKeyboardShortcuts` when `isActive === true`.

6. **Loading and error states**: Every panel MUST render `<PanelSkeleton>` during loading
   and `<PanelError>` on failure. Use components from `packages/ui-components`.

7. **Register the panel** in `apps/web/src/panels/index.ts` (panel registry).

8. **Register in command palette**: Panel must be openable via Ctrl+K search.

9. **Add E2E test** in `apps/web/e2e/specs/<panel-name>.spec.ts`.

10. **Update runbook**: `docs/runbooks/adding-ui-panel.md`.

---

## PLUGIN DEVELOPMENT RULES

1. **Plugins are isolated.** They CANNOT import from the main application source.
   They consume ONLY the `PluginAPI` provided at runtime.

2. **Bundles are self-contained.** Bundle all dependencies into `dist/bundle.js`.
   Do not rely on globals from the host application.

3. **Permissions are declared, not assumed.** If your plugin needs `market-data:read`,
   declare it in `manifest.json`. The host will refuse to load plugins with undeclared permissions.

4. **Plugin storage is namespaced.** `PluginAPI.storage` keys are automatically prefixed
   with the plugin ID. Plugins cannot access each other's storage.

5. **Plugins handle errors gracefully.** A plugin crash must NOT crash the terminal.
   All plugin code runs inside a React Error Boundary.

6. **Performance budget.** A plugin panel must not cause the page to drop below
   30fps for more than 500ms.

7. **Plugin versioning.** Plugins declare `minApiVersion`. The host checks compatibility
   on load and shows a deprecation warning or refuses to load incompatible versions.

8. **Forbidden without exception.** `eval()`, `Function()` constructor, dynamic script injection.
   These are blocked by CSP regardless.

9. **Plugin PRs require:** manifest.json review, security review of permissions requested,
   performance test results, plugin README.md.

---

## ENVIRONMENT VARIABLES DISCIPLINE

- ALL environment variables MUST be declared in `.env.example` with a comment
- NEVER use default values for secrets in production config — fail loudly if missing
- FastAPI app MUST REFUSE to start if required environment variables are missing
- Separate env files per environment: `.env.development`, `.env.test`
- `.env` (actual secrets) is ALWAYS in `.gitignore` — no exceptions
- Use `pydantic-settings` BaseSettings for all config parsing and validation

---

## PRE-COMMIT SELF-REVIEW CHECKLIST

Before every commit, verify ALL of the following:

- [ ] `pnpm run typecheck` passes (zero TypeScript errors)
- [ ] `pnpm run lint` passes (zero ESLint errors, zero ruff warnings)
- [ ] `mypy --strict` passes on all changed Python files
- [ ] All new code has tests at the required coverage level
- [ ] New env vars documented in `.env.example`
- [ ] Performance-sensitive code has been benchmarked
- [ ] No secrets, API keys, or PII in the diff
- [ ] `CHANGELOG.md` updated if this is a user-facing change
- [ ] ADR created if an architectural decision was made
- [ ] Commit message follows Conventional Commits format
