/**
 * Workspace API reference — module-level storage for the live DockviewApi.
 *
 * WorkspaceShell is rendered deep inside the route tree; CommandPalette and
 * keyboard-shortcut handlers live at the root layout. They cannot share the
 * api via React props without threading it through the entire tree.
 *
 * Why a module ref, not Zustand:
 *   DockviewApi is an imperative handle — not serializable, not observable,
 *   and carries no value as a reactive signal. Storing it in Zustand would
 *   add subscriber overhead with zero benefit. A module-level ref is the
 *   correct abstraction: written once, read anywhere, cleared on unmount.
 *
 * Lifecycle contract:
 *   - WorkspaceShell calls `setWorkspaceApi(api)` in its `onReady` handler.
 *   - WorkspaceShell calls `clearWorkspaceApi()` in its cleanup `useEffect`.
 *   - All callers must guard: `const api = getWorkspaceApi(); if (!api) return;`
 *
 * Plan ref: B14, D6.
 */

import type { DockviewApi } from 'dockview-react';
import type { PanelInstance } from './stores/workspace.store';
import { useWorkspaceStore } from './stores/workspace.store';
import { DOCKVIEW_COMPONENT_NAME } from './constants';

let _api: DockviewApi | null = null;

/** Component key used in DockviewReact — sourced from constants.ts. */
const DOCKVIEW_COMPONENT = DOCKVIEW_COMPONENT_NAME;

// ------------------------------------------------------------------
// API ref management
// ------------------------------------------------------------------

/**
 * Store the live DockviewApi instance.
 * Called once by WorkspaceShell in its `onReady` handler.
 */
export function setWorkspaceApi(api: DockviewApi): void {
  _api = api;
}

/**
 * Retrieve the live DockviewApi, or `null` if the shell is not mounted.
 * Callers must guard the null case — the palette may open before the
 * workspace route is active.
 */
export function getWorkspaceApi(): DockviewApi | null {
  return _api;
}

/**
 * Clear the stored ref.
 * Called by WorkspaceShell's cleanup effect so stale pointers from a
 * prior mount do not persist after the shell unmounts (e.g. route change).
 */
export function clearWorkspaceApi(): void {
  _api = null;
}

// ------------------------------------------------------------------
// Workspace actions
// ------------------------------------------------------------------

/**
 * Add a new panel instance to the live workspace.
 *
 * Generates a unique panel ID (timestamp suffix prevents collisions when
 * the same appId is opened multiple times), registers the instance in the
 * workspace store, then calls `api.addPanel` so dockview renders the tile.
 *
 * Returns the generated `panelId`, or `null` when the workspace API is not
 * mounted (palette invoked before the workspace route is active).
 *
 * Used by command palette "Open Panel" actions (Stage C — panel apps must
 * be registered before these actions surface in the palette).
 *
 * @param appId  Registry key of the panel type (e.g. 'chart', 'quote').
 * @param props  Initial serialised props for the panel instance.
 */
export function addPanelToWorkspace(
  appId: string,
  props: Record<string, unknown> = {},
): string | null {
  const api = _api;
  if (!api) return null;

  // Timestamp suffix — unique within a session; stable enough for layout
  // serialisation (panel IDs are local to localStorage, not shared).
  const panelId = `${appId}-${Date.now()}`;

  const instance: PanelInstance = { panelId, appId, props };
  useWorkspaceStore.getState().addPanel(instance);

  api.addPanel({
    id: panelId,
    component: DOCKVIEW_COMPONENT,
    params: { panelId, appId },
    title: appId.charAt(0).toUpperCase() + appId.slice(1),
  });

  return panelId;
}
