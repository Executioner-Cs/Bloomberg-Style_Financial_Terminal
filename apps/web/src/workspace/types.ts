/**
 * Workspace public types — PanelApp contract + runtime prop shape.
 *
 * A `PanelApp` is the registration record for a panel type. The
 * registry stores `PanelApp` entries; the dockview container renders
 * instances of `app.Component` with `PanelProps<app.defaultProps>`.
 *
 * Why generic `Props`: each panel owns its own serialisable state
 * (e.g. QuotePanel has `{ symbol }`, ChartPanel has `{ symbol, timeframe }`).
 * The registry is type-erased at storage time (`PanelApp<unknown>`) but
 * each Component gets its concrete Props back at render time.
 *
 * Serialise/deserialise are explicit — we never JSON.stringify arbitrary
 * props, because panels may carry non-JSON values (Date, Map) that need
 * normalisation before hitting localStorage.
 *
 * Plan ref: D6.
 */

import type { FC } from 'react';
import type { LucideIcon } from 'lucide-react';

/** Props handed to every panel Component at runtime. */
export interface PanelProps<Props = unknown> {
  /** Unique instance id — stable across (de)serialisation. */
  panelId: string;
  /** True when this panel has keyboard focus in the workspace. */
  isActive: boolean;
  /** Request workspace to close/destroy this panel instance. */
  onClose: () => void;
  /** Current serialised props for this instance. */
  props: Props;
  /** Merge-patch the instance's props (persists via workspace.store). */
  updateProps: (next: Partial<Props>) => void;
}

/**
 * Registration record for a panel type.
 *
 * `id` is the string key used in the registry and serialised in layout
 * JSON. Once published, an `id` is load-bearing — changing it breaks
 * saved layouts.
 */
export interface PanelApp<Props = unknown> {
  /** Registry key. Stable across versions; appears in layout JSON. */
  id: string;
  /** Human-readable name for tab labels + command palette. */
  displayName: string;
  /** Icon for tab strip + command palette entries. */
  icon: LucideIcon;
  /** Props applied when a new instance of this panel is created. */
  defaultProps: Props;
  /** True ⇒ panel subscribes to `terminal-context.activeSymbol`. */
  linkable: boolean;
  /**
   * Serialise props for storage in layout JSON.
   * Must return a string parseable by `deserialize`.
   */
  serialize: (props: Props) => string;
  /**
   * Reverse of `serialize`. Must be total over any string it produced
   * itself, and should fall back to `defaultProps` on unknown input.
   */
  deserialize: (raw: string) => Props;
  /** React component rendered inside the dockview tile. */
  Component: FC<PanelProps<Props>>;
}
