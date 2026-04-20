/**
 * workspace-api-ref unit tests.
 *
 * Verifies the module-level DockviewApi ref lifecycle:
 *   - getWorkspaceApi returns null before setWorkspaceApi is called
 *   - setWorkspaceApi stores the ref so getWorkspaceApi returns it
 *   - clearWorkspaceApi resets the ref to null
 *   - addPanelToWorkspace returns null when no api is mounted
 *
 * DockviewApi is mocked — the test exercises lifecycle management,
 * not dockview internals.
 *
 * Plan ref: B14, D6 — M4 audit item.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DockviewApi } from 'dockview-react';

import {
  setWorkspaceApi,
  getWorkspaceApi,
  clearWorkspaceApi,
  addPanelToWorkspace,
} from './workspace-api-ref';

import { useWorkspaceStore } from './stores/workspace.store';

// ------------------------------------------------------------------
// Mock DockviewApi
// ------------------------------------------------------------------

function makeMockApi(): DockviewApi {
  return {
    addPanel: vi.fn(),
    removePanel: vi.fn(),
    clear: vi.fn(),
  } as unknown as DockviewApi;
}

// ------------------------------------------------------------------
// Cleanup: clear the api ref and reset workspace store after each test
// to prevent state leaking across tests.
// ------------------------------------------------------------------

beforeEach(() => {
  clearWorkspaceApi();
  useWorkspaceStore.getState().reset();
});

// ------------------------------------------------------------------
// Lifecycle: set / get / clear
// ------------------------------------------------------------------

describe('getWorkspaceApi', () => {
  it('returns null when no api has been registered', () => {
    expect(getWorkspaceApi()).toBeNull();
  });
});

describe('setWorkspaceApi + getWorkspaceApi', () => {
  it('stores the api ref so getWorkspaceApi returns it', () => {
    const api = makeMockApi();
    setWorkspaceApi(api);
    expect(getWorkspaceApi()).toBe(api);
  });

  it('replaces a previous api ref with the new one', () => {
    const api1 = makeMockApi();
    const api2 = makeMockApi();
    setWorkspaceApi(api1);
    setWorkspaceApi(api2);
    expect(getWorkspaceApi()).toBe(api2);
  });
});

describe('clearWorkspaceApi', () => {
  it('resets the ref to null after the api was stored', () => {
    const api = makeMockApi();
    setWorkspaceApi(api);
    clearWorkspaceApi();
    expect(getWorkspaceApi()).toBeNull();
  });

  it('is a no-op when called without a prior setWorkspaceApi', () => {
    expect(() => clearWorkspaceApi()).not.toThrow();
    expect(getWorkspaceApi()).toBeNull();
  });
});

// ------------------------------------------------------------------
// addPanelToWorkspace
// ------------------------------------------------------------------

describe('addPanelToWorkspace', () => {
  it('returns null when the workspace api is not mounted', () => {
    const result = addPanelToWorkspace('chart', { symbol: 'AAPL' });
    expect(result).toBeNull();
  });

  it('returns a panel ID when the api is mounted', () => {
    const api = makeMockApi();
    setWorkspaceApi(api);
    const panelId = addPanelToWorkspace('chart', { symbol: 'AAPL' });
    expect(panelId).not.toBeNull();
    expect(panelId).toContain('chart-');
  });

  it('calls api.addPanel with the generated panel id', () => {
    // Keep a direct reference to the spy before embedding it in the mock so we
    // can assert on it without an unbound method access (avoids
    // @typescript-eslint/unbound-method which fires on `api.addPanel` access).
    const addPanelSpy = vi.fn();
    const api = {
      addPanel: addPanelSpy,
      removePanel: vi.fn(),
      clear: vi.fn(),
    } as unknown as DockviewApi;
    setWorkspaceApi(api);
    const panelId = addPanelToWorkspace('quote');
    expect(addPanelSpy).toHaveBeenCalledOnce();
    expect(addPanelSpy).toHaveBeenCalledWith(expect.objectContaining({ id: panelId }));
  });

  it('registers the panel instance in the workspace store', () => {
    const api = makeMockApi();
    setWorkspaceApi(api);
    const panelId = addPanelToWorkspace('news', { symbol: 'TSLA' });
    const panels = useWorkspaceStore.getState().panels;
    expect(panelId).not.toBeNull();
    expect(panels[panelId as string]).toMatchObject({
      panelId,
      appId: 'news',
      props: { symbol: 'TSLA' },
    });
  });

  it('generates unique panel IDs for the same appId', () => {
    const api = makeMockApi();
    setWorkspaceApi(api);
    // Use fake timers to control Date.now() — prevents time-based collisions
    // in fast test runs where two calls could happen in the same millisecond.
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const id1 = addPanelToWorkspace('chart');
    vi.setSystemTime(2000);
    const id2 = addPanelToWorkspace('chart');
    vi.useRealTimers();
    expect(id1).not.toBe(id2);
  });
});
