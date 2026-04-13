/**
 * Default terminal layout — shown on first load.
 * Phase 2: Split view with watchlist (left) and chart (right).
 */
import type { JSX } from 'react';

export default function IndexPage(): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-text-muted)',
        fontFamily: 'var(--font-mono)',
        fontSize: '12px',
        letterSpacing: '0.1em',
      }}
    >
      {/* TODO(#6): Replace with split watchlist + chart panel layout */}
      BLOOMBERG TERMINAL v0.0.1 · PRESS Ctrl+K TO BEGIN
    </div>
  );
}
