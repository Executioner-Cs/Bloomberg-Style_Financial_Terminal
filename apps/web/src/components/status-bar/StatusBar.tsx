/**
 * StatusBar — persistent bottom bar showing terminal metadata.
 *
 * Displays:
 *   Left  — terminal version string and connection status badge
 *   Right — live UTC clock, updated every second
 *
 * Pure display component — no API calls, no TanStack Query.
 * Clock is driven by a `setInterval` in `useEffect` that updates
 * once per second; the interval is cleared on unmount.
 */
import { useEffect, useState, type JSX } from 'react';

/** Refresh rate for the UTC clock display. */
const CLOCK_INTERVAL_MS = 1_000;

/** Format a Date as "YYYY-MM-DD HH:MM:SS UTC". */
function formatUtcClock(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  const y = date.getUTCFullYear();
  const mo = pad(date.getUTCMonth() + 1);
  const d = pad(date.getUTCDate());
  const h = pad(date.getUTCHours());
  const mi = pad(date.getUTCMinutes());
  const s = pad(date.getUTCSeconds());
  return `${y}-${mo}-${d} ${h}:${mi}:${s} UTC`;
}

export default function StatusBar(): JSX.Element {
  const [utcTime, setUtcTime] = useState<string>(() => formatUtcClock(new Date()));

  useEffect(() => {
    const id = setInterval((): void => {
      setUtcTime(formatUtcClock(new Date()));
    }, CLOCK_INTERVAL_MS);
    return (): void => clearInterval(id);
  }, []);

  return (
    <div
      aria-label="Status bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '24px',
        padding: '0 12px',
        background: 'var(--color-bg-secondary)',
        borderTop: '1px solid var(--color-border)',
        flexShrink: 0,
      }}
    >
      {/* Left: version + connection status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          color: 'var(--color-text-muted)',
          letterSpacing: '0.05em',
        }}
      >
        <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>BLOOMBERG TERMINAL</span>
        <span>v0.0.1</span>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span
            aria-label="Connection status: connected"
            style={{
              display: 'inline-block',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--color-positive)',
              flexShrink: 0,
            }}
          />
          <span>CONNECTED</span>
        </span>
      </div>

      {/* Right: UTC clock */}
      <span
        aria-label="UTC clock"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          color: 'var(--color-text-muted)',
          letterSpacing: '0.05em',
        }}
      >
        {utcTime}
      </span>
    </div>
  );
}
