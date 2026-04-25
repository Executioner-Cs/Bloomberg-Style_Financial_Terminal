/**
 * Playwright configuration for E2E tests.
 *
 * Environment variables:
 *   E2E_BASE_URL — base URL of the running dev or staging server.
 *                  Defaults to http://localhost:5173 (Vite default, port
 *                  registered in CLAUDE.md Part III as the frontend dev server).
 *
 * Prerequisites for running E2E tests:
 *   - `docker compose up` — starts API, Redis, ClickHouse, PostgreSQL
 *   - `pnpm --filter web dev` — starts the Vite dev server
 *   OR
 *   - `docker compose --profile e2e up` when a bundled E2E profile is added
 *
 * Usage:
 *   pnpm --filter @terminal/web test:e2e
 */
import { defineConfig, devices } from '@playwright/test';

/** Base URL read from environment, falling back to the Vite dev server default. */
const BASE_URL = process.env['E2E_BASE_URL'] ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e/specs',

  /** Maximum time per test before it is considered failed. */
  timeout: 30_000,

  /** Fail the suite on first test file failure in CI — fast feedback. */
  forbidOnly: Boolean(process.env['CI']),

  /** Retry failed tests once in CI to reduce flake noise. */
  retries: process.env['CI'] ? 1 : 0,

  /** Run test files in parallel — each file gets its own browser context. */
  fullyParallel: true,

  /** Reporter — dot for CI, list for local. */
  reporter: process.env['CI'] ? 'dot' : 'list',

  use: {
    /** Base URL for page.goto('/') calls. */
    baseURL: BASE_URL,

    /** Capture traces on first retry in CI for debugging. */
    trace: 'on-first-retry',

    /** Viewport matches a typical terminal window. */
    viewport: { width: 1440, height: 900 },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
