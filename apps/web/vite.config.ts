import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env vars from the repo root (where .env lives), not from apps/web.
  // Only vars prefixed with VITE_ are exposed to the browser bundle;
  // VITE_DEV_* vars are consumed here at config time — never shipped to the client.
  const env = loadEnv(mode, resolve(__dirname, '../..'), '');

  // Proxy targets are only required in serve/build mode, not during unit tests.
  // Vitest sets mode='test'; throwing there would break `pnpm test:unit` in CI
  // where no .env file is present. Fail fast in every other mode.
  // Default to '' so apiProxyTarget/wsProxyTarget are typed as string (not
  // string | undefined). Empty string is falsy — validation still triggers below.
  const apiProxyTarget = env['VITE_DEV_API_PROXY_TARGET'] ?? '';
  const wsProxyTarget = env['VITE_DEV_WS_PROXY_TARGET'] ?? '';
  if (mode !== 'test') {
    if (!apiProxyTarget) {
      // noqa: hardcoded — example value in error message only; actual URL from env.
      throw new Error('VITE_DEV_API_PROXY_TARGET is required in .env (e.g. http://localhost:8000)'); // noqa: hardcoded
    }
    if (!wsProxyTarget) {
      // noqa: hardcoded — example value in error message only; actual URL from env.
      throw new Error('VITE_DEV_WS_PROXY_TARGET is required in .env (e.g. ws://localhost:3001)'); // noqa: hardcoded
    }
  }

  return {
    // basicSsl generates an ephemeral self-signed cert — see ADR-004.
    // Browser will show a "Not Secure" warning on first visit; accept once.
    plugins: [react(), basicSsl()],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@terminal/types': resolve(__dirname, '../../packages/types/src'),
        '@terminal/ui-components': resolve(__dirname, '../../packages/ui-components/src'),
      },
    },
    // Server config is irrelevant in test mode — Vitest uses its own runner.
    ...(mode !== 'test' && {
      server: {
        port: 5173, // noqa: hardcoded — Vite's assigned default. Falls within project frontend range (5100–5199). ADR-004.
        https: true, // cert provided by @vitejs/plugin-basic-ssl (ADR-004)
        proxy: {
          '/api': {
            target: apiProxyTarget,
            changeOrigin: true,
          },
          '/ws': {
            target: wsProxyTarget,
            ws: true,
            changeOrigin: true,
          },
        },
      },
    }),
    build: {
      rollupOptions: {
        output: {
          // Code split all panels into lazy chunks — per performance budget
          manualChunks: {
            react: ['react', 'react-dom'],
            tanstack: ['@tanstack/react-query', '@tanstack/react-router'],
            charts: ['lightweight-charts', 'recharts'],
            grid: ['@ag-grid-community/react', '@ag-grid-community/core'],
            d3: ['d3'],
          },
        },
      },
      // Warn if any chunk exceeds 500KB (initial chunk must be < 200KB gzipped)
      chunkSizeWarningLimit: 500,
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.ts'],
      // Restrict to src/ only — e2e/ contains Playwright specs that must not
      // be picked up by Vitest. Playwright specs run separately via `pnpm test:e2e`.
      include: ['src/**/*.test.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov'],
        thresholds: {
          lines: 60,
          functions: 60,
          branches: 60,
        },
        exclude: [
          // Barrel re-exports — no executable logic; excluded per CLAUDE.md Part XI.
          // E2E tests cover the panels that these barrels compose.
          'src/panels/*/index.tsx',
          'src/panels/index.ts',
          // Route thin wrappers — covered by Playwright E2E (CLAUDE.md Part XI).
          'src/routes/**/*.tsx',
          // Test infrastructure — not application source.
          'src/test-setup.ts',
        ],
      },
    },
  };
});
