/**
 * ErrorBoundary — catches unhandled React render errors and shows a fallback UI.
 *
 * Per CLAUDE.md Part XVII: "Plugin crashes must not crash the terminal — all
 * code inside React Error Boundary." Applied at the root layout so a panel
 * crash shows a recovery UI rather than a blank screen.
 *
 * React class component is intentional — error boundaries cannot be
 * implemented with hooks; React requires the getDerivedStateFromError /
 * componentDidCatch lifecycle methods which are only available on classes.
 */
import { Component, type ErrorInfo, type JSX, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log full detail in development; in production a Sentry integration
    // would receive this. The raw error is NOT forwarded to API responses.
    console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  override render(): JSX.Element {
    if (this.state.hasError) {
      return (
        <div className="flex h-full items-center justify-center flex-col gap-4 select-none">
          <span className="text-[11px] font-bold tracking-[0.2em] text-[var(--color-negative)]">
            TERMINAL ERROR
          </span>
          <span className="text-[10px] tracking-wider text-[var(--color-text-muted)] max-w-[400px] text-center">
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </span>
          <button
            type="button"
            onClick={this.handleReset}
            className="py-0.5 px-3 border border-[var(--color-border)] rounded-[2px] text-[var(--color-text-secondary)] text-[11px] cursor-pointer tracking-wider hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            RETURN TO WORKSPACE
          </button>
        </div>
      );
    }

    return <>{this.props.children}</>;
  }
}
