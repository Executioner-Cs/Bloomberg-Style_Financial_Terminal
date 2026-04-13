/**
 * Application entry point.
 *
 * Wraps the app in QueryClientProvider (TanStack Query) and
 * RouterProvider (TanStack Router). All other providers are
 * added in the root route layout.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { routeTree } from './router';

import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale-while-revalidate: show cached data immediately, refetch in background
      staleTime: 30_000,       // 30 seconds before data is considered stale
      gcTime: 5 * 60_000,     // 5 minutes before unused data is garbage-collected
      retry: 2,
      refetchOnWindowFocus: true,
    },
  },
});

const router = createRouter({ routeTree });

// Declare module augmentation for TanStack Router type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in document');
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
