/**
 * SubscriptionManager — tracks which symbols each connected client has subscribed to.
 *
 * Design invariants:
 * - One Map entry per live WebSocket client.
 * - Per-connection symbol cap enforced at add() time (MAX_SUBSCRIPTIONS_PER_CONNECTION).
 * - All operations are synchronous — no I/O in this module.
 * - Clients are identified by their WebSocket object reference (Map key).
 */
import type { WebSocket } from 'ws';

export type AddResult = {
  /** Symbols successfully added to the subscription set */
  added: string[];
  /** Symbols rejected because the cap would be exceeded */
  rejected: string[];
};

export class SubscriptionManager {
  private readonly subscriptions = new Map<WebSocket, Set<string>>();
  private readonly maxPerConnection: number;

  constructor(maxPerConnection: number) {
    this.maxPerConnection = maxPerConnection;
  }

  /**
   * Register a new client. Must be called once when the connection opens.
   * Idempotent — safe to call again on an existing client.
   */
  addClient(client: WebSocket): void {
    if (!this.subscriptions.has(client)) {
      this.subscriptions.set(client, new Set());
    }
  }

  /**
   * Remove a client and return the set of symbols it had subscribed to.
   * The caller is responsible for triggering any upstream unsubscribes when
   * a symbol's subscriber count drops to zero.
   */
  removeClient(client: WebSocket): Set<string> {
    const symbols = this.subscriptions.get(client) ?? new Set<string>();
    this.subscriptions.delete(client);
    return symbols;
  }

  /**
   * Subscribe a client to one or more symbols.
   * Symbols that would push the connection over the cap go into `rejected`.
   */
  subscribe(client: WebSocket, symbols: string[]): AddResult {
    if (!this.subscriptions.has(client)) {
      this.subscriptions.set(client, new Set());
    }
    const current = this.subscriptions.get(client) as Set<string>;
    const added: string[] = [];
    const rejected: string[] = [];

    for (const symbol of symbols) {
      if (current.has(symbol)) {
        // Already subscribed — not an error, not counted as added
        continue;
      }
      if (current.size >= this.maxPerConnection) {
        rejected.push(symbol);
      } else {
        current.add(symbol);
        added.push(symbol);
      }
    }

    return { added, rejected };
  }

  /**
   * Unsubscribe a client from one or more symbols.
   * Silently ignores symbols the client was not subscribed to.
   */
  unsubscribe(client: WebSocket, symbols: string[]): void {
    const current = this.subscriptions.get(client);
    if (current === undefined) return;
    for (const symbol of symbols) {
      current.delete(symbol);
    }
  }

  /** Return an immutable view of the symbols a client is subscribed to. */
  getSymbols(client: WebSocket): ReadonlySet<string> {
    return this.subscriptions.get(client) ?? new Set<string>();
  }

  /** Count how many live clients are subscribed to a symbol. */
  getSubscriberCount(symbol: string): number {
    let count = 0;
    for (const symbols of this.subscriptions.values()) {
      if (symbols.has(symbol)) count++;
    }
    return count;
  }

  /** Return all unique symbols with at least one subscriber. */
  getAllSubscribedSymbols(): Set<string> {
    const all = new Set<string>();
    for (const symbols of this.subscriptions.values()) {
      for (const s of symbols) all.add(s);
    }
    return all;
  }

  /** Return all clients currently subscribed to a symbol. */
  getClientsForSymbol(symbol: string): WebSocket[] {
    const clients: WebSocket[] = [];
    for (const [client, symbols] of this.subscriptions) {
      if (symbols.has(symbol)) clients.push(client);
    }
    return clients;
  }

  /** Total number of live connections tracked. */
  get connectionCount(): number {
    return this.subscriptions.size;
  }
}
