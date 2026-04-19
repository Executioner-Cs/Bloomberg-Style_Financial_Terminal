/**
 * Layout serializer unit tests.
 *
 * Covers: save/load/clear localStorage cycle, version validation,
 * corrupt JSON recovery, URL slug read/write, buildSnapshot, buildPresetUrl.
 *
 * Storage is mocked via a Map-backed localStorage stub injected before each
 * test — no real browser APIs required, no jsdom side-effects between tests.
 *
 * Plan ref: B15.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  saveSnapshot,
  loadSnapshot,
  clearSnapshot,
  getPresetSlugFromUrl,
  buildPresetUrl,
  buildSnapshot,
  WORKSPACE_SNAPSHOT_VERSION,
  type WorkspaceSnapshot,
} from './layout-serializer';

// ------------------------------------------------------------------
// localStorage stub
// ------------------------------------------------------------------

function makeLocalStorageStub(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string): string | null => store.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      store.set(key, value);
    },
    removeItem: (key: string): void => {
      store.delete(key);
    },
    clear: (): void => {
      store.clear();
    },
    key: (index: number): string | null => Array.from(store.keys())[index] ?? null,
    get length(): number {
      return store.size;
    },
  } as Storage;
}

beforeEach(() => {
  // Replace global localStorage before each test.
  Object.defineProperty(globalThis, 'localStorage', {
    value: makeLocalStorageStub(),
    writable: true,
    configurable: true,
  });
});

// ------------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------------

const VALID_SNAPSHOT: WorkspaceSnapshot = {
  version: WORKSPACE_SNAPSHOT_VERSION,
  panels: {
    'chart-0': { panelId: 'chart-0', appId: 'chart', props: { symbol: 'AAPL' } },
  },
  layoutJson: { root: { type: 'branch', data: [] } },
};

// ------------------------------------------------------------------
// saveSnapshot / loadSnapshot
// ------------------------------------------------------------------

describe('saveSnapshot + loadSnapshot', () => {
  it('round-trips a valid snapshot', () => {
    saveSnapshot(VALID_SNAPSHOT);
    const loaded = loadSnapshot();
    expect(loaded).toEqual(VALID_SNAPSHOT);
  });

  it('returns null when nothing is stored', () => {
    expect(loadSnapshot()).toBeNull();
  });

  it('returns null and does not throw when JSON is corrupt', () => {
    localStorage.setItem('terminal.workspace.v1', '{not valid json}');
    expect(loadSnapshot()).toBeNull();
  });

  it('returns null when stored version does not match CURRENT_VERSION', () => {
    const future: WorkspaceSnapshot = { ...VALID_SNAPSHOT, version: 9999 };
    localStorage.setItem('terminal.workspace.v1', JSON.stringify(future));
    expect(loadSnapshot()).toBeNull();
  });

  it('returns null when panels field is missing', () => {
    const broken = { version: WORKSPACE_SNAPSHOT_VERSION, layoutJson: null };
    localStorage.setItem('terminal.workspace.v1', JSON.stringify(broken));
    expect(loadSnapshot()).toBeNull();
  });

  it('returns null when panels field is null', () => {
    const broken = { version: WORKSPACE_SNAPSHOT_VERSION, panels: null, layoutJson: null };
    localStorage.setItem('terminal.workspace.v1', JSON.stringify(broken));
    expect(loadSnapshot()).toBeNull();
  });

  it('returns null when stored value is a JSON primitive', () => {
    localStorage.setItem('terminal.workspace.v1', '"just-a-string"');
    expect(loadSnapshot()).toBeNull();
  });

  it('returns null when localStorage.getItem throws', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (): never => {
          throw new Error('storage unavailable');
        },
        setItem: (): void => {
          /* no-op */
        },
        removeItem: (): void => {
          /* no-op */
        },
        clear: (): void => {
          /* no-op */
        },
      },
      writable: true,
      configurable: true,
    });
    expect(loadSnapshot()).toBeNull();
  });

  it('does not throw when localStorage.setItem throws', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (): null => null,
        setItem: (): never => {
          throw new Error('quota exceeded');
        },
        removeItem: (): void => {
          /* no-op */
        },
        clear: (): void => {
          /* no-op */
        },
      },
      writable: true,
      configurable: true,
    });
    expect(() => saveSnapshot(VALID_SNAPSHOT)).not.toThrow();
  });
});

// ------------------------------------------------------------------
// clearSnapshot
// ------------------------------------------------------------------

