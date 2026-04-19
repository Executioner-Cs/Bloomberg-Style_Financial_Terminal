/**
 * Workspace public barrel — stores, registry, and PanelApp types.
 *
 * Consumers should import from '@/workspace' rather than reaching into
 * individual files. This keeps refactor cost bounded if a module splits.
 */

export {
  useTerminalContextStore,
  useWorkspaceStore,
  type TerminalContextState,
  type TerminalTheme,
  type WorkspaceState,
  type PanelInstance,
  type LayoutJson,
} from './stores';
export type { PanelApp, PanelProps } from './types';
export { registerPanelApp, getPanelApp, listPanelApps } from './panel-registry';
export { WorkspaceShell, type WorkspaceShellProps } from './WorkspaceShell';
export { PanelHost, type WorkspacePanelParams } from './panel-host';
export {
  saveSnapshot,
  loadSnapshot,
  clearSnapshot,
  getPresetSlugFromUrl,
  buildPresetUrl,
  buildSnapshot,
  WORKSPACE_SNAPSHOT_VERSION,
  type WorkspaceSnapshot,
} from './layout-serializer';
export {
  listPresets,
  getPreset,
  switchToPreset,
  DEFAULT_PRESET_SLUG,
  type LayoutPreset,
} from './default-layouts';
