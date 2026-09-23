import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

// Browser APIs jsdom does not implement
class ResizeObserverStub {
  disconnect() {}
  observe() {}
  unobserve() {}
}

globalThis.ResizeObserver ??=
  ResizeObserverStub as unknown as typeof ResizeObserver;

Element.prototype.scrollIntoView ??= () => {};
