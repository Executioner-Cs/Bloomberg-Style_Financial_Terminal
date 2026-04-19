/**
 * Layout serializer — persists and restores workspace state.
 *
 * Two mechanisms (plan ref: D3):
 *
 *   1. localStorage key `terminal.workspace.v1` — full workspace snapshot
 *      (panels + dockview layout tree). Read on shell mount; written on
 *      every dockview layout change. Survives browser close.
 *
 *   2. URL query param `?ws=<preset-slug>` — human-readable deep-link to
 *      a named preset (e.g. `?ws=equities`). The shell reads this once on
 *      mount; when present it overrides the localStorage snapshot so a
 *      shared link always lands on the intended layout. Full layout state
 *      is intentionally never encoded into the URL — base64 snapshots
 *      produce 400+ character URLs and break bookmark UX (plan risk #6).
 *
 * Version handling: every snapshot carries `version: CURRENT_VERSION`.
 * When the schema changes in a future phase, add a migration case to
 * `migrate()` rather than bumping STORAGE_KEY — that keeps old snapshots
 * reachable. Only bump STORAGE_KEY (the suffix) when the migration path
 * is intentionally severed (e.g. a breaking dockview layout change).
 *
 * Plan ref: B12, D3, ADR-009.
 */

import type { LayoutJson, PanelInstance } from './stores/workspace.store';

// ------------------------------------------------------------------
// Constants — every value documented per CLAUDE.md Rule 1.
// ------------------------------------------------------------------

/**
 * localStorage key for the full workspace snapshot.
 *
 * The `.v1` suffix is load-bearing: it namespaces the key to the
 * current schema generation. If a future migration is impossible
 * (e.g. a dockview major-version layout-JSON break), bump the suffix
 * to `.v2` instead of running an ad-hoc migration, so users get a
 * clean slate without explicit key removal.
 */
const STORAGE_KEY = 'terminal.workspace.v1';

/**
 * Schema version embedded in every saved snapshot.
 *
 * `migrate()` uses this to decide whether to return the snapshot as-is
 * or attempt a schema upgrade. A version mismatch returns `null`, which
 * signals the shell to fall back to the default preset.
 */
const CURRENT_VERSION = 1;

/**
 * URL query parameter name for the workspace preset deep-link.
 *
 * Chosen to be short and unambiguous in a terminal context.
 * `ws` is not used by any browser API or framework router.
 * Example: `https://terminal.example.com/?ws=equities`
 */
const WS_QUERY_PARAM = 'ws';

// ------------------------------------------------------------------
// Public types
// ------------------------------------------------------------------

/**
 * The complete serialised workspace state written to localStorage and
 * read back on shell mount.
 *
 * `version` guards against loading a snapshot whose shape differs from
 * what the current code expects — callers receive `null` instead of
 * a partially-populated object.
 */
export interface WorkspaceSnapshot {
  /** Schema version — must equal CURRENT_VERSION for the snapshot to load. */
  version: number;
  /**
   * Panel instances keyed by panelId.
   * Shape mirrors `workspace.store.panels` exactly so `hydrate()` can
   * accept a snapshot directly without re-mapping.
   */
  panels: Record<string, PanelInstance>;
  /**
   * Opaque dockview layout tree — null when no layout has been saved yet
   * (e.g. first run after a preset is applied programmatically).
   * Shape is owned by dockview-react; we treat it as an opaque blob.
   */
  layoutJson: LayoutJson | null;
}

// ------------------------------------------------------------------
// Internal helpers
// ------------------------------------------------------------------

/**
 * Validate and migrate a raw deserialized value to `WorkspaceSnapshot`.
 *
 * Returns `null` when:
 *   - `raw` is not an object
 *   - `raw.version` is missing or not a number
 *   - `raw.version` is unknown (no migration path defined)
 *   - `raw.panels` is not an object
 *
 * Add a `case` per major version bump. Keep old cases — they allow
 * users who skipped multiple releases to still migrate their layouts.
 */
