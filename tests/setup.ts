import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Browser layout/animation APIs that jsdom does not implement.
Element.prototype.scrollIntoView = vi.fn();
Element.prototype.hasPointerCapture = () => false;
Element.prototype.setPointerCapture = vi.fn();
Element.prototype.releasePointerCapture = vi.fn();
window.matchMedia = vi.fn().mockImplementation(() => ({ matches: true }));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
