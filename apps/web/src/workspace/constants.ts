/**
 * Shared workspace constants.
 *
 * Centralises the string literals that appear in multiple workspace files
 * (layout-serializer.ts, default-layouts.ts, workspace-api-ref.ts, tests).
 * A single import site means a rename only changes one file.
 */

/**
 * localStorage key for the full workspace snapshot.
 *
 * The `.v1` suffix namespaces the key to the current schema generation.
 * Bump to `.v2` if a future migration is impossible (e.g. a dockview
 * major-version layout-JSON break) so users get a clean slate without
 * explicit key removal.
 */
export const WORKSPACE_STORAGE_KEY = 'terminal.workspace.v1';

/**
 * URL query parameter name for workspace preset deep-links.
 *
 * `ws` is short, unambiguous in a terminal context, and unused by any
 * browser API or framework router.
 * Example: `https://terminal.example.com/?ws=equities`
 */
export const WORKSPACE_QUERY_PARAM = 'ws';

/**
 * Dockview `component` string for all workspace panels.
 *
 * Dockview requires a component name string to resolve the React component
 * to render inside each panel container. All terminal panels use a single
 * `PanelHost` wrapper (registered under this name) that dynamically renders
 * the correct panel app via the panel registry.
 */
export const DOCKVIEW_COMPONENT_NAME = 'workspace-panel';
