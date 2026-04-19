/**
 * WorkspaceShell — dockview-backed multi-panel container.
 *
 * The shell owns the dockview instance and bridges three stable
 * pieces:
 *
 *   1. The workspace store  — source of truth for panel instances
 *      and their per-instance props. Serialisable; drives
 *      (de)hydration.
 *   2. The panel registry   — map from `appId` (e.g. 'chart') to the
 *      `PanelApp` record that knows how to render + serialise an
 *      instance.
 *   3. The dockview API     — imperative layout manipulation (add,
 *      remove, move, focus, restore-from-JSON). Exposed to consumers
 *      via the `onReady` callback so presets (B13) and the command
 *      palette (B14) can act on layout without going through React.
 *
 * Why dockview params carry only `panelId`/`appId` (not the full
 * props): dockview serialises its `params` object into its own
 * layout JSON. Keeping only the two string keys there means
 * workspace.store remains the single source of truth for props; the
 * saved dockview JSON stays compact and does not double-store prop
 * data that may contain non-JSON-safe values before the panel's own
 * `serialize` runs.
 *
 * Plan ref: B11, D2, D6.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { DockviewReact, type DockviewApi, type DockviewReadyEvent } from 'dockview-react';

import { PanelHost } from './panel-host';
import { setWorkspaceApi, clearWorkspaceApi } from './workspace-api-ref';

import 'dockview-react/dist/styles/dockview.css';

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
 * WorkspaceShell — mount DockviewReact with a single component entry
 * (`workspace-panel`) that routes to whichever `PanelApp` owns the
 * tile via {@link PanelHost}.
 *
 * The shell intentionally ships with no initial panels — presets
 * (B13) and the command palette (B14) decide what to open, and the
 * layout serializer (B12) will restore a saved layout on mount.
 */
export function WorkspaceShell({ onReady }: WorkspaceShellProps): JSX.Element {
  // Stable component map — dockview re-mounts if the identity changes.
  const components = useMemo(
    () => ({
      'workspace-panel': PanelHost,
    }),
    [],
  );

  // Track the api so the cleanup effect can clear the module ref without
  // a stale closure (the ref is set synchronously in handleReady below).
  const apiRef = useRef<DockviewApi | null>(null);

  const handleReady = useCallback(
    (event: DockviewReadyEvent): void => {
      // Publish the api to the module-level ref so non-React callers
      // (command palette, keyboard shortcuts) can issue layout commands
      // without going through React props.
      setWorkspaceApi(event.api);
      apiRef.current = event.api;
      onReady?.(event.api);
    },
    [onReady],
  );

  // Clear the module ref when the shell unmounts (route change or test
  // teardown) so stale pointers do not persist across mounts.
  useEffect(() => {
    return (): void => {
      clearWorkspaceApi();
      apiRef.current = null;
    };
  }, []);

  return (
    <div className="dockview-theme-dark h-full w-full bg-[#050505]">
      <DockviewReact components={components} onReady={handleReady} />
    </div>
  );
}
