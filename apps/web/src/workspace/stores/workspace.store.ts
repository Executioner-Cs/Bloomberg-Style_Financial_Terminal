/**
 * Workspace store — panel instances and layout JSON.
 *
 * Holds the runtime state the WorkspaceShell needs to (re)build a
 * dockview layout: which panel instances are open, their per-panel
 * props, and the opaque dockview-serialised layout tree.
 *
 * Why split from terminal-context: selector granularity. Panels only
 * need `activeSymbol` re-renders (from terminal-context); the layout
 * tree only changes when panels are added/removed or groups resized.
 * Keeping them separate prevents either change from re-rendering the
 * other store's subscribers.
 *
 * Panel registry types (PanelApp, PanelInstance) land in B10; for now
 * this store uses a minimal local PanelInstance shape to unblock B11.
 *
 * Plan ref: D2, D3.
 */

import { create } from 'zustand';

/** Opaque serialised dockview layout tree. Shape owned by dockview-react. */
export type LayoutJson = Record<string, unknown>;

export interface PanelInstance {
  /** Unique instance id — stable across layout (de)serialisation. */
  panelId: string;
  /** Registry key for the panel app (e.g. 'quote', 'chart'). */
  appId: string;
  /** Serialised per-panel props (shape owned by the panel's app.ts). */
  props: Record<string, unknown>;
}

export interface WorkspaceState {
  panels: Record<string, PanelInstance>;
  layoutJson: LayoutJson | null;
  addPanel: (panel: PanelInstance) => void;
  removePanel: (panelId: string) => void;
  updatePanelProps: (panelId: string, props: Record<string, unknown>) => void;
  setLayoutJson: (layout: LayoutJson | null) => void;
  /** Hydrate the store from a serialised snapshot (layout + panels). */
  hydrate: (snapshot: {
    panels: Record<string, PanelInstance>;
    layoutJson: LayoutJson | null;
  }) => void;
  /** Reset to an empty workspace. Used when layout JSON is corrupt. */
  reset: () => void;
}

const EMPTY_STATE = {
  panels: {} as Record<string, PanelInstance>,
  layoutJson: null,
} satisfies { panels: Record<string, PanelInstance>; layoutJson: LayoutJson | null };

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  ...EMPTY_STATE,
  addPanel: (panel): void =>
    set(
      (state): Pick<WorkspaceState, 'panels'> => ({
        panels: { ...state.panels, [panel.panelId]: panel },
      }),
    ),
  removePanel: (panelId): void =>
    set((state): Partial<WorkspaceState> => {
      if (!(panelId in state.panels)) return state;
      const next = { ...state.panels };
      delete next[panelId];
      return { panels: next };
    }),
  updatePanelProps: (panelId, props): void =>
    set((state): Partial<WorkspaceState> => {
      const existing = state.panels[panelId];
      if (!existing) return state;
      return {
        panels: {
          ...state.panels,
          [panelId]: { ...existing, props: { ...existing.props, ...props } },
        },
      };
    }),
  setLayoutJson: (layout): void => set({ layoutJson: layout }),
  hydrate: ({ panels, layoutJson }): void => set({ panels, layoutJson }),
  reset: (): void => set(EMPTY_STATE),
}));
