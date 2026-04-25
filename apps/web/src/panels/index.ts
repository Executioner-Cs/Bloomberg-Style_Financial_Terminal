/**
 * Panel registry barrel — every panel built in Phase 2+ is exported here.
 * Import panels from this barrel rather than from individual panel directories.
 */
export { ChartPanel, chartPanelApp, type ChartPanelProps } from './chart-panel';
export { QuotePanel, quotePanelApp, type QuotePanelProps } from './quote-panel';
export { WatchlistPanel, watchlistPanelApp, type WatchlistPanelProps } from './watchlist-panel';
export { MacroPanel, macroPanelApp, type MacroPanelProps } from './macro-panel';
export { NewsPanel, newsPanelApp, type NewsPanelProps } from './news-panel';
export { FilingPanel, filingPanelApp, type FilingPanelProps } from './filing-panel';
