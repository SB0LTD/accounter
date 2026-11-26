import { act, useSyncExternalStore } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccessTokenProvider } from '../urql.js';
import { FirebaseUrqlTokenBridge } from '../firebase-token-bridge.js';

type AuthState = {
  isLoading: boolean;
  user: { uid: string } | null;
  getIdToken: (options?: { forceRefresh?: boolean }) => Promise<string | null>;
};

const { authStore, setProviderMock, resetClientMock } = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  let state: AuthState;
  return {
    authStore: {
      get: () => state,
      set(next: AuthState) {
        state = next;
        for (const listener of listeners) listener();
      },
      subscribe(listener: () => void) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    setProviderMock: vi.fn<(provider: AccessTokenProvider | null) => void>(),
    resetClientMock: vi.fn(),
  };
});

vi.mock('../../lib/firebase-auth.js', () => ({
  useFirebaseAuth: () => useSyncExternalStore(authStore.subscribe, authStore.get),
}));

vi.mock('../urql.js', () => ({
  setUrqlAccessTokenProvider: setProviderMock,
  resetUrqlClientAndNotify: resetClientMock,
}));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getIdToken = vi.fn<AuthState['getIdToken']>();

function setAuth(isLoading: boolean, uid: string | null) {
  authStore.set({ isLoading, user: uid ? { uid } : null, getIdToken });
}

let root: Root | null = null;
let container: HTMLDivElement;

async function mount() {
  container = document.createElement('div');
  document.body.append(container);
  await act(async () => {
    root = createRoot(container);
    root.render(
      <FirebaseUrqlTokenBridge>
        <div>App</div>
      </FirebaseUrqlTokenBridge>,
    );
  });
}

async function change(isLoading: boolean, uid: string | null) {
  await act(async () => {
    setAuth(isLoading, uid);
  });
}

/** The provider the bridge registered last. */
function registeredProvider(): AccessTokenProvider | null {
  const calls = setProviderMock.mock.calls;
  return calls[calls.length - 1]?.[0] ?? null;
}

beforeEach(() => {
  vi.clearAllMocks();
  setAuth(true, null);
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
  container.remove();
});

describe('FirebaseUrqlTokenBridge', () => {
  it('renders the app', async () => {
    await mount();

    expect(container.textContent).toBe('App');
  });

  it('registers a token provider that sends the Firebase ID token as the bearer', async () => {
    getIdToken.mockResolvedValue('id-token');
    await mount();

    const provider = registeredProvider();
    expect(provider).not.toBeNull();
    await expect(provider!()).resolves.toEqual({ status: 'token', token: 'id-token' });
  });

  it('maps "nobody signed in" to unauthenticated', async () => {
    getIdToken.mockResolvedValue(null);
    await mount();

    await expect(registeredProvider()!()).resolves.toEqual({ status: 'unauthenticated' });
  });

  it('forces a token refresh when the client asks past its cache', async () => {
    getIdToken.mockResolvedValue('fresh-token');
    await mount();

    await registeredProvider()!({ cacheMode: 'off' });

    expect(getIdToken).toHaveBeenCalledWith({ forceRefresh: true });
  });

  it('keeps the client on the first answer after a page load', async () => {
    await mount();
    await change(false, 'uid-1');

    expect(resetClientMock).not.toHaveBeenCalled();
  });

  it('keeps the client for a visitor who loads signed out', async () => {
    await mount();
    await change(false, null);

    expect(resetClientMock).not.toHaveBeenCalled();
  });

  it('hands the app a fresh client when someone signs in without a page load', async () => {
    await mount();
    await change(false, null);

    await change(false, 'uid-1');

    expect(resetClientMock).toHaveBeenCalledTimes(1);
  });

  it('hands the app a fresh client for another user, and on sign-out', async () => {
    await mount();
    await change(false, 'uid-1');

    await change(false, 'uid-2');
    expect(resetClientMock).toHaveBeenCalledTimes(1);

    await change(false, null);
    expect(resetClientMock).toHaveBeenCalledTimes(2);
  });

  it('keeps the client when the same user comes back with a refreshed token', async () => {
    await mount();
    await change(false, 'uid-1');

    await change(false, 'uid-1');

    expect(resetClientMock).not.toHaveBeenCalled();
  });

  it('unregisters the token provider when it unmounts', async () => {
    await mount();

    await act(async () => {
      root?.unmount();
    });
    root = null;

    expect(registeredProvider()).toBeNull();
  });
});
