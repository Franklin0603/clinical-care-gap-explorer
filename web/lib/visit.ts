/**
 * Whether this browser has been to Care Gap Explorer before, for the
 * first-visit welcome on the landing page. One flag in localStorage; no
 * sign-in, no identifier, nothing sent anywhere.
 *
 * Storage that is blocked or throws counts as "visited", so a browser that
 * cannot remember the visit is never shown the welcome on every load.
 */
export const VISIT_KEY = "care-gap-explorer.visited.v1";

export function hasVisited(): boolean {
  try { return window.localStorage.getItem(VISIT_KEY) !== null; } catch { return true; }
}

export function markVisited(): void {
  try { window.localStorage.setItem(VISIT_KEY, new Date().toISOString()); } catch { /* nothing to remember with */ }
}
