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
    <div className="terminal-shell flex flex-col h-full">
      <CommandPalette />
      <main role="main" className="flex-1 overflow-hidden">
        <Outlet />
      </main>
      <StatusBar />
    </div>
  );
}
