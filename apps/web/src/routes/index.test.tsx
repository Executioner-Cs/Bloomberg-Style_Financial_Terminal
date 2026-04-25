/**
 * Tests for the workspace index route.
 *
 * IndexPage now renders WorkspaceShell + CommandPalette.
 * These tests verify the mount sequence: snapshot restore is attempted
 * first; if absent, the default preset is applied.
 *
 * WorkspaceShell and CommandPalette are mocked — their own tests
 * (WorkspaceShell.test.tsx, CommandPalette tests) cover their internals.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DockviewApi } from 'dockview-react';
import type * as WorkspaceModule from '@/workspace';
import type { WorkspaceSnapshot } from '@/workspace';

// ------------------------------------------------------------------
// Module mocks — vi.hoisted() ensures variables are available inside
// vi.mock factories which are hoisted to the top of the file by Vitest.
// ------------------------------------------------------------------

const { mockSwitchToPreset, mockLoadSnapshot, mockGetPresetSlugFromUrl, mockFromJSON } = vi.hoisted(
  () => ({
    mockSwitchToPreset: vi.fn<[], void>(),
    mockLoadSnapshot: vi.fn<[], WorkspaceSnapshot | null>((): WorkspaceSnapshot | null => null),
    mockGetPresetSlugFromUrl: vi.fn<[], string | null>((): string | null => null),
    mockFromJSON: vi.fn<[], void>(),
  }),
);

vi.mock('@/workspace', async (importOriginal) => {
  const original = await importOriginal<typeof WorkspaceModule>();
  return {
    ...original,
    loadSnapshot: mockLoadSnapshot,
    switchToPreset: mockSwitchToPreset,
    getPresetSlugFromUrl: mockGetPresetSlugFromUrl,
    DEFAULT_PRESET_SLUG: 'equities',
  };
});

// WorkspaceShell is mocked — dockview has its own unit tests.
// The mock fires onReady with a minimal api stub so the mount sequence runs.
vi.mock('@/workspace/WorkspaceShell', () => ({
  WorkspaceShell: ({ onReady }: { onReady?: (api: DockviewApi) => void }): JSX.Element => {
    // Fire synchronously — mirrors dockview's behaviour under jsdom.
    onReady?.({ fromJSON: mockFromJSON, clear: vi.fn() } as unknown as DockviewApi);
    return <div data-testid="workspace-shell" />;
  },
}));

// CommandPalette is mocked — it uses TanStack Query internally and has its own tests.
vi.mock('@/components/command-palette/CommandPalette', () => ({
  default: (): JSX.Element => <div data-testid="command-palette" />,
}));

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function renderWithQuery(ui: React.ReactElement): ReturnType<typeof render> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

import IndexPage from './index';

describe('IndexPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadSnapshot.mockReturnValue(null);
    mockGetPresetSlugFromUrl.mockReturnValue(null);
  });

  it('renders the workspace shell', () => {
    renderWithQuery(<IndexPage />);
    expect(screen.getByTestId('workspace-shell')).toBeInTheDocument();
  });

  it('renders the command palette overlay', () => {
    renderWithQuery(<IndexPage />);
    expect(screen.getByTestId('command-palette')).toBeInTheDocument();
  });

  it('applies the default equities preset when no snapshot and no URL param', () => {
    renderWithQuery(<IndexPage />);
    expect(mockSwitchToPreset).toHaveBeenCalledOnce();
    expect(mockSwitchToPreset).toHaveBeenCalledWith(
      'equities',
      expect.objectContaining({ fromJSON: mockFromJSON }),
    );
  });

  it('applies the URL preset slug when ?ws= param is set and no snapshot exists', () => {
    mockGetPresetSlugFromUrl.mockReturnValue('macro');
    renderWithQuery(<IndexPage />);
    expect(mockSwitchToPreset).toHaveBeenCalledWith(
      'macro',
      expect.objectContaining({ fromJSON: mockFromJSON }),
    );
  });

  it('restores from snapshot when one exists and skips preset application', () => {
    mockLoadSnapshot.mockReturnValue({
      version: 1,
      panels: {},
      layoutJson: { grid: {}, panels: {} },
    });
    renderWithQuery(<IndexPage />);
    expect(mockFromJSON).toHaveBeenCalledOnce();
    expect(mockSwitchToPreset).not.toHaveBeenCalled();
  });
});
