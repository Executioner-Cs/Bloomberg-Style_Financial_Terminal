/**
 * CommandPalette — global Ctrl+K palette for instrument search and
 * workspace actions.
 *
 * Opens as a floating dialog over the terminal. Two command groups:
 *
 *   Instruments — fuzzy-search over all registered instruments via Fuse.js.
 *                 Selecting navigates to the instrument's chart page.
 *
 *   Workspace   — preset switching and panel-open actions.
 *                 "Switch to Equities/Macro/Filings Research" replaces the
 *                 current dockview layout via `switchToPreset`.
 *                 Panel-open actions are added in Stage C once panel apps
 *                 register themselves in the panel registry.
 *
 * Keyboard contract:
 *   Ctrl+K  — toggle open/close (browser default prevented)
 *   Escape  — close
 *   ↑ / ↓  — navigate results (handled by cmdk)
 *   Enter   — select focused result (handled by cmdk)
 *
 * Plan ref: B14.
 */
import { useEffect, useMemo, useState, type JSX } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from '@tanstack/react-router';
import type { InstrumentResponse } from '@terminal/types';

import { useInstruments } from '@/hooks/use-instruments';
import { listPresets, switchToPreset, getWorkspaceApi } from '@/workspace';

/** Maximum results shown when no query is typed. */
const DEFAULT_RESULT_LIMIT = 20;

/** Asset class labels shown as badges next to each result. */
const ASSET_CLASS_LABEL: Record<string, string> = {
  crypto: 'CRYPTO',
  equity: 'EQUITY',
  etf: 'ETF',
  commodity: 'CMDTY',
  forex: 'FX',
};

export default function CommandPalette(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { data } = useInstruments();

  // Preset list is static — computed once, never changes at runtime.
  const presets = useMemo(() => listPresets(), []);

  // Global Ctrl+K listener — prevents browser address-bar shortcut.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.ctrlKey && event.key === 'k') {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
      if (event.key === 'Escape' && open) {
        setOpen(false);
        setQuery('');
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return (): void => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  function handleSelect(instrument: InstrumentResponse): void {
    setOpen(false);
    setQuery('');
    void navigate({ to: '/chart/$symbol', params: { symbol: instrument.symbol } });
  }

  function handlePresetSelect(slug: string): void {
    const api = getWorkspaceApi();
    // Guard: palette may open before the workspace route is active.
    if (!api) return;
    setOpen(false);
    setQuery('');
    switchToPreset(slug, api);
  }

  function getResults(): InstrumentResponse[] {
    if (data === undefined) return [];
    if (query.trim().length === 0) {
      return data.instruments.slice(0, DEFAULT_RESULT_LIMIT);
    }
    return data.fuse.search(query).map((r) => r.item);
  }

  // Workspace preset results — show when query is empty or matches the
  // preset name / slug / keywords. Case-insensitive substring match is
  // sufficient: the preset list is tiny and always fully loaded.
  function getPresetResults(): typeof presets {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return presets;
    return presets.filter(
      (p) =>
        p.displayName.toLowerCase().includes(q) ||
        p.slug.includes(q) ||
        p.description.toLowerCase().includes(q) ||
        'preset'.includes(q) ||
        'workspace'.includes(q) ||
        'switch'.includes(q),
    );
  }

  const results = getResults();
  const presetResults = getPresetResults();

  if (!open) return <></>;

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={(): void => {
          setOpen(false);
          setQuery('');
        }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 49,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        style={{
          position: 'fixed',
          top: '18%',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          width: '600px',
          maxWidth: '92vw',
          background: 'var(--color-bg-panel)',
          border: '1px solid var(--color-accent)',
          borderRadius: '4px',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.85)',
        }}
      >
        <Command shouldFilter={false} loop>
          {/* Search input */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0 12px',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <span
              style={{
                color: 'var(--color-accent)',
                fontFamily: 'var(--font-mono)',
                fontSize: '14px',
                marginRight: '10px',
                flexShrink: 0,
              }}
            >
              {'>'}
            </span>
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search instruments — type a symbol or name"
              style={{
                flex: 1,
                padding: '14px 0',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                letterSpacing: '0.02em',
              }}
            />
            <kbd
              style={{
                padding: '2px 6px',
                border: '1px solid var(--color-border)',
                borderRadius: '3px',
                color: 'var(--color-text-muted)',
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                flexShrink: 0,
              }}
            >
              ESC
            </kbd>
          </div>

          {/* Results */}
          <Command.List
            style={{
              maxHeight: '340px',
              overflowY: 'auto',
              padding: '4px 0',
            }}
          >
            <Command.Empty
              style={{
                padding: '24px',
                textAlign: 'center',
                color: 'var(--color-text-muted)',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
              }}
            >
              No instruments found for &ldquo;{query}&rdquo;
            </Command.Empty>

            {results.map((instrument) => (
              <Command.Item
                key={instrument.symbol}
                value={instrument.symbol}
                onSelect={(): void => handleSelect(instrument)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 14px',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
                // cmdk sets data-selected on the focused item
                data-selected-style={{
                  background: 'var(--color-bg-hover)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--color-accent)',
                      letterSpacing: '0.05em',
                      flexShrink: 0,
                      width: '120px',
                    }}
                  >
                    {instrument.symbol.toUpperCase()}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      color: 'var(--color-text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {instrument.name}
                  </span>
                </div>

                <span
                  style={{
                    padding: '1px 6px',
                    border: '1px solid var(--color-border)',
                    borderRadius: '2px',
                    color: 'var(--color-text-muted)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '9px',
                    letterSpacing: '0.08em',
                    flexShrink: 0,
                  }}
                >
                  {ASSET_CLASS_LABEL[instrument.asset_class] ??
                    instrument.asset_class.toUpperCase()}
                </span>
              </Command.Item>
            ))}

            {/* Workspace group — preset switching */}
            {presetResults.length > 0 && (
              <Command.Group
                heading="Workspace"
                style={{
                  paddingTop: '4px',
                  borderTop: results.length > 0 ? '1px solid var(--color-border)' : undefined,
                }}
              >
                {presetResults.map((preset) => {
                  const Icon = preset.icon;
                  return (
                    <Command.Item
                      key={preset.slug}
                      value={`workspace-preset-${preset.slug}`}
                      onSelect={(): void => handlePresetSelect(preset.slug)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '9px 14px',
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}
                    >
                      <Icon size={13} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '13px',
                          color: 'var(--color-text-primary)',
                          flexShrink: 0,
                        }}
                      >
                        Switch to {preset.displayName}
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          color: 'var(--color-text-muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {preset.description}
                      </span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}
          </Command.List>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 14px',
              borderTop: '1px solid var(--color-border)',
              color: 'var(--color-text-muted)',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
            }}
          >
            <span>
              {results.length} instrument{results.length !== 1 ? 's' : ''}
              {query.length === 0 ? ' · type to search' : ''}
            </span>
            <span>↑↓ navigate · Enter select</span>
          </div>
        </Command>
      </div>
    </>
  );
}
