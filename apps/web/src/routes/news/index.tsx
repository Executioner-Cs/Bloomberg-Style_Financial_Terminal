/**
 * News page — Phase 4 implementation.
 *
 * Will render a real-time financial news feed with symbol-level filtering,
 * sentiment badges, and source attribution. Powered by an RSS ingestion
 * pipeline in the worker service.
 * Placeholder shown until the news backend pipeline is built.
 */
import type { JSX } from 'react';
import { ComingSoon } from '@terminal/ui-components';

export default function NewsPage(): JSX.Element {
  return (
    <ComingSoon
      label="NEWS"
      phase={4}
      description="Real-time financial news feed with symbol-level filtering, sentiment classification, and source attribution. Aggregates from Reuters, Bloomberg RSS, and SEC EDGAR filings."
    />
  );
}
