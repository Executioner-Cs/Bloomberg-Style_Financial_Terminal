/**
 * Unit tests for PanelHost — the per-tile body renderer.
 *
 * Why these tests: PanelHost is the handoff from dockview's tile
 * contract into our registry/store/PanelApp contract. Its three
 * branches (registry hit, registry miss, store miss) are load-bearing
 * for every saved-layout restore — a bug here manifests as blank
 * tiles far from the call site.
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { Activity } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { IDockviewPanelProps } from 'dockview-react';

import { PanelHost, type WorkspacePanelParams } from './panel-host';
import { registerPanelApp, __resetPanelRegistryForTests } from './panel-registry';
import { useWorkspaceStore } from './stores/workspace.store';
import type { PanelApp, PanelProps } from './types';

const ActivityIcon = Activity satisfies LucideIcon;

/**
 * Build a minimal fake dockview panel `api` surface — only the bits
 * PanelHost actually reads. Using `unknown` + cast keeps us from
 * re-declaring the full dockview-core DockviewPanelApi (~50 fields)
 * in test code; the cast is safe because the production code only
 * ever touches `api.close` and `api.isActive`.
 */
interface FakePanelApi {
  close: ReturnType<typeof vi.fn>;
  isActive: boolean;
}

function makePanelProps(
  panelId: string,
  appId: string,
  opts: { isActive?: boolean } = {},
): { props: IDockviewPanelProps<WorkspacePanelParams>; api: FakePanelApi } {
  const api: FakePanelApi = {
    close: vi.fn(),
    isActive: opts.isActive ?? false,
  };
  // Cast: PanelHost only uses the two fields above; the rest of the
  // dockview api surface is unused at this layer, so stubbing it out
  // keeps the test focused.
  const props = {
    api,
    params: { panelId, appId },
  } as unknown as IDockviewPanelProps<WorkspacePanelParams>;
  return { props, api };
}

interface QuoteProps {
  symbol: string;
}

/** Typed alias for the Component spy — keeps `.mock.calls[i][0]` typed. */
type QuoteSpy = MockedFunction<(received: PanelProps<QuoteProps>) => void>;

/**
 * Build a PanelApp<QuoteProps> whose `Component` forwards its received
 * PanelProps to a spy — so tests can assert the exact contract handed
 * to panel code.
 */
function makeQuoteApp(componentSpy: QuoteSpy): PanelApp<QuoteProps> {
  return {
    id: 'quote',
    displayName: 'Quote',
    icon: ActivityIcon,
    defaultProps: { symbol: 'AAPL' },
    linkable: true,
    serialize: (p): string => JSON.stringify(p),
    deserialize: (raw): QuoteProps => JSON.parse(raw) as QuoteProps,
    Component: (panelProps): JSX.Element => {
      componentSpy(panelProps);
      return <div data-testid="quote-body">{panelProps.props.symbol}</div>;
    },
  };
}

/** Read the first argument of the first call; asserts the spy was used. */
function firstCallArg(spy: QuoteSpy): PanelProps<QuoteProps> {
  const call = spy.mock.calls[0];
  if (!call) throw new Error('Component spy was not called');
  return call[0];
}

describe('PanelHost', () => {
  beforeEach(() => {
    __resetPanelRegistryForTests();
    useWorkspaceStore.getState().reset();
  });

  it('renders the registered panel Component with the full PanelProps contract', () => {
    const spy: QuoteSpy = vi.fn();
    registerPanelApp(makeQuoteApp(spy));
    useWorkspaceStore.getState().addPanel({
      panelId: 'p-1',
      appId: 'quote',
      props: { symbol: 'NVDA' },
    });

    const { props, api } = makePanelProps('p-1', 'quote', { isActive: true });
    render(<PanelHost {...props} />);

    expect(screen.getByTestId('quote-body')).toHaveTextContent('NVDA');
    expect(spy).toHaveBeenCalledTimes(1);
    const received = firstCallArg(spy);
    expect(received.panelId).toBe('p-1');
    expect(received.isActive).toBe(true);
    expect(received.props).toEqual({ symbol: 'NVDA' });
    expect(typeof received.onClose).toBe('function');
    expect(typeof received.updateProps).toBe('function');
    expect(api.close).not.toHaveBeenCalled();
  });

  it('renders a registry-miss alert when the appId is unknown', () => {
    useWorkspaceStore.getState().addPanel({
      panelId: 'p-1',
      appId: 'does-not-exist',
      props: {},
    });
    const { props } = makePanelProps('p-1', 'does-not-exist');
    render(<PanelHost {...props} />);

    const alert = screen.getByTestId('panel-host-registry-miss');
    expect(alert).toHaveAttribute('role', 'alert');
    expect(alert.textContent).toContain("'does-not-exist'");
  });

  it('renders a store-miss placeholder when the panelId is not in the workspace', () => {
    const spy: QuoteSpy = vi.fn();
    registerPanelApp(makeQuoteApp(spy));
    // Deliberately do NOT call addPanel — the registry hits but the
    // store is empty (mid-rehydration scenario).
    const { props } = makePanelProps('missing-panel', 'quote');
    render(<PanelHost {...props} />);

    const placeholder = screen.getByTestId('panel-host-store-miss');
    expect(placeholder).toHaveAttribute('aria-busy', 'true');
  });

  it('onClose removes the panel from dockview then from the store', () => {
    const spy: QuoteSpy = vi.fn();
    registerPanelApp(makeQuoteApp(spy));
    useWorkspaceStore.getState().addPanel({
      panelId: 'p-1',
      appId: 'quote',
      props: { symbol: 'NVDA' },
    });

    const { props, api } = makePanelProps('p-1', 'quote');
    render(<PanelHost {...props} />);
    const received = firstCallArg(spy);

    act(() => {
      received.onClose();
    });

    expect(api.close).toHaveBeenCalledTimes(1);
    expect(useWorkspaceStore.getState().panels['p-1']).toBeUndefined();
  });

  it('updateProps merge-patches the workspace store entry', () => {
    const spy: QuoteSpy = vi.fn();
    registerPanelApp(makeQuoteApp(spy));
    useWorkspaceStore.getState().addPanel({
      panelId: 'p-1',
      appId: 'quote',
      props: { symbol: 'NVDA' },
    });

    const { props } = makePanelProps('p-1', 'quote');
    render(<PanelHost {...props} />);
    const received = firstCallArg(spy);

    act(() => {
      received.updateProps({ symbol: 'AAPL' });
    });

    expect(useWorkspaceStore.getState().panels['p-1']?.props).toEqual({
      symbol: 'AAPL',
    });
    expect(screen.getByTestId('quote-body')).toHaveTextContent('AAPL');
  });
});
