/**
 * Unit tests for WorkspaceShell — verifies dockview actually mounts
 * under jsdom (with the geometry polyfills in test-setup.ts) and
 * that the imperative api surface is handed to onReady.
 *
 * Why bother asserting against a real DockviewApi here and not
 * waiting for Playwright: the failure mode we care about is "shell
 * renders but api never reaches consumers", which means presets
 * (B13), command palette actions (B14), and layout restore (B12)
 * would all silently noop. A unit-level assertion catches that at
 * commit time instead of at E2E time.
 */

import { describe, it, expect } from 'vitest';
import { render, waitFor } from '@testing-library/react';

import { WorkspaceShell } from './WorkspaceShell';
import type { DockviewApi } from 'dockview-react';

describe('WorkspaceShell', () => {
  it('fires onReady with a DockviewApi that exposes the expected imperative surface', async () => {
    let receivedApi: DockviewApi | null = null;

    render(
      <WorkspaceShell
        onReady={(api): void => {
          receivedApi = api;
        }}
      />,
    );

    await waitFor(
      () => {
        expect(receivedApi).not.toBeNull();
      },
      { timeout: 2000 },
    );

    // Assert the api exposes the methods presets/palette/serializer
    // actually depend on. If dockview's public surface changes in a
    // future upgrade, this test will surface the mismatch at the
    // layer where our code binds to it.
    const api = receivedApi as unknown as DockviewApi;
    expect(typeof api.addPanel).toBe('function');
    expect(typeof api.removePanel).toBe('function');
    expect(typeof api.toJSON).toBe('function');
    expect(typeof api.fromJSON).toBe('function');
    expect(typeof api.clear).toBe('function');
  });

  it('renders a dockview container element', () => {
    const { container } = render(<WorkspaceShell />);
    // dockview-theme-dark is applied on our wrapping div.
    const themed = container.querySelector('.dockview-theme-dark');
    expect(themed).not.toBeNull();
  });
});
