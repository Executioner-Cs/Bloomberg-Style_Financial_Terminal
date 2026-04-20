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
        className="fixed inset-0 z-[49] bg-black/65 backdrop-blur-[2px]"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="fixed top-[18%] left-1/2 -translate-x-1/2 z-50 w-[600px] max-w-[92vw] bg-[var(--color-bg-panel)] border border-[var(--color-accent)] rounded-[4px] overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.85)]"
      >
        <Command shouldFilter={false} loop>
          {/* Search input */}
          <div className="flex items-center px-3 border-b border-[var(--color-border)]">
            <span className="text-[var(--color-accent)] text-[14px] mr-2.5 shrink-0">{'>'}</span>
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search instruments — type a symbol or name"
              className="flex-1 py-[14px] bg-transparent border-0 outline-none text-[var(--color-text-primary)] text-[13px] tracking-[0.02em]"
            />
            <kbd className="py-0.5 px-1.5 border border-[var(--color-border)] rounded-[3px] text-[var(--color-text-muted)] text-[10px] shrink-0">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <Command.List className="max-h-[340px] overflow-y-auto py-1">
            <Command.Empty className="p-6 text-center text-[var(--color-text-muted)] text-[12px]">
              No instruments found for &ldquo;{query}&rdquo;
            </Command.Empty>

            {results.map((instrument) => (
              <Command.Item
                key={instrument.symbol}
                value={instrument.symbol}
                onSelect={(): void => handleSelect(instrument)}
                className="flex items-center justify-between px-3.5 py-[9px] cursor-pointer select-none aria-selected:bg-[var(--color-bg-hover)]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[13px] font-semibold text-[var(--color-accent)] tracking-wider shrink-0 w-[120px]">
                    {instrument.symbol.toUpperCase()}
                  </span>
                  <span className="text-[12px] text-[var(--color-text-secondary)] overflow-hidden text-ellipsis whitespace-nowrap">
                    {instrument.name}
                  </span>
                </div>

                <span className="py-px px-1.5 border border-[var(--color-border)] rounded-[2px] text-[var(--color-text-muted)] text-[9px] tracking-[0.08em] shrink-0">
                  {ASSET_CLASS_LABEL[instrument.asset_class] ??
                    instrument.asset_class.toUpperCase()}
                </span>
              </Command.Item>
            ))}

            {/* Workspace group — preset switching */}
            {presetResults.length > 0 && (
              <Command.Group
                heading="Workspace"
                className={`pt-1 ${results.length > 0 ? 'border-t border-[var(--color-border)]' : ''}`}
              >
                {presetResults.map((preset) => {
                  const Icon = preset.icon;
                  return (
                    <Command.Item
                      key={preset.slug}
                      value={`workspace-preset-${preset.slug}`}
                      onSelect={(): void => handlePresetSelect(preset.slug)}
                      className="flex items-center gap-2.5 px-3.5 py-[9px] cursor-pointer select-none aria-selected:bg-[var(--color-bg-hover)]"
                    >
                      <Icon size={13} className="text-[var(--color-accent)] shrink-0" />
                      <span className="text-[13px] text-[var(--color-text-primary)] shrink-0">
                        Switch to {preset.displayName}
                      </span>
                      <span className="text-[11px] text-[var(--color-text-muted)] overflow-hidden text-ellipsis whitespace-nowrap">
                        {preset.description}
                      </span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}
          </Command.List>

          {/* Footer */}
          <div className="flex items-center justify-between px-3.5 py-1.5 border-t border-[var(--color-border)] text-[var(--color-text-muted)] text-[10px]">
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
