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
    <div
      style={{
        display: 'flex',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '16px',
        fontFamily: 'var(--font-mono)',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.2em',
            color: 'var(--color-accent)',
          }}
        >
          BLOOMBERG TERMINAL v0.0.1
        </span>
        <span
          style={{
            fontSize: '11px',
            letterSpacing: '0.1em',
            color: 'var(--color-text-muted)',
          }}
        >
          PRESS Ctrl+K TO BEGIN
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          gap: '24px',
          fontSize: '10px',
          letterSpacing: '0.05em',
          color: 'var(--color-text-muted)',
          opacity: 0.6,
        }}
      >
        <span>↑↓ NAVIGATE</span>
        <span>ENTER SELECT</span>
        <span>ESC CLOSE</span>
      </div>
    </div>
  );
}
