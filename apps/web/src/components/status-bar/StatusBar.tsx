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

/**
 * Persistent bottom bar rendered by the root layout on every route.
 * Displays terminal version, live connection status, and a UTC clock
 * updated every second. No data fetching — pure presentational component.
 */
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
      className="flex items-center justify-between h-6 px-3 bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)] shrink-0"
    >
      {/* Left: version + connection status */}
      <div className="flex items-center gap-3 text-[10px] text-[var(--color-text-muted)] tracking-wider">
        <span className="text-[var(--color-accent)] font-semibold">BLOOMBERG TERMINAL</span>
        <span>v0.0.1</span>
        <span className="flex items-center gap-1">
          <span
            aria-label="Connection status: connected"
            className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-positive)] shrink-0"
          />
          <span>CONNECTED</span>
        </span>
      </div>

      {/* Right: UTC clock */}
      <span
        aria-label="UTC clock"
        className="text-[10px] text-[var(--color-text-muted)] tracking-wider"
      >
        {utcTime}
      </span>
    </div>
  );
}
