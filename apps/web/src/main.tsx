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
      // 60s minimum staleTime — CoinGecko free-tier ToS requires at minimum 60s caching.
      // Data is served from cache within this window; background revalidation fires after.
      staleTime: 60_000, // 60 seconds — CoinGecko ToS minimum cache window
      gcTime: 5 * 60_000, // 5 minutes before unused data is garbage-collected
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
