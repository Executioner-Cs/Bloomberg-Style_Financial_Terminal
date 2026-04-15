/**
 * Vitest setup file — runs before each test file.
 * Imports jest-dom matchers for DOM assertions.
 *
 * ResizeObserver stub: jsdom does not implement ResizeObserver, but cmdk
 * (the command palette library) calls it internally on mount. The stub
 * satisfies the interface without doing anything — sufficient for unit tests
 * that are not testing resize behaviour.
 */
import '@testing-library/jest-dom';

/** Minimal ResizeObserver stub for jsdom — cmdk requires this API on mount. */
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (typeof window !== 'undefined' && !('ResizeObserver' in window)) {
  window.ResizeObserver = ResizeObserverStub;
}

/**
 * scrollIntoView stub: jsdom does not implement scrollIntoView. cmdk calls
 * it when focusing items in the Command.List. The noop satisfies the call
 * without needing actual layout geometry.
 */
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = (): void => {};
}