function migrate(raw: unknown): WorkspaceSnapshot | null {
  if (raw === null || typeof raw !== 'object') return null;

  const obj = raw as Record<string, unknown>;

  if (typeof obj['version'] !== 'number') return null;
  if (typeof obj['panels'] !== 'object' || obj['panels'] === null) return null;

  const version = obj['version'];

  switch (version) {
    case CURRENT_VERSION:
      // v1 shape matches WorkspaceSnapshot exactly — return as-is.
      return raw as WorkspaceSnapshot;

    // case 2: add v2 migration here when schema changes.

    default:
      // Unknown version — discard. Shell falls back to default preset.
      return null;
  }
}

// ------------------------------------------------------------------
// localStorage persistence
// ------------------------------------------------------------------

/**
 * Persist a workspace snapshot to localStorage.
 *
 * Called by WorkspaceShell on every dockview `onDidLayoutChange` event.
 * Silently no-ops when storage is unavailable (private browsing mode,
 * quota exceeded, or the environment has no `localStorage`).
 */
export function saveSnapshot(snapshot: WorkspaceSnapshot): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Storage unavailable — workspace state is ephemeral this session.
  }
}

/**
 * Load and validate the stored workspace snapshot.
 *
 * Returns:
 *   - A valid `WorkspaceSnapshot` when the stored data is current
 *   - `null` when nothing is stored, storage is unavailable, the JSON
 *     is corrupt, or the schema version is unknown
 *
 * Callers must treat `null` as "fall back to the default preset".
 */
export function loadSnapshot(): WorkspaceSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    return migrate(JSON.parse(raw) as unknown);
  } catch {
    // Corrupt JSON or storage unavailable.
    return null;
  }
}

/**
 * Delete the stored snapshot.
 *
 * Used by the "Reset workspace" command — after clearing, the next
 * shell mount will land on the default preset.
 * No-ops if the key is absent or storage is unavailable.
 */
export function clearSnapshot(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable — nothing to clear.
  }
}

// ------------------------------------------------------------------
// URL deep-linking
// ------------------------------------------------------------------

/**
 * Read the `?ws=<slug>` query parameter from the current page URL.
 *
 * Returns the slug string (e.g. `'equities'`, `'macro'`) or `null`
 * when the param is absent. The shell checks this on first mount:
 * a non-null slug takes precedence over localStorage and causes the
 * named preset to load instead.
 *
 * No-ops (returns `null`) in environments without `window.location`
 * (SSR, test environments that do not configure jsdom).
 */
export function getPresetSlugFromUrl(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get(WS_QUERY_PARAM);
  } catch {
    return null;
  }
}

/**
 * Build a shareable URL that deep-links to a named preset.
 *
 * Strips all existing query params and sets only `?ws=<slug>` —
 * the terminal URL is intentionally minimal (plan risk #6).
 * Full layout state lives in localStorage on the recipient's machine;
 * the URL only conveys intent ("open the Equities preset").
 */
export function buildPresetUrl(slug: string): string {
  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set(WS_QUERY_PARAM, slug);
  return url.toString();
}

// ------------------------------------------------------------------
// Snapshot construction
// ------------------------------------------------------------------

/**
 * Construct a blank `WorkspaceSnapshot` from a panels map.
 *
 * Used by preset builders (B13) that need to hand a snapshot directly
 * to `workspace.store.hydrate()`. `layoutJson` is null because presets
 * let dockview build the initial layout imperatively via `api.addPanel`;
 * the serialized tree is captured only after the first user interaction.
 */
export function buildSnapshot(panels: Record<string, PanelInstance>): WorkspaceSnapshot {
  return {
    version: CURRENT_VERSION,
    panels,
    layoutJson: null,
  };
}

/** Exported for tests that need to assert against the current version. */
export { CURRENT_VERSION as WORKSPACE_SNAPSHOT_VERSION };
