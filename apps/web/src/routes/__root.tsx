/**
 * Root layout — terminal shell that wraps all routes.
 *
 * Renders: command palette (global Ctrl+K shortcut), the panel grid
 * (all routes render inside via <Outlet />), and the status bar.
 */
import { Outlet } from '@tanstack/react-router';
import type { JSX } from 'react';

import { ErrorBoundary } from '@/components/error-boundary/ErrorBoundary';
import CommandPalette from '@/components/command-palette';
import StatusBar from '@/components/status-bar';

/**
 * Root layout — wraps every route with the command palette, main outlet,
 * and status bar. Renders once for the lifetime of the app.
 */
export default function RootLayout(): JSX.Element {
  return (
    <div className="terminal-shell flex flex-col h-full">
      <CommandPalette />
      <main role="main" className="flex-1 overflow-hidden">
        {/* ErrorBoundary prevents a panel crash from blanking the terminal.
            CLAUDE.md Part XVII: panel crashes must not crash the terminal. */}
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
      <StatusBar />
    </div>
  );
}
