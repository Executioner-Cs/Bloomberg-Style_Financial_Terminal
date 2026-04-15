/**
 * ComingSoon — terminal-style placeholder for routes not yet implemented.
 *
 * Displays the panel label in accent colour, a short description of what
 * the panel will do, and the roadmap phase it belongs to. Used by
 * screener, news, and macro routes until their backends exist.
 */
import type { JSX } from 'react';

export type ComingSoonProps = {
  /** Short all-caps panel name shown in the accent badge, e.g. "SCREENER". */
  label: string;
  /** Roadmap phase number when this panel will be implemented. */
  phase: number;
  /** One-sentence description of what the panel will do when complete. */
  description: string;
};

export function ComingSoon({ label, phase, description }: ComingSoonProps): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-mono)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          maxWidth: '480px',
          textAlign: 'center',
        }}
      >
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.25em',
            color: 'var(--color-accent)',
            padding: '4px 10px',
            border: '1px solid var(--color-accent)',
            borderRadius: '2px',
          }}
        >
          [{label}]
        </span>

        <p
          style={{
            fontSize: '11px',
            lineHeight: 1.7,
            letterSpacing: '0.04em',
            color: 'var(--color-text-secondary)',
            margin: 0,
          }}
        >
          {description}
        </p>

        <span
          style={{
            fontSize: '9px',
            letterSpacing: '0.15em',
            color: 'var(--color-text-muted)',
            padding: '2px 8px',
            border: '1px solid var(--color-border)',
            borderRadius: '2px',
          }}
        >
          PHASE {phase}
        </span>
      </div>
    </div>
  );
}
