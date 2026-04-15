/**
 * PanelSkeleton — animated loading placeholder for terminal panels.
 *
 * Renders a shimmer animation using only CSS variables from the global
 * terminal theme. No external dependencies — safe to use in any panel
 * before data arrives.
 */
import type { JSX } from 'react';

type PanelSkeletonProps = {
  /** Number of shimmer rows to render. Defaults to 5. */
  rows?: number;
};

export function PanelSkeleton({ rows = 5 }: PanelSkeletonProps): JSX.Element {
  return (
    <div
      role="status"
      aria-label="Loading"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '12px',
        height: '100%',
      }}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={`skeleton-row-${i}`}
          style={{
            height: '16px',
            borderRadius: '3px',
            background: `linear-gradient(
              90deg,
              var(--color-bg-secondary) 25%,
              var(--color-bg-hover) 50%,
              var(--color-bg-secondary) 75%
            )`,
            backgroundSize: '200% 100%',
            animation: 'skeleton-shimmer 1.5s ease-in-out infinite',
            /* Stagger width for a natural look */
            width: i % 3 === 0 ? '60%' : i % 3 === 1 ? '85%' : '72%',
          }}
        />
      ))}
      <style>{`
        @keyframes skeleton-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
