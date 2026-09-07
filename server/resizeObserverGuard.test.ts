import { describe, expect, it } from "vitest";
import { isResizeObserverLoopMessage } from "../client/src/lib/resizeObserverGuard";

describe("ResizeObserver browser warning guard", () => {
  it("matches only the non-actionable ResizeObserver loop notification", () => {
    expect(isResizeObserverLoopMessage("ResizeObserver loop completed with undelivered notifications.")).toBe(true);
    expect(isResizeObserverLoopMessage("ResizeObserver loop limit exceeded")).toBe(true);
    expect(isResizeObserverLoopMessage("TypeError: invalid form")).toBe(false);
    expect(isResizeObserverLoopMessage(undefined)).toBe(false);
  });
});
