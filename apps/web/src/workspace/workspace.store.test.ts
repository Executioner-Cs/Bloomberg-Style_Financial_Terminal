/**
 * Workspace store unit tests.
 *
 * Tests addPanel, removePanel, updatePanelProps, setLayoutJson, hydrate,
 * reset against the Zustand store. Each test starts from a fresh store
 * state via reset() to prevent inter-test bleed.
 *
 * Plan ref: B15.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { useWorkspaceStore } from './stores/workspace.store';
import type { PanelInstance, LayoutJson } from './stores/workspace.store';

// Reset store state before every test so tests are independent.
beforeEach(() => {
  useWorkspaceStore.getState().reset();
});

// ------------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------------

function makePanel(overrides: Partial<PanelInstance> = {}): PanelInstance {
  return {
    panelId: 'chart-0',
    appId: 'chart',
    props: { symbol: 'AAPL' },
    ...overrides,
  };
}

const SAMPLE_LAYOUT: LayoutJson = {
  root: { type: 'branch', data: [{ type: 'leaf', activeView: 'chart-0', views: ['chart-0'] }] },
};

// ------------------------------------------------------------------
// Initial state
// ------------------------------------------------------------------

describe('initial state', () => {
  it('panels map is empty', () => {
    expect(useWorkspaceStore.getState().panels).toEqual({});
  });

  it('layoutJson is null', () => {
    expect(useWorkspaceStore.getState().layoutJson).toBeNull();
  });
});

// ------------------------------------------------------------------
// addPanel
// ------------------------------------------------------------------

describe('addPanel', () => {
  it('inserts a panel instance by panelId', () => {
    const panel = makePanel();
    useWorkspaceStore.getState().addPanel(panel);
    expect(useWorkspaceStore.getState().panels['chart-0']).toEqual(panel);
  });

  it('does not mutate other existing panels', () => {
    const a = makePanel({ panelId: 'a', appId: 'chart' });
    const b = makePanel({ panelId: 'b', appId: 'quote' });
    useWorkspaceStore.getState().addPanel(a);
    useWorkspaceStore.getState().addPanel(b);
    const { panels } = useWorkspaceStore.getState();
    expect(panels['a']).toEqual(a);
    expect(panels['b']).toEqual(b);
    expect(Object.keys(panels)).toHaveLength(2);
  });

  it('silently overwrites an existing panelId', () => {
    const orig = makePanel({ props: { symbol: 'AAPL' } });
    const updated = makePanel({ props: { symbol: 'NVDA' } });
    useWorkspaceStore.getState().addPanel(orig);
    useWorkspaceStore.getState().addPanel(updated);
    expect(useWorkspaceStore.getState().panels['chart-0']?.props).toEqual({ symbol: 'NVDA' });
  });
});

// ------------------------------------------------------------------
// removePanel
// ------------------------------------------------------------------

describe('removePanel', () => {
  it('removes an existing panel', () => {
    useWorkspaceStore.getState().addPanel(makePanel());
    useWorkspaceStore.getState().removePanel('chart-0');
    expect(useWorkspaceStore.getState().panels['chart-0']).toBeUndefined();
  });

  it('is a no-op when panelId does not exist', () => {
    useWorkspaceStore.getState().addPanel(makePanel({ panelId: 'a' }));
    useWorkspaceStore.getState().removePanel('does-not-exist');
    expect(Object.keys(useWorkspaceStore.getState().panels)).toHaveLength(1);
  });

  it('does not remove sibling panels', () => {
    useWorkspaceStore.getState().addPanel(makePanel({ panelId: 'a' }));
    useWorkspaceStore.getState().addPanel(makePanel({ panelId: 'b' }));
    useWorkspaceStore.getState().removePanel('a');
    expect(useWorkspaceStore.getState().panels['b']).toBeDefined();
  });
});

// ------------------------------------------------------------------
// updatePanelProps
// ------------------------------------------------------------------

describe('updatePanelProps', () => {
  it('merges new props into existing props', () => {
    const panel = makePanel({ props: { symbol: 'AAPL', timeframe: '1D' } });
    useWorkspaceStore.getState().addPanel(panel);
    useWorkspaceStore.getState().updatePanelProps('chart-0', { symbol: 'NVDA' });
    expect(useWorkspaceStore.getState().panels['chart-0']?.props).toEqual({
      symbol: 'NVDA',
      timeframe: '1D',
    });
  });

  it('is a no-op when panelId does not exist', () => {
    const before = { ...useWorkspaceStore.getState().panels };
    useWorkspaceStore.getState().updatePanelProps('ghost', { symbol: 'TSLA' });
    expect(useWorkspaceStore.getState().panels).toEqual(before);
  });

  it('does not mutate other panels', () => {
    useWorkspaceStore.getState().addPanel(makePanel({ panelId: 'a', props: { symbol: 'AAPL' } }));
    useWorkspaceStore.getState().addPanel(makePanel({ panelId: 'b', props: { symbol: 'MSFT' } }));
    useWorkspaceStore.getState().updatePanelProps('a', { symbol: 'NVDA' });
    expect(useWorkspaceStore.getState().panels['b']?.props).toEqual({ symbol: 'MSFT' });
  });

  it('adds new prop keys not present in existing props', () => {
    useWorkspaceStore.getState().addPanel(makePanel({ props: { symbol: 'AAPL' } }));
    useWorkspaceStore.getState().updatePanelProps('chart-0', { newKey: 'value' });
    expect(useWorkspaceStore.getState().panels['chart-0']?.props).toMatchObject({
      symbol: 'AAPL',
      newKey: 'value',
    });
  });
});

// ------------------------------------------------------------------
// setLayoutJson
// ------------------------------------------------------------------

describe('setLayoutJson', () => {
  it('stores the layout JSON', () => {
    useWorkspaceStore.getState().setLayoutJson(SAMPLE_LAYOUT);
    expect(useWorkspaceStore.getState().layoutJson).toEqual(SAMPLE_LAYOUT);
  });

  it('accepts null to clear the layout', () => {
    useWorkspaceStore.getState().setLayoutJson(SAMPLE_LAYOUT);
    useWorkspaceStore.getState().setLayoutJson(null);
    expect(useWorkspaceStore.getState().layoutJson).toBeNull();
  });
});

// ------------------------------------------------------------------
// hydrate
// ------------------------------------------------------------------

describe('hydrate', () => {
  it('replaces the entire panels map', () => {
    useWorkspaceStore.getState().addPanel(makePanel({ panelId: 'old' }));
    const newPanels = {
      'new-a': makePanel({ panelId: 'new-a' }),
      'new-b': makePanel({ panelId: 'new-b', appId: 'quote' }),
    };
    useWorkspaceStore.getState().hydrate({ panels: newPanels, layoutJson: SAMPLE_LAYOUT });
    const { panels, layoutJson } = useWorkspaceStore.getState();
    expect(panels).toEqual(newPanels);
    expect(panels['old']).toBeUndefined();
    expect(layoutJson).toEqual(SAMPLE_LAYOUT);
  });

  it('accepts a null layoutJson', () => {
    useWorkspaceStore.getState().hydrate({ panels: {}, layoutJson: null });
    expect(useWorkspaceStore.getState().layoutJson).toBeNull();
  });
});

// ------------------------------------------------------------------
// reset
// ------------------------------------------------------------------

describe('reset', () => {
  it('empties panels and clears layoutJson', () => {
    useWorkspaceStore.getState().addPanel(makePanel());
    useWorkspaceStore.getState().setLayoutJson(SAMPLE_LAYOUT);
    useWorkspaceStore.getState().reset();
    expect(useWorkspaceStore.getState().panels).toEqual({});
    expect(useWorkspaceStore.getState().layoutJson).toBeNull();
  });

  it('is safe to call on an already-empty store', () => {
    expect(() => useWorkspaceStore.getState().reset()).not.toThrow();
  });
});

// ------------------------------------------------------------------
// Immutability — store mutations must produce new object references
// ------------------------------------------------------------------

describe('immutability', () => {
  it('addPanel produces a new panels object', () => {
    const before = useWorkspaceStore.getState().panels;
    useWorkspaceStore.getState().addPanel(makePanel());
    const after = useWorkspaceStore.getState().panels;
    expect(after).not.toBe(before);
  });

  it('removePanel produces a new panels object', () => {
    useWorkspaceStore.getState().addPanel(makePanel());
    const before = useWorkspaceStore.getState().panels;
    useWorkspaceStore.getState().removePanel('chart-0');
    const after = useWorkspaceStore.getState().panels;
    expect(after).not.toBe(before);
  });

  it('updatePanelProps produces a new panels object and new panel record', () => {
    useWorkspaceStore.getState().addPanel(makePanel());
    const beforePanels = useWorkspaceStore.getState().panels;
    const beforePanel = useWorkspaceStore.getState().panels['chart-0'];
    useWorkspaceStore.getState().updatePanelProps('chart-0', { symbol: 'GOOG' });
    const afterPanels = useWorkspaceStore.getState().panels;
    const afterPanel = useWorkspaceStore.getState().panels['chart-0'];
    expect(afterPanels).not.toBe(beforePanels);
    expect(afterPanel).not.toBe(beforePanel);
  });
});
