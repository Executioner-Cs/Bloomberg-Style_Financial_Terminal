/**
 * CommandPalette unit tests.
 *
 * Tests open/close behaviour and keyboard shortcuts.
 * useInstruments is mocked to isolate the component from TanStack Query.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CommandPalette from './CommandPalette';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: (): (() => void) => vi.fn(),
}));

vi.mock('@/hooks/use-instruments', () => ({
  useInstruments: (): object => ({
    data: {
      instruments: [
        {
          symbol: 'bitcoin',
          name: 'Bitcoin',
          asset_class: 'crypto',
          exchange: null,
          currency: 'USD',
        },
        {
          symbol: 'ethereum',
          name: 'Ethereum',
          asset_class: 'crypto',
          exchange: null,
          currency: 'USD',
        },
      ],
      fuse: {
        search: (q: string) =>
          q === 'bit'
            ? [
                {
                  item: {
                    symbol: 'bitcoin',
                    name: 'Bitcoin',
                    asset_class: 'crypto',
                    exchange: null,
                    currency: 'USD',
                  },
                },
              ]
            : [],
      },
    },
    isLoading: false,
  }),
}));

describe('CommandPalette', () => {
  beforeEach(() => {
    // Reset any open state between tests by triggering close if open
  });

  it('is hidden by default', () => {
    render(<CommandPalette />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens when Ctrl+K is pressed', () => {
    render(<CommandPalette />);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('prevents browser default on Ctrl+K', () => {
    render(<CommandPalette />);
    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('closes when Escape is pressed while open', () => {
    render(<CommandPalette />);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows instrument results when open', () => {
    render(<CommandPalette />);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByText('BITCOIN')).toBeInTheDocument();
    expect(screen.getByText('Bitcoin')).toBeInTheDocument();
  });

  it('renders the search input with placeholder text', () => {
    render(<CommandPalette />);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByPlaceholderText(/Search instruments/)).toBeInTheDocument();
  });
});
