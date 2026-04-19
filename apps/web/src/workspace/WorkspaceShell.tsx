/**
 * WorkspaceShell — dockview-backed multi-panel container.
 *
 * The shell owns the dockview instance and bridges three stable pieces:
 *
 *   1. The workspace store  — source of truth for panel instances and
 *      their per-instance props. Serialisable; drives (de)hydration.
 *   2. The panel registry   — map from `appId` (e.g. 'chart') to the
 *      `PanelApp` record that knows how to render + serialise an instance.
 *   3. The dockview API     — imperative layout manipulation (add,
 *      remove, move, focus, restore-from-JSON). Exposed to consumers
 *      via the `onReady` callback so presets (B13) and the command
 *      palette (B14) can act on layout without going through React.
 *
 * Why dockview params carry only `panelId`/`appId` (not the full props):
 * dockview serialises its `params` object into its own layout JSON.
 * Keeping only the two string keys there means workspace.store remains
 * the single source of truth for props; the saved dockview JSON stays
 * compact and does not double-store prop data that may contain
 * non-JSON-safe values before the panel's own `serialize` runs.
 *
 * Plan ref: B11, D2, D6.
 */

import { useCallback, useMemo } from 'react';
import {
  DockviewReact,
  type DockviewApi,
  type DockviewReadyEvent,
  type IDockviewPanelProps,
} from 'dockview-react';

import { getPanelApp } from './panel-registry';
import { useWorkspaceStore } from './stores/workspace.store';
import type { PanelProps } from './types';

import 'dockview-core/dist/styles/dockview.css';

/**
 * Dockview params written onto every panel at `api.addPanel` time.
 *
 * These are the only two keys dockview persists into its layout JSON
 * on our behalf. Every other piece of per-panel state lives in
 * `workspace.store.panels[panelId].props` and is serialised separately
 * by the panel app's own `serialize` function (layout serializer lands
 * in B12).
 */
export interface WorkspacePanelParams {
  /** Workspace-store key identifying this panel instance. */
  panelId: string;
  /** Registry key identifying the panel type (e.g. 'chart', 'quote'). */
  appId: string;
}

export interface WorkspaceShellProps {
  /**
   * Called once dockview has mounted and exposed its imperative API.
   * Consumers use the api to add initial panels, wire keyboard
   * shortcuts, or restore a serialised layout.
   *
   * Intentionally not wrapped in a ref forward — consumers that need
   * the api across renders should stash it themselves.
   */
  onReady?: (api: DockviewApi) => void;
}

/**
 * Renders a single dockview tile's body.
 *
 * dockview hands us `params` (our {@link WorkspacePanelParams}) and an
 * `api` for per-panel operations. We resolve the panel instance from
 * the workspace store, the `PanelApp` from the registry, then hand the
 * app's `Component` the uniform {@link PanelProps} contract.
 *
 * Written as a plain function component (not `memo`d) because each
 * dockview tile already has its own React root and is mounted/unmounted
 * by dockview — memoisation here would be dead weight.
 */
function PanelHost(props: IDockviewPanelProps<WorkspacePanelParams>): JSX.Element {
  const { api, params } = props;
  const { panelId, appId } = params;

  // Selector subscription — re-renders this tile only when *this*
  // panel's record changes, not when an unrelated panel updates.
  // (CLAUDE.md Part XII — "panel data discipline".)
  const instance = useWorkspaceStore((state) => state.panels[panelId]);
  const updatePanelProps = useWorkspaceStore((state) => state.updatePanelProps);
  const removePanel = useWorkspaceStore((state) => state.removePanel);

  const app = getPanelApp(appId);

  const handleClose = useCallback((): void => {
    // Remove from dockview first so the tile unmounts, then from the
    // store so a later re-add with the same panelId is not blocked.
    api.close();
    removePanel(panelId);
  }, [api, panelId, removePanel]);

  const handleUpdateProps = useCallback(
    (next: Partial<Record<string, unknown>>): void => {
      updatePanelProps(panelId, next);
    },
    [panelId, updatePanelProps],
  );

  if (!app) {
    // Registry miss — panel id survived a rename or removal in the
    // saved layout. Render a non-throwing placeholder so the rest of
    // the workspace keeps working; the layout serializer (B12) will
    // prune orphans on next save.
    return (
      <div
        role="alert"
        className="flex h-full w-full items-center justify-center p-4 text-sm text-[#9CA3AF]"
      >
        Unknown panel app &apos;{appId}&apos;. This panel type was removed or renamed.
      </div>
    );
  }

  if (!instance) {
    // Store miss — the dockview tile exists but the store entry was
    // reset (hot-reload, reset button). Defer render; a parent effect
    // should either re-hydrate or close the tile.
    return <div className="h-full w-full" aria-busy="true" />;
  }

  const panelProps: PanelProps<unknown> = {
    panelId,
    isActive: api.isActive,
    onClose: handleClose,
    props: instance.props,
    updateProps: handleUpdateProps,
  };

  const Component = app.Component;
  return <Component {...panelProps} />;
}

/**
 * WorkspaceShell — mount DockviewReact with a single component entry
 * (`workspace-panel`) that routes to whichever `PanelApp` owns the
 * tile. See {@link PanelHost} for how the route resolves.
 *
 * The shell intentionally ships with no initial panels — presets (B13)
 * and the command palette (B14) decide what to open, and the layout
 * serializer (B12) will restore a saved layout on mount.
 */
export function WorkspaceShell({ onReady }: WorkspaceShellProps): JSX.Element {
  // Stable component map — dockview re-mounts if the identity changes.
  const components = useMemo(
    () => ({
      'workspace-panel': PanelHost,
    }),
    [],
  );

  const handleReady = useCallback(
    (event: DockviewReadyEvent): void => {
      onReady?.(event.api);
    },
    [onReady],
  );

  return (
    <div className="dockview-theme-dark h-full w-full bg-[#050505]">
      <DockviewReact components={components} onReady={handleReady} />
    </div>
  );
}
