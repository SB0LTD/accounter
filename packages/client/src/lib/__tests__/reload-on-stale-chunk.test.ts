import { describe, expect, it, vi } from 'vitest';
import { reloadOnStaleChunk } from '../reload-on-stale-chunk.js';

function fakeWindow() {
  const target = new EventTarget();
  const store = new Map<string, string>();
  const reload = vi.fn();
  Object.assign(target, {
    sessionStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    },
    location: { reload },
  });
  return { win: target as unknown as Window, reload };
}

describe('reloadOnStaleChunk', () => {
  it('reloads when a chunk of the old build fails to load, but not again within a minute', () => {
    const { win, reload } = fakeWindow();
    reloadOnStaleChunk(win);

    const first = new Event('vite:preloadError', { cancelable: true });
    win.dispatchEvent(first);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(first.defaultPrevented).toBe(true);

    const second = new Event('vite:preloadError', { cancelable: true });
    win.dispatchEvent(second);
    expect(reload).toHaveBeenCalledTimes(1);
    // Not prevented: Vite then throws, and the route's error boundary shows the failure.
    expect(second.defaultPrevented).toBe(false);
  });
});
