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

// jsdom lacks ResizeObserver; cast needed because TS Window type declares it
if (
  typeof window !== 'undefined' &&
  typeof (window as unknown as Record<string, unknown>)['ResizeObserver'] === 'undefined'
) {
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

/**
 * IntersectionObserver stub: jsdom does not implement IntersectionObserver.
 * dockview uses it to detect tab overflow; a no-op satisfies the interface
 * for unit tests where we are not asserting overflow behaviour.
 */
class IntersectionObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): [] {
    return [];
  }
  readonly root: Element | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: readonly number[] = [];
}

if (
  typeof window !== 'undefined' &&
  typeof (window as unknown as Record<string, unknown>)['IntersectionObserver'] === 'undefined'
) {
  (window as unknown as Record<string, unknown>)['IntersectionObserver'] = IntersectionObserverStub;
}

/**
 * Layout geometry stubs: jsdom returns 0 for clientWidth/Height/getBoundingClientRect,
 * which causes layout-driven libraries (dockview) to treat every container as
 * collapsed. Define non-zero defaults so dockview's initial measurement reaches
 * its post-mount state and fires onReady. We do not attempt to simulate real
 * resize behaviour — Playwright covers that end-to-end.
 */
if (typeof HTMLElement !== 'undefined') {
  const proto = HTMLElement.prototype as HTMLElement & {
    getBoundingClientRect: () => DOMRect;
  };
  const originalGetBoundingClientRect = proto.getBoundingClientRect;
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get(): number {
      return 1024;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get(): number {
      return 768;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get(): number {
      return 1024;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(): number {
      return 768;
    },
  });
  HTMLElement.prototype.getBoundingClientRect = function (): DOMRect {
    const real = originalGetBoundingClientRect?.call(this);
    // If the original returned a real rect with non-zero values, prefer it.
    if (real && (real.width > 0 || real.height > 0)) return real;
    return {
      x: 0,
      y: 0,
      width: 1024,
      height: 768,
      top: 0,
      left: 0,
      right: 1024,
      bottom: 768,
      toJSON(): object {
        return this;
      },
    } as DOMRect;
  };
}
