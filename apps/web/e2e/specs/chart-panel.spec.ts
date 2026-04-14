/**
 * Chart panel E2E tests.
 *
 * Requires: `docker compose up` + dev server running at VITE_DEV_BASE_URL.
 * Run with: pnpm --filter @terminal/web test:e2e
 */
import { test, expect } from '@playwright/test';

test.describe('ChartPanel', () => {
  test('should render the chart for a valid symbol', async ({ page }) => {
    await page.goto('/chart/bitcoin');

    // Loading state must resolve within 10 seconds
    await expect(page.locator('.terminal-loading')).not.toBeVisible({ timeout: 10_000 });

    // Chart container must be present
    await expect(page.locator('[aria-label="Price chart for bitcoin"]')).toBeVisible();

    // lightweight-charts renders a canvas element
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('should show the symbol in the panel header', async ({ page }) => {
    await page.goto('/chart/ethereum');

    await expect(page.getByText('ETHEREUM')).toBeVisible({ timeout: 10_000 });
  });

  test('should render timeframe selector buttons', async ({ page }) => {
    await page.goto('/chart/bitcoin');

    await expect(page.getByRole('button', { name: '1D' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '1W' })).toBeVisible();
    await expect(page.getByRole('button', { name: '1M' })).toBeVisible();
  });

  test('should switch timeframe when button is clicked', async ({ page }) => {
    await page.goto('/chart/bitcoin');

    // Wait for initial render
    await expect(page.getByRole('button', { name: '1D' })).toBeVisible({ timeout: 10_000 });

    // Click 1W timeframe
    await page.getByRole('button', { name: '1W' }).click();

    // 1W button should appear selected (accent background)
    // and chart should still be visible
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('should navigate back to index when close is clicked', async ({ page }) => {
    await page.goto('/chart/bitcoin');

    await expect(page.getByRole('button', { name: /close chart panel/i })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole('button', { name: /close chart panel/i }).click();

    await expect(page).toHaveURL('/');
  });
});
