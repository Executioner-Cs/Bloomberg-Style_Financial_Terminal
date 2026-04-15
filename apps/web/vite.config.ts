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

  const apiProxyTarget = env['VITE_DEV_API_PROXY_TARGET'] ?? 'http://localhost:8000';
  const wsProxyTarget = env['VITE_DEV_WS_PROXY_TARGET'] ?? 'ws://localhost:3001';

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
    server: {
      port: 5173,
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
      },
    },
  };
});
