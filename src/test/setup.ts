import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Also for the tests of the server rendering, which run without a DOM
const hasDom = typeof document !== "undefined";

afterEach(() => {
  cleanup();
  if (hasDom) localStorage.clear();
});

// Browser APIs jsdom does not implement
class ResizeObserverStub {
  disconnect() {}
  observe() {}
  unobserve() {}
}

if (hasDom) {
  globalThis.ResizeObserver ??=
    ResizeObserverStub as unknown as typeof ResizeObserver;

  Element.prototype.scrollIntoView ??= () => {};
}
