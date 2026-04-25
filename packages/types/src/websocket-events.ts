/**
 * WebSocket event types — discriminated unions for all WS messages.
 * Client-to-server and server-to-client events are separated.
 */

// ---- Client → Server --------------------------------------------------------

export type SubscribeEvent = {
  type: 'subscribe';
  symbols: string[];
};

export type UnsubscribeEvent = {
  type: 'unsubscribe';
  symbols: string[];
};

export type PingEvent = {
  type: 'ping';
};

export type ClientEvent = SubscribeEvent | UnsubscribeEvent | PingEvent;

// ---- Server → Client --------------------------------------------------------

export type PriceUpdateEvent = {
  type: 'price';
  symbol: string;
  price: number;
  changePct: number;
  changeAbs: number;
  volume: number;
  ts: number;
};

export type AlertFiredEvent = {
  type: 'alert';
  alertId: string;
  symbol: string;
  message: string;
  ts: number;
};

export type NewsEvent = {
  type: 'news';
  articleId: string;
  headline: string;
  symbol: string | null;
  publishedAt: string;
};

export type ConnectedEvent = {
  type: 'connected';
  connectionId: string;
  serverTs: number;
};

export type PongEvent = {
  type: 'pong';
};

export type WsErrorEvent = {
  type: 'error';
  code: string;
  message: string;
};

/**
 * Emitted when no tick has been received for a symbol within STALE_THRESHOLD_SECONDS.
 * The client should display a visual stale badge on any panel showing this symbol.
 */
export type StaleEvent = {
  type: 'stale';
  symbol: string;
  /** Unix ms timestamp of the last tick received before staleness was declared */
  lastTickTs: number;
};

export type ServerEvent =
  | PriceUpdateEvent
  | AlertFiredEvent
  | NewsEvent
  | ConnectedEvent
  | PongEvent
  | WsErrorEvent
  | StaleEvent;
