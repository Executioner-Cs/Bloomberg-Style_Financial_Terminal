/**
 * Macro dashboard page — Phase 6 implementation.
 *
 * Will render a macroeconomic dashboard with FRED series (CPI, PCE,
 * unemployment, yield curves), economic calendar, and central bank
 * rate tracker.
 * Placeholder shown until the FRED integration and macro backend are built.
 */
import type { JSX } from 'react';
import { ComingSoon } from '@terminal/ui-components';

export default function MacroPage(): JSX.Element {
  return (
    <ComingSoon
      label="MACRO"
      phase={6}
      description="Macroeconomic dashboard with FRED time series (CPI, PCE, unemployment, yield curves), economic calendar events, and central bank rate tracker across G10 currencies."
    />
  );
}
