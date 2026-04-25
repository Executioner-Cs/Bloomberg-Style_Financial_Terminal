/**
 * PanelHost — renders a single dockview tile's body.
 *
 * Separated from WorkspaceShell so it can be unit-tested without
 * mounting the full dockview instance. dockview hands us `params`
 * (our {@link WorkspacePanelParams}) and an `api` for per-panel
 * operations; we resolve the panel instance from the workspace store,
 * the `PanelApp` from the registry, then hand the app's `Component`
 * the uniform {@link PanelProps} contract.
 *
 * The two miss-paths (registry miss, store miss) render non-throwing
 * placeholders so the rest of the workspace keeps working when a
 * saved layout references a renamed/removed appId or when the store
 * is mid-rehydration.
 *
 * Plan ref: B11, D6.
 */

import { useCallback } from 'react';
import type { IDockviewPanelProps } from 'dockview-react';

import { getPanelApp } from './panel-registry';
import { useWorkspaceStore } from './stores/workspace.store';
import type { PanelProps } from './types';

/**
 * Dockview params written onto every panel at `api.addPanel` time.
 *
 * These are the only two keys dockview persists into its layout JSON
 * on our behalf. Every other piece of per-panel state lives in
 * `workspace.store.panels[panelId].props` and is serialised separately
 * by the panel app's own `serialize` function (layout serializer
 * lands in B12).
 */
export interface WorkspacePanelParams {
  /** Workspace-store key identifying this panel instance. */
  panelId: string;
  /** Registry key identifying the panel type (e.g. 'chart', 'quote'). */
  appId: string;
}

export function PanelHost(props: IDockviewPanelProps<WorkspacePanelParams>): JSX.Element {
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
    return (
      <div
        role="alert"
        data-testid="panel-host-registry-miss"
        className="flex h-full w-full items-center justify-center p-4 text-sm text-[#9CA3AF]"
      >
        Unknown panel app &apos;{appId}&apos;. This panel type was removed or renamed.
      </div>
    );
  }

  if (!instance) {
    return <div className="h-full w-full" aria-busy="true" data-testid="panel-host-store-miss" />;
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
