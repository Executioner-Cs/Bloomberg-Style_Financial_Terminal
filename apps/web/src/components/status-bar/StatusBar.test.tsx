/**
 * StatusBar unit tests.
 *
 * Validates static content (version string, CONNECTED badge) and
 * that the UTC clock renders a time string. Timer behaviour is not
 * tested here — the interval side-effect is covered by the clock
 * format helper being pure.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import StatusBar from './StatusBar';

describe('StatusBar', () => {
  it('renders the terminal version string', () => {
    render(<StatusBar />);
    expect(screen.getByText('BLOOMBERG TERMINAL')).toBeInTheDocument();
    expect(screen.getByText('v0.0.1')).toBeInTheDocument();
  });

  it('renders the connection status badge', () => {
    render(<StatusBar />);
    expect(screen.getByText('CONNECTED')).toBeInTheDocument();
  });

  it('renders a UTC time string in the clock', () => {
    render(<StatusBar />);
    const clock = screen.getByLabelText('UTC clock');
    // Format: "YYYY-MM-DD HH:MM:SS UTC"
    expect(clock.textContent).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC$/);
  });
});
