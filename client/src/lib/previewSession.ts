const PREVIEW_SESSION_KEY = "build-on-works-preview-session";

/**
 * The Manus editor preview is served in an embedded *.manus.computer origin,
 * where browsers can block third-party cookies. Production domains use the
 * normal secure, HttpOnly cookie and must never share this fallback token.
 */
export function isEmbeddedPreview() {
  return typeof window !== "undefined" && window.location.hostname.endsWith(".manus.computer");
}

export function storePreviewSession(token: string) {
  if (!isEmbeddedPreview()) return;
  try {
    sessionStorage.setItem(PREVIEW_SESSION_KEY, token);
  } catch {
    // Cookie authentication remains available if sessionStorage is unavailable.
  }
}

export function getPreviewSessionToken() {
  if (!isEmbeddedPreview()) return null;
  try {
    return sessionStorage.getItem(PREVIEW_SESSION_KEY);
  } catch {
    return null;
  }
}

export function clearPreviewSession() {
  try {
    sessionStorage.removeItem(PREVIEW_SESSION_KEY);
    // Clean up the legacy key that was used before the production/preview split.
    sessionStorage.removeItem("manus-cookie");
  } catch {
    // sessionStorage unavailable
  }
}
