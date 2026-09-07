/**
 * Chromium may emit this asynchronous notification after a layout observer
 * has already completed its work. The UI contains no custom ResizeObserver;
 * prevent the browser-level notice from being reported as an app exception.
 */
export function isResizeObserverLoopMessage(message: unknown) {
  return typeof message === "string" && message.startsWith("ResizeObserver loop");
}

export function installResizeObserverGuard() {
  if (typeof window === "undefined") return;
  window.addEventListener(
    "error",
    event => {
      if (!isResizeObserverLoopMessage(event.message)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true
  );
}
