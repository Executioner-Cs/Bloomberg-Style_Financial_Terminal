/**
 * Default terminal layout — shown on first load before a symbol is selected.
 *
 * Displays a centered prompt directing users to the command palette.
 * Phase 2 will replace this with a split watchlist + chart view once
 * the WatchlistPanel is built.
 */
import type { JSX } from 'react';

export default function IndexPage(): JSX.Element {
  return (
    <div className="flex h-full items-center justify-center flex-col gap-4 select-none">
      <div className="flex flex-col items-center gap-2">
        <span className="text-[11px] font-bold tracking-[0.2em] text-[var(--color-accent)]">
          BLOOMBERG TERMINAL v0.0.1
        </span>
        <span className="text-[11px] tracking-widest text-[var(--color-text-muted)]">
          PRESS Ctrl+K TO BEGIN
        </span>
      </div>

      <div className="flex gap-6 text-[10px] tracking-wider text-[var(--color-text-muted)] opacity-60">
        <span>↑↓ NAVIGATE</span>
        <span>ENTER SELECT</span>
        <span>ESC CLOSE</span>
      </div>
    </div>
  );
}
