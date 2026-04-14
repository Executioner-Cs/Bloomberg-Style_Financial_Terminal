/**
 * TanStack Router route tree.
 *
 * File-based routing convention:
 * - __root.tsx  → Root layout (terminal shell, command palette)
 * - index.tsx   → Default panel layout
 * - chart/$symbol.tsx → Chart view for a specific symbol
 */
import { createRootRoute, createRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';

// Root layout — always rendered, wraps all routes
const RootLayout = lazy(() => import('./routes/__root'));

// Routes — all panels lazy-loaded for performance budget compliance
const IndexPage = lazy(() => import('./routes/index'));
const ChartPage = lazy(() => import('./routes/chart/$symbol'));
const ScreenerPage = lazy(() => import('./routes/screener/index'));
const NewsPage = lazy(() => import('./routes/news/index'));
const MacroPage = lazy(() => import('./routes/macro/index'));

const rootRoute = createRootRoute({
  component: () => (
    <Suspense fallback={<div className="terminal-loading">Loading...</div>}>
      <RootLayout />
    </Suspense>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => (
    <Suspense fallback={null}>
      <IndexPage />
    </Suspense>
  ),
});

const chartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/chart/$symbol',
  component: () => (
    <Suspense fallback={null}>
      <ChartPage />
    </Suspense>
  ),
});

const screenerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/screener',
  component: () => (
    <Suspense fallback={null}>
      <ScreenerPage />
    </Suspense>
  ),
});

const newsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/news',
  component: () => (
    <Suspense fallback={null}>
      <NewsPage />
    </Suspense>
  ),
});

const macroRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/macro',
  component: () => (
    <Suspense fallback={null}>
      <MacroPage />
    </Suspense>
  ),
});

export const routeTree = rootRoute.addChildren([
  indexRoute,
  chartRoute,
  screenerRoute,
  newsRoute,
  macroRoute,
]);
