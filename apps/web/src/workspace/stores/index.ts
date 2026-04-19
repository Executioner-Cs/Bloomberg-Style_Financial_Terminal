/**
 * Barrel re-export for workspace Zustand stores.
 *
 * Consumers should import from '@/workspace/stores', never reach into
 * individual store files. This keeps the public surface stable if a
 * store is renamed or split later.
 */

export {
  useTerminalContextStore,
  type TerminalContextState,
  type TerminalTheme,
} from './terminal-context.store';
export {
  useWorkspaceStore,
  type WorkspaceState,
  type PanelInstance,
  type LayoutJson,
} from './workspace.store';