describe('clearSnapshot', () => {
  it('removes the stored snapshot', () => {
    saveSnapshot(VALID_SNAPSHOT);
    expect(loadSnapshot()).not.toBeNull();
    clearSnapshot();
    expect(loadSnapshot()).toBeNull();
  });

  it('does not throw when nothing is stored', () => {
    expect(() => clearSnapshot()).not.toThrow();
  });

  it('does not throw when localStorage.removeItem throws', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (): null => null,
        setItem: (): void => {
          /* no-op */
        },
        removeItem: (): never => {
          throw new Error('storage unavailable');
        },
        clear: (): void => {
          /* no-op */
        },
      },
      writable: true,
      configurable: true,
    });
    expect(() => clearSnapshot()).not.toThrow();
  });
});

// ------------------------------------------------------------------
// getPresetSlugFromUrl
// ------------------------------------------------------------------

describe('getPresetSlugFromUrl', () => {
  it('returns null when ?ws param is absent', () => {
    Object.defineProperty(globalThis, 'window', {
      value: { location: { search: '' } },
      writable: true,
      configurable: true,
    });
    expect(getPresetSlugFromUrl()).toBeNull();
  });

  it('returns the slug when ?ws=equities', () => {
    Object.defineProperty(globalThis, 'window', {
      value: { location: { search: '?ws=equities' } },
      writable: true,
      configurable: true,
    });
    expect(getPresetSlugFromUrl()).toBe('equities');
  });

  it('returns the slug when ?ws=filings-research', () => {
    Object.defineProperty(globalThis, 'window', {
      value: { location: { search: '?ws=filings-research&other=ignored' } },
      writable: true,
      configurable: true,
    });
    expect(getPresetSlugFromUrl()).toBe('filings-research');
  });

  it('returns null and does not throw when window.location is unavailable', () => {
    const origWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    expect(() => getPresetSlugFromUrl()).not.toThrow();
    expect(getPresetSlugFromUrl()).toBeNull();
    Object.defineProperty(globalThis, 'window', {
      value: origWindow,
      writable: true,
      configurable: true,
    });
  });
});

// ------------------------------------------------------------------
// buildPresetUrl
// ------------------------------------------------------------------

describe('buildPresetUrl', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'window', {
      value: { location: { href: 'http://localhost:5173/some/path?other=1' } },
      writable: true,
      configurable: true,
    });
  });

  it('sets only the ?ws param and strips other params', () => {
    const url = buildPresetUrl('macro');
    expect(url).toBe('http://localhost:5173/some/path?ws=macro');
  });

  it('produces a different URL per slug', () => {
    expect(buildPresetUrl('equities')).not.toBe(buildPresetUrl('macro'));
  });
});

// ------------------------------------------------------------------
// buildSnapshot
// ------------------------------------------------------------------

describe('buildSnapshot', () => {
  it('produces a snapshot with the current version', () => {
    const snap = buildSnapshot({});
    expect(snap.version).toBe(WORKSPACE_SNAPSHOT_VERSION);
  });

  it('sets layoutJson to null', () => {
    const snap = buildSnapshot({ 'p-0': { panelId: 'p-0', appId: 'chart', props: {} } });
    expect(snap.layoutJson).toBeNull();
  });

  it('includes the provided panels map', () => {
    const panels = { 'p-0': { panelId: 'p-0', appId: 'chart', props: { symbol: 'NVDA' } } };
    const snap = buildSnapshot(panels);
    expect(snap.panels).toEqual(panels);
  });

  it('round-trips via saveSnapshot + loadSnapshot', () => {
    const panels = { 'p-0': { panelId: 'p-0', appId: 'quote', props: { symbol: 'TSLA' } } };
    const snap = buildSnapshot(panels);
    saveSnapshot(snap);
    expect(loadSnapshot()).toEqual(snap);
  });
});

// ------------------------------------------------------------------
// Version constant sanity
// ------------------------------------------------------------------

describe('WORKSPACE_SNAPSHOT_VERSION', () => {
  it('is a positive integer', () => {
    expect(WORKSPACE_SNAPSHOT_VERSION).toBeGreaterThan(0);
    expect(Number.isInteger(WORKSPACE_SNAPSHOT_VERSION)).toBe(true);
  });

  // Regression guard: if the version constant changes, this test forces
  // a deliberate review of migration logic in migrate().
  it('is currently 1', () => {
    expect(WORKSPACE_SNAPSHOT_VERSION).toBe(1);
  });
});

// ------------------------------------------------------------------
// localStorage key isolation — verify save does not bleed across tests
// ------------------------------------------------------------------

describe('key isolation', () => {
  it('a save in one test does not affect the next', () => {
    // This test runs AFTER the round-trip tests above.
    // Because beforeEach replaces localStorage with a fresh stub,
    // loadSnapshot() must return null here.
    expect(loadSnapshot()).toBeNull();
  });

  it('spy on JSON.stringify to confirm snapshot is serialized', () => {
    const spy = vi.spyOn(JSON, 'stringify');
    saveSnapshot(VALID_SNAPSHOT);
    expect(spy).toHaveBeenCalledWith(VALID_SNAPSHOT);
    spy.mockRestore();
  });
});
