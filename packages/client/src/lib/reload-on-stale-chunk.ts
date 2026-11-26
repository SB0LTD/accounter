const RELOADED_AT_KEY = 'accounter:stale-chunk-reload-at';
/** A second failure this soon after reloading is a real outage, not a deploy: don't loop. */
const MIN_RELOAD_INTERVAL_MS = 60_000;

/**
 * A tab opened before a deploy still runs the old build, and the old build's lazily loaded chunks
 * are gone from the server once the new one is published. Vite reports that as `vite:preloadError`;
 * reloading picks up the new build. Reloads at most once a minute.
 */
export function reloadOnStaleChunk(target: Window = window): void {
  target.addEventListener('vite:preloadError', event => {
    let last = 0;
    try {
      last = Number(target.sessionStorage.getItem(RELOADED_AT_KEY) ?? 0);
    } catch {
      // Storage unavailable: still reload once.
    }
    if (Date.now() - last < MIN_RELOAD_INTERVAL_MS) {
      return;
    }
    try {
      target.sessionStorage.setItem(RELOADED_AT_KEY, String(Date.now()));
    } catch {
      // Without storage there is no loop guard across the reload; one reload is still right.
    }
    event.preventDefault();
    target.location.reload();
  });
}
