/**
 * Root layout — terminal shell that wraps all routes.
 *
 * Renders: command palette, status bar, and the panel grid.
 * All routes render inside the panel grid via <Outlet />.
 */
import { Outlet } from '@tanstack/react-router';
import type { JSX } from 'react';

export default function RootLayout(): JSX.Element {
  return (
    <div
      className="terminal-shell"
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      {/* TODO(#6): Add CommandPalette component */}
      {/* TODO(#6): Add StatusBar component */}
      <main style={{ flex: 1, overflow: 'hidden' }}>
        <Outlet />
      </main>
    </div>
  );
}
