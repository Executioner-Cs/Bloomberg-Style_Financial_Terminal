/**
 * Chart route — /chart/:symbol
 * Renders ChartPanel for a specific symbol.
 */
import { useParams, useNavigate } from '@tanstack/react-router';
import type { JSX } from 'react';

import { ChartPanel } from '@/panels/chart-panel';

export default function ChartPage(): JSX.Element {
  const { symbol } = useParams({ from: '/chart/$symbol' });
  const navigate = useNavigate();

  return (
    <div style={{ height: '100%', padding: '8px' }}>
      <ChartPanel
        panelId={`chart-${symbol}`}
        isActive={true}
        onClose={() => void navigate({ to: '/' })}
        symbol={symbol}
      />
    </div>
  );
}
