/**
 * Default workspace layout presets.
 *
 * Three presets ship with the terminal (plan ref: B13, D3):
 *
 *   - equities        — Chart + Quote + News, symbol-linked on AAPL
 *   - macro           — 2×2 grid of FRED macro series panels
 *   - filings-research — Quote + Filings + News, symbol-linked on AAPL
 *
 * Each preset's `apply(api)` function:
 *   1. Writes panel instances to the workspace store (Zustand outside-React
 *      pattern: `useWorkspaceStore.getState()` — safe for non-React callers
 *      like the command palette and the WorkspaceShell mount handler).
 *   2. Adds panels to the dockview instance via `api.addPanel`, establishing
 *      the initial split layout.
 *
 * Callers that want to SWITCH from an existing layout must use
 * `switchToPreset()` which handles cleanup (api.clear + store.reset +
 * clearSnapshot) before applying.
 *
 * Preset `apply` functions are intentionally idempotent-safe: they use
 * deterministic panel IDs (e.g. `equities-chart-0`) so a re-apply after
 * a partial failure produces the same result rather than duplicate panels.
 *
 * Plan ref: B13, D3, D6.
 */

import { TrendingUp, Globe, FileText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DockviewApi } from 'dockview-react';

import { useWorkspaceStore } from './stores/workspace.store';
import { buildSnapshot, clearSnapshot } from './layout-serializer';
import type { PanelInstance } from './stores/workspace.store';

// ------------------------------------------------------------------
// Constants — every value documented per CLAUDE.md Rule 1.
// ------------------------------------------------------------------

/**
 * Slug of the preset loaded on first run (no localStorage, no ?ws= param).
 * AAPL/equities is the canonical terminal demo entry point — instantly
 * recognisable, real quote data available from yfinance mock layer.
 */
export const DEFAULT_PRESET_SLUG = 'equities';

/**
 * Default equity symbol for presets that open a linked symbol context.
 * AAPL is the highest-liquidity, most-recognised ticker in the mock data
 * set (see mock_data/quotes/AAPL.json). Change once a user symbol list
 * is persisted.
 */
const DEFAULT_EQUITIES_SYMBOL = 'AAPL';

/**
 * Default symbol for the Filings Research preset.
 * Same as equities — the mock EDGAR filings set includes AAPL 10-K/10-Q.
 */
const DEFAULT_FILINGS_SYMBOL = 'AAPL';

/**
 * FRED series shown in the 2×2 Macro preset grid.
 * Order maps to visual positions: [top-left, top-right, bottom-left, bottom-right].
 * Series chosen to cover the four key FOMC-watching metrics:
 *   FEDFUNDS — effective fed funds rate (monetary policy instrument)
 *   DGS10    — 10-year Treasury yield (long-run rate expectations)
 *   CPIAUCSL — CPI all-items (headline inflation)
 *   UNRATE   — unemployment rate (labour market half of the dual mandate)
 */
const MACRO_GRID_SERIES = ['FEDFUNDS', 'DGS10', 'CPIAUCSL', 'UNRATE'] as const;

/** Component name registered in DockviewReact — must match WorkspaceShell.tsx. */
const DOCKVIEW_COMPONENT = 'workspace-panel';

// ------------------------------------------------------------------
// Public type
// ------------------------------------------------------------------

export interface LayoutPreset {
  /** URL-safe slug — appears in `?ws=<slug>` and in command palette. */
  slug: string;
  /** Human-readable name shown in command palette + "active preset" UI. */
  displayName: string;
  /** One-line description shown in command palette search results. */
  description: string;
  /** Icon for command palette entry and preset picker. */
  icon: LucideIcon;
  /**
   * Apply this preset to a live dockview instance.
   *
   * Writes panel instances to the workspace store and calls `api.addPanel`
   * for each tile. Assumes the caller has already cleared any existing
   * layout — use `switchToPreset()` for the full sequence.
   */
  apply: (api: DockviewApi) => void;
}

// ------------------------------------------------------------------
// Internal helpers
// ------------------------------------------------------------------

/**
 * Write a panels map to the workspace store and hydrate it from a blank
 * snapshot. Called at the start of every preset `apply()`.
 */
