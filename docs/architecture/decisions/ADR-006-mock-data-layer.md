# ADR-006: Mock Data Layer for Development Without Live API Access

**Status:** Accepted
**Date:** 2026-04-18
**Author:** Mayank Khandelwal

---

## Context

The terminal integrates six external data providers (CoinGecko, yfinance, FRED, SEC
EDGAR, NewsAPI, Finnhub). During development and CI, calling live APIs creates several
problems:

1. **Rate limits are consumed** by every `pytest` run, depleting free-tier quotas.
2. **Network failures break local dev** when a provider has an outage or throttles.
3. **Tests must not make real HTTP calls** (CLAUDE.md Part XI — no real HTTP in unit
   or integration tests).
4. **Onboarding friction** — a new session requires all API keys to be configured
   before the terminal is usable.

An inline mock (e.g. `PLACEHOLDER_INSTRUMENTS` in `use-instruments.ts`) already
exists in the frontend. This ADR formalises and extends that pattern to the backend
layer, giving the backend a consistent mock data contract that survives across sessions.

---

## Decision

### Toggle mechanism

A single environment variable `MOCK_DATA=true` routes all integration calls to local
JSON files instead of live APIs. Setting `MOCK_DATA=false` (the production default)
restores all live provider calls with no code changes required.

The toggle is **explicit** rather than auto-detected (e.g. "fall back to mock if key
is absent") because silent fallbacks mask configuration errors in staging/production.
Explicit is safer.

### Data location

Pre-generated mock JSON files live in `mock_data/` at the project root. This
directory is mounted read-only into the API and worker Docker containers.

```
mock_data/
├── instruments.json      # Full instrument list (crypto + equities)
├── quotes.json           # Latest quote per symbol
├── ohlcv/
│   ├── BTC_1D.json       # OHLCVResponse-shaped JSON per symbol/timeframe
│   └── ...
└── macro/
    ├── GDP.json           # MacroSeriesResponse-shaped JSON per FRED series
    └── ...
```

### Data format

Mock files use **normalised internal schema format** (matching the project's own
Pydantic response shapes), not raw provider API response format. Benefits:

- Vendor-agnostic: swapping yfinance for another equities provider does not require
  regenerating mock files.
- No parsing code in the mock path: `MockDataLoader` deserialises directly into
  internal types without the provider-specific transformation code.

### Path resolution

`MockDataLoader` locates the project root by walking up from `__file__` until a
directory containing `.git/` is found. This avoids hardcoded absolute paths (CLAUDE.md
Rule 1) and works regardless of where Python is invoked from. Override with the
`MOCK_DATA_DIR` environment variable for non-standard project layouts (e.g., CI
runners where `.git/` is not present).

### Generation

`scripts/generate_mock_data.py` — a standalone script with no project imports —
generates all mock files using a deterministic seeded random walk (`random.seed(42)`).
Re-running is safe and idempotent. Output is committed to git so the terminal works
out of the box after `git clone` with no script execution required.

---

## Consequences

**Positive:**

- Terminal works fully offline after `git clone` with `MOCK_DATA=true` in `.env`.
- Unit and integration tests never hit live APIs.
- Adding a real API key is the only change needed to go live; all integration code
  paths are identical in mock and live modes.
- CI is fast and deterministic (no network calls, no flaky 429s).

**Negative:**

- Mock data must be regenerated when the internal schema changes (new fields on
  `OHLCVRow`, etc.). The script makes this a one-command operation.
- Mock prices are synthetic (random walk from approximate historical ranges). They
  are realistic enough for UI development but not for backtesting.
- `mock_data/ohlcv/` and `mock_data/macro/` add ~500 KB to the repository. Acceptable
  for a developer-tools project; large files like images or video are not involved.

---

## Rejected Alternatives

### Auto-detect based on missing API key

Pro: Zero configuration.
Con: Masks misconfiguration in staging/production. A misconfigured key silently serves
stale mock data instead of failing loudly. Rejected in favour of explicit toggle.

### Separate mock microservice (e.g., WireMock)

Pro: Mock responses match the exact HTTP wire format.
Con: Requires a running Docker container; more ops overhead than a file loader;
no benefit over the current approach since integration clients are already tested
with `httpx.MockTransport`.

### In-memory fixtures only (test-time mocks)

Pro: No files committed to git.
Con: The terminal cannot be demoed locally without live API access. The mock_data/
folder enables offline demos and fast onboarding.
