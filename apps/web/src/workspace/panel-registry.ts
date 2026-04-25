/**
 * Panel registry — the runtime lookup table from `appId` to `PanelApp`.
 *
 * The registry is intentionally module-scoped (not a React context) so
 * that:
 *   1. Non-React code (layout serializer, command palette actions) can
 *      read it without going through hooks.
 *   2. Registration is a build-time concern — panels register once at
 *      `main.tsx` boot, never dynamically per-render.
 *
 * It is a write-then-freeze registry: re-registering the same id throws,
 * which surfaces accidental double-registration (the kind of bug that
 * otherwise silently overwrites a panel's default props).
 *
 * ## Type erasure boundary
 *
 * The backing map stores `PanelApp<unknown>` because TypeScript cannot
 * represent a heterogeneous generic through a single Map. Each panel
 * `app.ts` file defines its record as `PanelApp<ConcreteProps>`.
 *
 * TypeScript's strict function parameter contravariance means
 * `FC<PanelProps<ConcreteProps>>` is not directly assignable to
 * `FC<PanelProps<unknown>>`. The unsafe cast is centralised here in
 * `registerPanelApp` — it is the ONLY place in the codebase where the
 * double cast appears. Panel app files call `registerPanelApp(app)` with
 * no casts; `PanelHost` reads the erased type and the component receives
 * its concrete props at runtime via the workspace store lookup.
 *
 * Plan ref: D6.
 */

import type { PanelApp } from './types';

/**
 * Backing map. Type-erased — each value is `PanelApp<unknown>` because
 * TypeScript cannot carry a heterogeneous generic through a single Map.
 * Callers retrieve with the panel's known Props type via `getPanelApp<P>`.
 */
const panels = new Map<string, PanelApp<unknown>>();

/**
 * Register a panel app. Called at app boot from `main.tsx`.
 *
 * Throws if `app.id` is already registered — prevents silent override
 * of defaults or Component swap due to a typo or merge accident.
 *
 * The double cast to `PanelApp<unknown>` is the single centralised
 * type-erasure point for all panel apps. See module JSDoc for rationale.
 */
export function registerPanelApp<Props>(app: PanelApp<Props>): void {
  if (panels.has(app.id)) {
    throw new Error(`Panel app '${app.id}' is already registered. Panel ids must be unique.`);
  }
  panels.set(app.id, app as unknown as PanelApp<unknown>);
}

/**
 * Retrieve a registered panel app. Returns `undefined` when unknown —
 * callers (layout deserializer, especially) must handle missing ids
 * gracefully, since a saved layout may reference a panel that was
 * renamed or removed in a later build.
 */
export function getPanelApp<Props = unknown>(id: string): PanelApp<Props> | undefined {
  return panels.get(id) as PanelApp<Props> | undefined;
}

/** Snapshot of all registered apps — used by command palette listings. */
export function listPanelApps(): readonly PanelApp<unknown>[] {
  return Array.from(panels.values());
}

/**
 * Remove all registered panels. **Test-only.** Production code must not
 * call this — the registry's write-then-freeze contract depends on it
 * being populated exactly once at boot.
 */
export function __resetPanelRegistryForTests(): void {
  panels.clear();
}
