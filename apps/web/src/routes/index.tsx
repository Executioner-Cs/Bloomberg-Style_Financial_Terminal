/**
 * Terminal workspace route — the primary application view.
 *
 * Mount sequence (CLAUDE.md Part XII — workspace restore < 500ms):
 *   1. WorkspaceShell mounts dockview and fires onReady with the api.
 *   2. onReady checks for a persisted snapshot in localStorage.
 *   3. If a snapshot exists, restore it so panel layout survives reload.
 *   4. If no snapshot, check for a `?ws=<slug>` URL param (deep-link).
 *   5. Fall back to the default equities preset on first visit.
 *
 * The CommandPalette (Ctrl+K) overlay is rendered here so it has
 * access to the router scope while remaining above the workspace.
 */
import type { JSX } from 'react';
import type { DockviewApi } from 'dockview-react';

import { WorkspaceShell } from '@/workspace/WorkspaceShell';
import {
  loadSnapshot,
  getPresetSlugFromUrl,
  DEFAULT_PRESET_SLUG,
  switchToPreset,
} from '@/workspace';
import CommandPalette from '@/components/command-palette/CommandPalette';

/**
 * Called once dockview has mounted and handed back its imperative api.
 *
 * Priority:
 *   saved layout > URL preset param > default equities preset
 */
function handleWorkspaceReady(api: DockviewApi): void {
  // 1. Try persisted snapshot — layout from previous session.
  const snapshot = loadSnapshot();
  if (snapshot !== null && snapshot.layoutJson !== null) {
    try {
      // layoutJson is the opaque dockview layout blob saved by WorkspaceShell
      // on every layout change (layout-serializer.ts saveSnapshot).
      // Cast is safe — layoutJson is typed as LayoutJson (Record<string,unknown>)
      // which is structurally compatible with the dockview fromJSON parameter.
      // Double cast through unknown: LayoutJson is Record<string,unknown> which
      // does not structurally overlap with SerializedDockview. The value IS a
      // SerializedDockview — it was stored by WorkspaceShell on layout change.
      api.fromJSON(snapshot.layoutJson as unknown as Parameters<DockviewApi['fromJSON']>[0]);
      return;
    } catch (err) {
      console.warn('[workspace] Snapshot restore failed — applying default preset', err);
    }
  }

  // 2. Check for ?ws= deep-link preset slug.
  const urlSlug = getPresetSlugFromUrl();
  const slug = urlSlug ?? DEFAULT_PRESET_SLUG;
  switchToPreset(slug, api);
}

/**
 * Terminal workspace page — full-screen dockview shell with command palette overlay.
 */
export default function IndexPage(): JSX.Element {
  return (
    <div className="relative h-full w-full">
      <WorkspaceShell onReady={handleWorkspaceReady} />
      <CommandPalette />
    </div>
  );
}
