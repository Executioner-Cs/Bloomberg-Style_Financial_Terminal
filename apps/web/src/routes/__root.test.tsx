/**
 * Tests for the root terminal shell layout.
 *
 * Validates that the root layout renders the terminal-shell container
 * and a main content area for route outlet.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RootLayout from './__root';

vi.mock('@tanstack/react-router', () => ({
  Outlet: (): JSX.Element => <div data-testid="outlet">outlet</div>,
}));

describe('RootLayout', () => {
  it('should render the terminal shell container', () => {
    const { container } = render(<RootLayout />);
    const shell = container.querySelector('.terminal-shell');
    expect(shell).toBeInTheDocument();
  });

  it('should render a main element for panel content', () => {
    render(<RootLayout />);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('should render the router outlet inside main', () => {
    render(<RootLayout />);
    expect(screen.getByTestId('outlet')).toBeInTheDocument();
  });
});
