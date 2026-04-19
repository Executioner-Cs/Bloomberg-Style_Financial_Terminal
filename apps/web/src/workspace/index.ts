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
export {
  WorkspaceShell,
  type WorkspaceShellProps,
  type WorkspacePanelParams,
} from './WorkspaceShell';
