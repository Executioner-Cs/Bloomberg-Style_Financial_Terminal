/**
 * Root layout — terminal shell that wraps all routes.
 *
 * Renders: command palette (global Ctrl+K shortcut), the panel grid
 * (all routes render inside via <Outlet />), and the status bar.
 */
import { Outlet } from '@tanstack/react-router';
import type { JSX } from 'react';

import CommandPalette from '@/components/command-palette';
import StatusBar from '@/components/status-bar';

export default function RootLayout(): JSX.Element {
  return (
    <div
      className="terminal-shell"
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      <CommandPalette />
      <main role="main" style={{ flex: 1, overflow: 'hidden' }}>
        <Outlet />
      </main>
      <StatusBar />
    </div>
  );
}
