/**
 * Chart route — /chart/:symbol
 * Renders ChartPanel for a specific symbol.
 */
import { useParams } from '@tanstack/react-router';

export default function ChartPage() {
  const { symbol } = useParams({ from: '/chart/$symbol' });

  return (
    <div style={{ height: '100%', padding: '8px' }}>
      {/* TODO(#7): Replace with ChartPanel component */}
      <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>
        Chart: {symbol}
      </div>
    </div>
  );
}