function hydrateStore(panels: Record<string, PanelInstance>): void {
  useWorkspaceStore.getState().hydrate(buildSnapshot(panels));
}

// ------------------------------------------------------------------
// Preset definitions
// ------------------------------------------------------------------

/**
 * Equities preset — the default landing layout.
 *
 * Layout (left → right):
 *   [ Chart (large) ] | [ Quote  ]
 *                     | [ News   ]
 *
 * All three panels are symbol-linked; clicking a ticker in Quote
 * propagates to Chart and News via terminal-context.activeSymbol.
 */
const equitiesPreset: LayoutPreset = {
  slug: 'equities',
  displayName: 'Equities',
  description: 'Chart, Quote, and News — linked on a single symbol',
  icon: TrendingUp,
  apply(api: DockviewApi): void {
    const chartId = 'equities-chart-0';
    const quoteId = 'equities-quote-0';
    const newsId = 'equities-news-0';

    const panels: Record<string, PanelInstance> = {
      [chartId]: {
        panelId: chartId,
        appId: 'chart',
        props: { symbol: DEFAULT_EQUITIES_SYMBOL, timeframe: '1D' },
      },
      [quoteId]: {
        panelId: quoteId,
        appId: 'quote',
        props: { symbol: DEFAULT_EQUITIES_SYMBOL },
      },
      [newsId]: {
        panelId: newsId,
        appId: 'news',
        props: { symbol: DEFAULT_EQUITIES_SYMBOL },
      },
    };

    hydrateStore(panels);

    // Chart fills the left column.
    api.addPanel({
      id: chartId,
      component: DOCKVIEW_COMPONENT,
      params: { panelId: chartId, appId: 'chart' },
      title: 'Chart',
    });

    // Quote docks right of Chart (~30% width — dockview sizes proportionally).
    api.addPanel({
      id: quoteId,
      component: DOCKVIEW_COMPONENT,
      params: { panelId: quoteId, appId: 'quote' },
      title: 'Quote',
      position: { direction: 'right', referencePanel: chartId },
    });

    // News docks below Quote in the right column.
    api.addPanel({
      id: newsId,
      component: DOCKVIEW_COMPONENT,
      params: { panelId: newsId, appId: 'news' },
      title: 'News',
      position: { direction: 'below', referencePanel: quoteId },
    });
  },
};

/**
 * Macro preset — 2×2 grid of FRED series panels.
 *
 * Layout:
 *   [ FEDFUNDS ] | [ DGS10    ]
 *   [ CPIAUCSL ] | [ UNRATE   ]
 *
 * Panels are not symbol-linked (macro series are fixed, not per-equity).
 */
const macroPreset: LayoutPreset = {
  slug: 'macro',
  displayName: 'Macro',
  description: 'Fed funds, 10-year Treasury, CPI, and unemployment — 2×2 grid',
  icon: Globe,
  apply(api: DockviewApi): void {
    // Build panel instances for all four macro series.
    const instances = MACRO_GRID_SERIES.map((seriesId, index) => {
      const panelId = `macro-${seriesId.toLowerCase()}-${index}`;
      return {
        panelId,
        appId: 'macro',
        props: { seriesId },
      } satisfies PanelInstance;
    });

    const panels: Record<string, PanelInstance> = Object.fromEntries(
      instances.map((inst) => [inst.panelId, inst]),
    );

    hydrateStore(panels);

    const [topLeft, topRight, bottomLeft, bottomRight] = instances;

    // Guard: MACRO_GRID_SERIES has exactly 4 entries (const array) — this
    // destructure is always safe. The assertion satisfies the linter.
    if (!topLeft || !topRight || !bottomLeft || !bottomRight) return;

    // Top-left — anchors the grid.
    api.addPanel({
      id: topLeft.panelId,
      component: DOCKVIEW_COMPONENT,
      params: { panelId: topLeft.panelId, appId: 'macro' },
      title: MACRO_GRID_SERIES[0],
    });

    // Top-right — right of top-left.
    api.addPanel({
      id: topRight.panelId,
      component: DOCKVIEW_COMPONENT,
      params: { panelId: topRight.panelId, appId: 'macro' },
      title: MACRO_GRID_SERIES[1],
      position: { direction: 'right', referencePanel: topLeft.panelId },
    });

    // Bottom-left — below top-left.
    api.addPanel({
      id: bottomLeft.panelId,
      component: DOCKVIEW_COMPONENT,
      params: { panelId: bottomLeft.panelId, appId: 'macro' },
      title: MACRO_GRID_SERIES[2],
      position: { direction: 'below', referencePanel: topLeft.panelId },
    });

    // Bottom-right — below top-right.
    api.addPanel({
      id: bottomRight.panelId,
      component: DOCKVIEW_COMPONENT,
      params: { panelId: bottomRight.panelId, appId: 'macro' },
      title: MACRO_GRID_SERIES[3],
      position: { direction: 'below', referencePanel: topRight.panelId },
    });
  },
};

