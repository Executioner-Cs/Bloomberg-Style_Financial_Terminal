/**
 * Screener page — Phase 5 implementation.
 *
 * Will render a multi-criteria equity/crypto screener powered by AG Grid
 * with server-side row model against the FastAPI screener endpoint.
 * Placeholder shown until the screener backend and AG Grid integration
 * are built.
 */
import type { JSX } from 'react';
import { ComingSoon } from '@terminal/ui-components';

export default function ScreenerPage(): JSX.Element {
  return (
    <ComingSoon
      label="SCREENER"
      phase={5}
      description="Multi-criteria instrument screener with real-time filtering, sortable columns, and export to CSV. Supports equity, ETF, crypto, and commodity asset classes."
    />
  );
}
