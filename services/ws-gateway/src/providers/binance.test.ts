/**
 * Binance provider helper unit tests.
 *
 * Tests isCryptoSymbol and toBinancePair without any I/O.
 * BinanceProvider itself requires a live WebSocket — tested via integration.
 */
import { describe, it, expect } from 'vitest';
import { isCryptoSymbol, toBinancePair } from './binance.js';

describe('isCryptoSymbol', () => {
  it('returns true for known crypto tickers', () => {
    expect(isCryptoSymbol('BTC')).toBe(true);
    expect(isCryptoSymbol('ETH')).toBe(true);
    expect(isCryptoSymbol('SOL')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isCryptoSymbol('btc')).toBe(true);
    expect(isCryptoSymbol('Eth')).toBe(true);
  });

  it('returns false for equity tickers', () => {
    expect(isCryptoSymbol('AAPL')).toBe(false);
    expect(isCryptoSymbol('MSFT')).toBe(false);
    expect(isCryptoSymbol('NVDA')).toBe(false);
  });

  it('returns false for unknown symbols', () => {
    expect(isCryptoSymbol('UNKNOWN')).toBe(false);
    expect(isCryptoSymbol('')).toBe(false);
  });
});

describe('toBinancePair', () => {
  it('lowercases and appends usdt', () => {
    expect(toBinancePair('BTC')).toBe('btcusdt');
    expect(toBinancePair('ETH')).toBe('ethusdt');
  });

  it('handles already-lowercase input', () => {
    expect(toBinancePair('sol')).toBe('solusdt');
  });
});
