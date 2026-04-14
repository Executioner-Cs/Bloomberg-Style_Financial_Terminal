/**
 * Tests for the default terminal landing page.
 *
 * Validates that the index route renders the expected terminal branding
 * and keyboard shortcut hint visible on first load.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import IndexPage from './index';

describe('IndexPage', () => {
  it('should render the terminal version string', () => {
    render(<IndexPage />);
    expect(screen.getByText(/BLOOMBERG TERMINAL v0\.0\.1/)).toBeInTheDocument();
  });

  it('should display the Ctrl+K shortcut hint', () => {
    render(<IndexPage />);
    expect(screen.getByText(/PRESS Ctrl\+K TO BEGIN/)).toBeInTheDocument();
  });
});