/**
 * Filings Research preset — deep-dive into a single company's filings.
 *
 * Layout (left → right):
 *   [ Quote (narrow) ] | [ Filings (wide) ] | [ News (narrow) ]
 *
 * All panels symbol-linked — switching symbol updates Quote, Filings,
 * and News simultaneously.
 */
const filingsResearchPreset: LayoutPreset = {
  slug: 'filings-research',
  displayName: 'Filings Research',
  description: 'Quote, SEC filings, and News — linked on a single symbol',
  icon: FileText,
  apply(api: DockviewApi): void {
    const quoteId = 'filings-quote-0';
    const filingsId = 'filings-filings-0';
    const newsId = 'filings-news-0';

    const panels: Record<string, PanelInstance> = {
      [quoteId]: {
        panelId: quoteId,
        appId: 'quote',
        props: { symbol: DEFAULT_FILINGS_SYMBOL },
      },
      [filingsId]: {
        panelId: filingsId,
        appId: 'filings',
        props: { symbol: DEFAULT_FILINGS_SYMBOL, formType: '10-K' },
      },
      [newsId]: {
        panelId: newsId,
        appId: 'news',
        props: { symbol: DEFAULT_FILINGS_SYMBOL },
      },
    };

    hydrateStore(panels);

    // Quote on the left.
    api.addPanel({
      id: quoteId,
      component: DOCKVIEW_COMPONENT,
      params: { panelId: quoteId, appId: 'quote' },
      title: 'Quote',
    });

    // Filings in the centre — widest panel.
    api.addPanel({
      id: filingsId,
      component: DOCKVIEW_COMPONENT,
      params: { panelId: filingsId, appId: 'filings' },
      title: 'Filings',
      position: { direction: 'right', referencePanel: quoteId },
    });

    // News on the right.
    api.addPanel({
      id: newsId,
      component: DOCKVIEW_COMPONENT,
      params: { panelId: newsId, appId: 'news' },
      title: 'News',
      position: { direction: 'right', referencePanel: filingsId },
    });
  },
};

// ------------------------------------------------------------------
// Registry
// ------------------------------------------------------------------

const PRESETS: readonly LayoutPreset[] = [equitiesPreset, macroPreset, filingsResearchPreset];

/** All registered presets — used by the command palette to populate choices. */
export function listPresets(): readonly LayoutPreset[] {
  return PRESETS;
}

/**
 * Look up a preset by its URL slug.
 * Returns `undefined` for unknown slugs — callers should fall back to
 * `DEFAULT_PRESET_SLUG` when the result is absent.
 */
export function getPreset(slug: string): LayoutPreset | undefined {
  return PRESETS.find((p) => p.slug === slug);
}

/**
 * Switch to a named preset — full sequence:
 *   1. Clear the existing dockview layout (`api.clear()`).
 *   2. Reset the workspace store to empty state.
 *   3. Delete the localStorage snapshot so the next mount starts fresh.
 *   4. Apply the preset (hydrate store + add panels to dockview).
 *
 * Falls back to the default equities preset when `slug` is not found.
 *
 * Called by the command palette "Switch Preset" action (B14) and by
 * WorkspaceShell on first mount when no localStorage snapshot exists.
 */
export function switchToPreset(slug: string, api: DockviewApi): void {
  const preset = getPreset(slug) ?? getPreset(DEFAULT_PRESET_SLUG) ?? equitiesPreset;

  api.clear();
  useWorkspaceStore.getState().reset();
  clearSnapshot();

  preset.apply(api);
}
