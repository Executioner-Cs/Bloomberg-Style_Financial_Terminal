/**
 * Terminal context store — global UI state shared across panels.
 *
 * This is the "symbol-linking bus" substrate: when any panel calls
 * setActiveSymbol, every panel subscribed to activeSymbol re-renders
 * with the new ticker. Panels subscribe via Zustand selectors so
 * unrelated slices (theme, etc.) never trigger re-renders.
 *
 * Plan ref: D2, D4.
 */

import { create } from 'zustand';

export type TerminalTheme = 'dark' | 'light';

export interface TerminalContextState {
  /** The active ticker symbol broadcast to all linkable panels. */
  activeSymbol: string | null;
  /** UI theme — dark is the Bloomberg-style default. */
  theme: TerminalTheme;
  setActiveSymbol: (symbol: string | null) => void;
  setTheme: (theme: TerminalTheme) => void;
}

export const useTerminalContextStore = create<TerminalContextState>((set) => ({
  activeSymbol: null,
  theme: 'dark',
  setActiveSymbol: (symbol): void => set({ activeSymbol: symbol }),
  setTheme: (theme): void => set({ theme }),
}));
