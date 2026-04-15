/**
 * PanelError — standardised error state for terminal panels.
 *
 * Displays the error message and a retry callback button.
 * Uses --color-negative from the global terminal theme for the error accent.
 */
import type { JSX } from 'react';

type PanelErrorProps = {
  /** The error to display. Uses error.message. */
  error: Error;
  /** Called when the user clicks the retry button. */
  onRetry?: () => void;
};

export function PanelError({ error, onRetry }: PanelErrorProps): JSX.Element {
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        height: '100%',
        padding: '16px',
        color: 'var(--color-text-secondary)',
        fontFamily: 'var(--font-mono)',
        fontSize: '12px',
        textAlign: 'center',
      }}
    >
      <span
        style={{
          color: 'var(--color-negative)',
          fontSize: '13px',
          fontWeight: 600,
        }}
      >
        ERROR
      </span>
      <span style={{ maxWidth: '320px', lineHeight: 1.6 }}>{error.message}</span>
      {onRetry !== undefined && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            marginTop: '4px',
            padding: '4px 12px',
            background: 'transparent',
            border: '1px solid var(--color-border)',
            borderRadius: '3px',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            cursor: 'pointer',
            letterSpacing: '0.05em',
          }}
        >
          RETRY
        </button>
      )}
    </div>
  );
}
