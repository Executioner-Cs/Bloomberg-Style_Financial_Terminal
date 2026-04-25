/**
 * SubscriptionManager unit tests.
 *
 * No I/O — SubscriptionManager is pure in-memory logic.
 * Tests cover: client lifecycle, subscribe/unsubscribe, cap enforcement,
 * cross-client queries (getClientsForSymbol, getSubscriberCount).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { WebSocket } from 'ws';
import { SubscriptionManager } from './subscription-manager.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Create a minimal WebSocket stub — only identity matters here. */
function makeSocket(): WebSocket {
  return {} as WebSocket;
}

function makeManager(max = 5): SubscriptionManager {
  return new SubscriptionManager(max);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SubscriptionManager', () => {
  let mgr: SubscriptionManager;
  let clientA: WebSocket;
  let clientB: WebSocket;

  beforeEach(() => {
    mgr = makeManager(3);
    clientA = makeSocket();
    clientB = makeSocket();
  });

  describe('addClient / removeClient', () => {
    it('starts with zero connections', () => {
      expect(mgr.connectionCount).toBe(0);
    });

    it('increments connectionCount on addClient', () => {
      mgr.addClient(clientA);
      expect(mgr.connectionCount).toBe(1);
    });

    it('is idempotent — double addClient does not double count', () => {
      mgr.addClient(clientA);
      mgr.addClient(clientA);
      expect(mgr.connectionCount).toBe(1);
    });

    it('removes client and returns its symbols', () => {
      mgr.addClient(clientA);
      mgr.subscribe(clientA, ['AAPL', 'MSFT']);
      const symbols = mgr.removeClient(clientA);
      expect([...symbols]).toEqual(expect.arrayContaining(['AAPL', 'MSFT']));
      expect(mgr.connectionCount).toBe(0);
    });

    it('returns empty set when removing unknown client', () => {
      const symbols = mgr.removeClient(makeSocket());
      expect([...symbols]).toHaveLength(0);
    });
  });

  describe('subscribe', () => {
    it('adds symbols and returns them as added', () => {
      mgr.addClient(clientA);
      const result = mgr.subscribe(clientA, ['AAPL', 'MSFT']);
      expect(result.added).toEqual(expect.arrayContaining(['AAPL', 'MSFT']));
      expect(result.rejected).toHaveLength(0);
    });

    it('does not double-add an already subscribed symbol', () => {
      mgr.addClient(clientA);
      mgr.subscribe(clientA, ['AAPL']);
      const result = mgr.subscribe(clientA, ['AAPL']);
      expect(result.added).toHaveLength(0);
      expect(result.rejected).toHaveLength(0);
      expect([...mgr.getSymbols(clientA)]).toHaveLength(1);
    });

    it('rejects symbols that exceed the per-connection cap', () => {
      mgr.addClient(clientA);
      mgr.subscribe(clientA, ['A', 'B', 'C']); // fills cap of 3
      const result = mgr.subscribe(clientA, ['D', 'E']);
      expect(result.rejected).toEqual(expect.arrayContaining(['D', 'E']));
      expect(result.added).toHaveLength(0);
      expect([...mgr.getSymbols(clientA)]).toHaveLength(3);
    });

    it('partially accepts symbols when partially over cap', () => {
      mgr.addClient(clientA);
      mgr.subscribe(clientA, ['A', 'B']); // 2 of 3 used
      const result = mgr.subscribe(clientA, ['C', 'D']); // C fits, D is rejected
      expect(result.added).toContain('C');
      expect(result.rejected).toContain('D');
    });

    it('auto-registers unknown client on subscribe', () => {
      // subscribe() should not throw even without an explicit addClient call
      const result = mgr.subscribe(clientA, ['AAPL']);
      expect(result.added).toContain('AAPL');
    });
  });

  describe('unsubscribe', () => {
    it('removes symbols from the subscription set', () => {
      mgr.addClient(clientA);
      mgr.subscribe(clientA, ['AAPL', 'MSFT', 'NVDA']);
      mgr.unsubscribe(clientA, ['MSFT']);
      const symbols = [...mgr.getSymbols(clientA)];
      expect(symbols).not.toContain('MSFT');
      expect(symbols).toContain('AAPL');
    });

    it('silently ignores symbols not in the subscription', () => {
      mgr.addClient(clientA);
      expect(() => mgr.unsubscribe(clientA, ['UNKNOWN'])).not.toThrow();
    });

    it('silently ignores unknown client', () => {
      expect(() => mgr.unsubscribe(makeSocket(), ['AAPL'])).not.toThrow();
    });
  });

  describe('getSubscriberCount', () => {
    it('returns 0 for a symbol no one has subscribed to', () => {
      expect(mgr.getSubscriberCount('AAPL')).toBe(0);
    });

    it('counts unique clients subscribed to a symbol', () => {
      mgr.subscribe(clientA, ['AAPL']);
      mgr.subscribe(clientB, ['AAPL']);
      expect(mgr.getSubscriberCount('AAPL')).toBe(2);
    });

    it('decrements when a client unsubscribes', () => {
      mgr.subscribe(clientA, ['AAPL']);
      mgr.subscribe(clientB, ['AAPL']);
      mgr.unsubscribe(clientA, ['AAPL']);
      expect(mgr.getSubscriberCount('AAPL')).toBe(1);
    });
  });

  describe('getAllSubscribedSymbols', () => {
    it('returns union of all client subscriptions', () => {
      mgr.subscribe(clientA, ['AAPL', 'MSFT']);
      mgr.subscribe(clientB, ['NVDA', 'MSFT']);
      const all = mgr.getAllSubscribedSymbols();
      expect([...all]).toEqual(expect.arrayContaining(['AAPL', 'MSFT', 'NVDA']));
      expect(all.size).toBe(3);
    });

    it('returns empty set when no clients', () => {
      expect(mgr.getAllSubscribedSymbols().size).toBe(0);
    });
  });

  describe('getClientsForSymbol', () => {
    it('returns all clients subscribed to a symbol', () => {
      mgr.subscribe(clientA, ['AAPL']);
      mgr.subscribe(clientB, ['AAPL']);
      const clients = mgr.getClientsForSymbol('AAPL');
      expect(clients).toContain(clientA);
      expect(clients).toContain(clientB);
    });

    it('excludes clients not subscribed to the symbol', () => {
      mgr.subscribe(clientA, ['AAPL']);
      mgr.subscribe(clientB, ['MSFT']);
      expect(mgr.getClientsForSymbol('AAPL')).not.toContain(clientB);
    });

    it('returns empty array when symbol has no subscribers', () => {
      expect(mgr.getClientsForSymbol('NONE')).toHaveLength(0);
    });
  });
});
