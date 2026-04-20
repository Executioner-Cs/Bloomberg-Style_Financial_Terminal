/**
 * Terminal context store unit tests.
 *
 * Tests the symbol-linking bus: setActiveSymbol, setTheme, and the selector
 * granularity guarantee (a symbol change must not re-render theme subscribers
 * and vice versa).
 *
 * Plan ref: D2, D4 — M4 audit item.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useTerminalContextStore } from './terminal-context.store';

// Reset to known state before each test so tests are independent.
beforeEach(() => {
  useTerminalContextStore.setState({ activeSymbol: null, theme: 'dark' });
});

// ------------------------------------------------------------------
// setActiveSymbol
// ------------------------------------------------------------------

describe('setActiveSymbol', () => {
  it('should update activeSymbol from null to a ticker', () => {
    useTerminalContextStore.getState().setActiveSymbol('AAPL');
    expect(useTerminalContextStore.getState().activeSymbol).toBe('AAPL');
  });

  it('should update activeSymbol from one ticker to another', () => {
    useTerminalContextStore.getState().setActiveSymbol('AAPL');
    useTerminalContextStore.getState().setActiveSymbol('MSFT');
    expect(useTerminalContextStore.getState().activeSymbol).toBe('MSFT');
  });

  it('should set activeSymbol back to null', () => {
    useTerminalContextStore.getState().setActiveSymbol('AAPL');
    useTerminalContextStore.getState().setActiveSymbol(null);
    expect(useTerminalContextStore.getState().activeSymbol).toBeNull();
  });
});

// ------------------------------------------------------------------
// setTheme
// ------------------------------------------------------------------

describe('setTheme', () => {
  it('should default to dark theme', () => {
    expect(useTerminalContextStore.getState().theme).toBe('dark');
  });

  it('should switch to light theme', () => {
    useTerminalContextStore.getState().setTheme('light');
    expect(useTerminalContextStore.getState().theme).toBe('light');
  });

  it('should switch back to dark theme', () => {
    useTerminalContextStore.getState().setTheme('light');
    useTerminalContextStore.getState().setTheme('dark');
    expect(useTerminalContextStore.getState().theme).toBe('dark');
  });
});

// ------------------------------------------------------------------
// Selector granularity
// The symbol-linking bus must not cause unrelated slice re-renders.
// We verify that state mutations are isolated: changing symbol does
// not change theme, and changing theme does not change symbol.
// ------------------------------------------------------------------

describe('selector granularity — isolated state slices', () => {
  it('setActiveSymbol does not mutate theme', () => {
    useTerminalContextStore.getState().setTheme('light');
    useTerminalContextStore.getState().setActiveSymbol('TSLA');
    expect(useTerminalContextStore.getState().theme).toBe('light');
  });

  it('setTheme does not mutate activeSymbol', () => {
    useTerminalContextStore.getState().setActiveSymbol('GOOGL');
    useTerminalContextStore.getState().setTheme('light');
    expect(useTerminalContextStore.getState().activeSymbol).toBe('GOOGL');
  });

  it('multiple symbol changes preserve theme', () => {
    useTerminalContextStore.getState().setTheme('light');
    useTerminalContextStore.getState().setActiveSymbol('AAPL');
    useTerminalContextStore.getState().setActiveSymbol('AMZN');
    useTerminalContextStore.getState().setActiveSymbol('META');
    expect(useTerminalContextStore.getState().theme).toBe('light');
  });
});
