/**
 * WsClient unit tests.
 *
 * Uses a minimal WebSocket mock — no real networking.
 * Tests cover: disabled mode, subscribe/unsubscribe, handler dispatch,
 * and reconnect scheduling.
 *
 * The WsClient class accepts a URL in its constructor so tests can instantiate
 * it without relying on import.meta.env.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WsClient } from './ws-client';

// ── WebSocket mock ─────────────────────────────────────────────────────────────

type WsEventType = 'open' | 'message' | 'close' | 'error';
type WsListener = (ev: unknown) => void;

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState: number = MockWebSocket.CONNECTING;
  private readonly listeners = new Map<WsEventType, WsListener[]>();
  readonly sent: string[] = [];

  static instances: MockWebSocket[] = [];

  constructor(public readonly url: string) {
    MockWebSocket.instances.push(this);
  }

  addEventListener(type: WsEventType, fn: WsListener): void {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.emit('close', {});
  }

  /** Test helper — simulate the server opening the connection */
  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.emit('open', {});
  }

  /** Test helper — simulate a message from the server */
  simulateMessage(data: string): void {
    this.emit('message', { data } as MessageEvent<string>);
  }

  /** Test helper — simulate server-initiated close */
  simulateClose(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.emit('close', {});
  }

  private emit(type: WsEventType, event: unknown): void {
    for (const fn of this.listeners.get(type) ?? []) fn(event);
  }
}

// Stub global WebSocket before each test
vi.stubGlobal('WebSocket', MockWebSocket);

// ── Helpers ────────────────────────────────────────────────────────────────────

function latestSocket(): MockWebSocket {
  const s = MockWebSocket.instances.at(-1);
  if (!s) throw new Error('No MockWebSocket instances created');
  return s;
}

function priceMsg(symbol: string, price: number): string {
  return JSON.stringify({
    type: 'price',
    symbol,
    price,
    changePct: 0,
    changeAbs: 0,
    volume: 0,
    ts: Date.now(),
  });
}

function staleMsg(symbol: string): string {
  return JSON.stringify({ type: 'stale', symbol, lastTickTs: Date.now() });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('WsClient', () => {
  let client: WsClient;

  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.useFakeTimers();
    client = new WsClient('wss://mock-gateway');
  });

  afterEach(() => {
    client.destroy();
    vi.useRealTimers();
  });

  it('isEnabled is true when URL is provided', () => {
    expect(client.isEnabled).toBe(true);
  });

  it('isEnabled is false when URL is undefined', () => {
    const disabled = new WsClient(undefined);
    expect(disabled.isEnabled).toBe(false);
    disabled.destroy();
  });

  it('does not open a connection until a symbol is subscribed', () => {
    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it('opens a connection on first subscribePriceUpdates call', () => {
    client.subscribePriceUpdates('AAPL', vi.fn());
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(latestSocket().url).toBe('wss://mock-gateway');
  });

  it('does not open duplicate connections for subsequent subscribe calls', () => {
    client.subscribePriceUpdates('AAPL', vi.fn());
    latestSocket().simulateOpen();
    client.subscribePriceUpdates('MSFT', vi.fn());
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it('sends subscribe message after socket opens', () => {
    client.subscribePriceUpdates('AAPL', vi.fn());
    latestSocket().simulateOpen();
    const sent = latestSocket().sent.map((s) => JSON.parse(s) as unknown);
    expect(sent).toContainEqual({ type: 'subscribe', symbols: ['AAPL'] });
  });

  it('dispatches price events to registered handlers', () => {
    const handler = vi.fn();
    client.subscribePriceUpdates('AAPL', handler);
    const ws = latestSocket();
    ws.simulateOpen();
    ws.simulateMessage(priceMsg('AAPL', 182.5));
    expect(handler).toHaveBeenCalledOnce();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(handler.mock.calls[0]?.[0]).toMatchObject({ symbol: 'AAPL', price: 182.5 });
  });

  it('does not dispatch price events for unrelated symbols', () => {
    const handler = vi.fn();
    client.subscribePriceUpdates('AAPL', handler);
    const ws = latestSocket();
    ws.simulateOpen();
    ws.simulateMessage(priceMsg('MSFT', 415));
    expect(handler).not.toHaveBeenCalled();
  });

  it('dispatches stale events to stale handlers', () => {
    const handler = vi.fn();
    client.subscribeStale('BTC', handler);
    const ws = latestSocket();
    ws.simulateOpen();
    ws.simulateMessage(staleMsg('BTC'));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('sends unsubscribe when last price handler is removed', () => {
    const unsub = client.subscribePriceUpdates('AAPL', vi.fn());
    const ws = latestSocket();
    ws.simulateOpen();
    ws.sent.length = 0; // clear subscribe message
    unsub();
    expect(ws.sent.map((s) => JSON.parse(s) as unknown)).toContainEqual({
      type: 'unsubscribe',
      symbols: ['AAPL'],
    });
  });

  it('does not send unsubscribe if another price handler remains', () => {
    const unsub1 = client.subscribePriceUpdates('AAPL', vi.fn());
    client.subscribePriceUpdates('AAPL', vi.fn());
    const ws = latestSocket();
    ws.simulateOpen();
    ws.sent.length = 0;
    unsub1();
    const unsubMessages = ws.sent.filter((s) => {
      const p = JSON.parse(s) as { type: string };
      return p.type === 'unsubscribe';
    });
    expect(unsubMessages).toHaveLength(0);
  });

  it('schedules reconnect after socket closes', () => {
    client.subscribePriceUpdates('AAPL', vi.fn());
    const ws = latestSocket();
    ws.simulateOpen();
    ws.simulateClose();
    // Advance past BASE_RECONNECT_DELAY_MS (1000ms)
    vi.advanceTimersByTime(1_100);
    expect(MockWebSocket.instances).toHaveLength(2);
  });

  it('does not connect when disabled (no URL)', () => {
    const disabled = new WsClient(undefined);
    disabled.subscribePriceUpdates('AAPL', vi.fn());
    expect(MockWebSocket.instances).toHaveLength(0);
    disabled.destroy();
  });
});
