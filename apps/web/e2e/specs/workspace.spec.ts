/**
 * Workspace E2E tests — terminal shell, preset loading, and command palette.
 *
 * Requires: `docker compose up` + dev server running at E2E_BASE_URL.
 * Run with: pnpm --filter @terminal/web test:e2e
 *
 * Covered scenarios (Phase 2 exit criteria):
 *   - Default equities preset loads Chart, Quote, Watchlist, News panels
 *   - `?ws=macro` URL loads the macro preset
 *   - `?ws=filings-research` URL loads the filings research preset
 *   - Ctrl+K opens the command palette
 *   - Command palette closes on Escape
 *   - Typing in the command palette filters results
 *   - Preset switch via command palette replaces the workspace layout
 *   - Layout snapshot is persisted and restored across page reload
 */
import { test, expect, type Page } from '@playwright/test';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Wait for the workspace shell to finish mounting. Dockview renders asynchronously;
 * we wait for the dockview container to appear rather than an arbitrary delay.
 */
async function waitForWorkshell(page: Page): Promise<void> {
  await page.waitForSelector('.dockview-theme-dark', { timeout: 10_000 });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Workspace shell', () => {
  test('loads the equities preset by default with Chart, Quote, Watchlist, News panels', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForWorkshell(page);

    // Dockview renders panel titles as tab labels — assert all four expected panels.
    await expect(page.getByTitle('Chart')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTitle('Quote')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTitle('Watchlist')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTitle('News')).toBeVisible({ timeout: 5_000 });
  });

  test('loads the macro preset via ?ws=macro URL parameter', async ({ page }) => {
    await page.goto('/?ws=macro');
    await waitForWorkshell(page);

    // Macro preset has 4 FRED series panels.
    await expect(page.getByTitle('FEDFUNDS')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTitle('DGS10')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTitle('CPIAUCSL')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTitle('UNRATE')).toBeVisible({ timeout: 5_000 });
  });

  test('loads the filings research preset via ?ws=filings-research URL parameter', async ({
    page,
  }) => {
    await page.goto('/?ws=filings-research');
    await waitForWorkshell(page);

    await expect(page.getByTitle('Quote')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTitle('Filings')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTitle('News')).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Command palette', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForWorkshell(page);
  });

  test('opens on Ctrl+K', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await expect(page.getByRole('dialog', { name: /command palette/i })).toBeVisible({
      timeout: 3_000,
    });
  });

  test('closes on Escape', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await expect(page.getByRole('dialog', { name: /command palette/i })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: /command palette/i })).not.toBeVisible({
      timeout: 2_000,
    });
  });

  test('displays instrument results when typing a symbol', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await page.getByPlaceholder(/search instruments/i).fill('AAPL');

    // At least one result row matching AAPL should appear.
    await expect(page.locator('[cmdk-item]', { hasText: 'AAPL' }).first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test('shows workspace preset switching actions', async ({ page }) => {
    await page.keyboard.press('Control+k');

    await expect(page.getByText('Switch to Equities')).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText('Switch to Macro')).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText('Switch to Filings Research')).toBeVisible({ timeout: 3_000 });
  });

  test('switches workspace preset when a preset action is selected', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await page.getByText('Switch to Macro').click();

    // After switching, macro panels should appear.
    await expect(page.getByTitle('FEDFUNDS')).toBeVisible({ timeout: 10_000 });
    // And equities panels should be gone.
    await expect(page.getByTitle('Watchlist')).not.toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Layout persistence', () => {
  test('restores the preset layout after page reload', async ({ page }) => {
    await page.goto('/?ws=macro');
    await waitForWorkshell(page);
    await expect(page.getByTitle('FEDFUNDS')).toBeVisible({ timeout: 10_000 });

    // Reload — the snapshot in localStorage should restore the macro layout.
    await page.reload();
    await waitForWorkshell(page);

    // Macro panels still visible after reload.
    await expect(page.getByTitle('FEDFUNDS')).toBeVisible({ timeout: 10_000 });
  });
});
