/**
 * Unit tests for panel-registry: registration invariants + lookup.
 *
 * Why these tests: the registry is a module-scoped singleton; silent
 * overwrites or missing-id blowups would manifest as confusing UI bugs
 * far from the registration call site. These tests pin the contract.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Activity } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { PanelApp } from './types';
import {
  registerPanelApp,
  getPanelApp,
  listPanelApps,
  __resetPanelRegistryForTests,
} from './panel-registry';

interface FakeProps {
  symbol: string;
}

// Activity satisfies the LucideIcon shape; the cast is safe because lucide
// guarantees all icons share an identical FC<LucideProps> signature.
const ActivityIcon = Activity satisfies LucideIcon;

function makeApp(id: string): PanelApp<FakeProps> {
  return {
    id,
    displayName: `Fake ${id}`,
    icon: ActivityIcon,
    defaultProps: { symbol: 'AAPL' },
    linkable: true,
    serialize: (props): string => JSON.stringify(props),
    deserialize: (raw): FakeProps => JSON.parse(raw) as FakeProps,
    // Minimal FC stub — these tests never render.
    Component: (): null => null,
  };
}

beforeEach(() => {
  __resetPanelRegistryForTests();
});

describe('panel-registry', () => {
  it('registers and retrieves a panel app by id', () => {
    const app = makeApp('quote');
    registerPanelApp(app);

    const retrieved = getPanelApp<FakeProps>('quote');
    expect(retrieved).toBe(app);
    expect(retrieved?.defaultProps.symbol).toBe('AAPL');
  });

  it('returns undefined for an unknown id', () => {
    expect(getPanelApp('nonexistent')).toBeUndefined();
  });

  it('throws when the same id is registered twice', () => {
    registerPanelApp(makeApp('chart'));
    expect(() => registerPanelApp(makeApp('chart'))).toThrowError(/already registered/i);
  });

  it('listPanelApps returns all registered apps', () => {
    registerPanelApp(makeApp('quote'));
    registerPanelApp(makeApp('chart'));
    registerPanelApp(makeApp('news'));

    const ids = listPanelApps()
      .map((a) => a.id)
      .sort();
    expect(ids).toEqual(['chart', 'news', 'quote']);
  });

  it('listPanelApps returns an empty list when nothing is registered', () => {
    expect(listPanelApps()).toEqual([]);
  });
});
