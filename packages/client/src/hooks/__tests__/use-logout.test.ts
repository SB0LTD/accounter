// @vitest-environment happy-dom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLogout } from '../use-logout.js';
import { ROUTES } from '../../router/routes.js';

const { useFirebaseAuthMock, logoutMock, resetClientMock, callOrder } = vi.hoisted(() => {
  const order: string[] = [];
  return {
    useFirebaseAuthMock: vi.fn(),
    logoutMock: vi.fn(() => {
      order.push('logout');
      return Promise.resolve();
    }),
    resetClientMock: vi.fn(() => {
      order.push('reset');
    }),
    callOrder: order,
  };
});

vi.mock('../../lib/firebase-auth.js', () => ({
  useFirebaseAuth: useFirebaseAuthMock,
}));

vi.mock('../../providers/urql.js', () => ({
  resetUrqlClientAndNotify: resetClientMock,
}));

function LogoutHarness(): React.ReactElement {
  const logout = useLogout();

  return React.createElement('button', { onClick: () => void logout() }, 'Log out');
}

async function renderHarness() {
  const router = createMemoryRouter(
    [
      { path: ROUTES.APP_HOME, element: React.createElement(LogoutHarness) },
      { path: ROUTES.LOGIN, element: React.createElement('div', null, 'Login Page') },
    ],
    { initialEntries: [ROUTES.APP_HOME] },
  );

  const container = document.createElement('div');
  document.body.append(container);

  let root: Root | null = null;
  await act(async () => {
    root = createRoot(container);
    root.render(React.createElement(RouterProvider, { router }));
    await Promise.resolve();
  });

  const clickLogout = async () => {
    await act(async () => {
      container
        .querySelector('button')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
  };

  const cleanup = async () => {
    await act(async () => {
      root?.unmount();
      await Promise.resolve();
    });
    container.remove();
  };

  return { router, clickLogout, cleanup };
}

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('useLogout', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    localStorage.clear();
    sessionStorage.clear();

    callOrder.length = 0;
    useFirebaseAuthMock.mockReturnValue({ logout: logoutMock });
  });

  it('discards the urql client on logout', async () => {
    const { clickLogout, cleanup } = await renderHarness();

    await clickLogout();

    expect(resetClientMock).toHaveBeenCalledTimes(1);

    await cleanup();
  });

  it('discards the client before signing out', async () => {
    // Signing out re-renders the app for a signed-out user; nothing may be served from the
    // previous user's client by then.
    const { clickLogout, cleanup } = await renderHarness();

    await clickLogout();

    expect(callOrder).toEqual(['reset', 'logout']);

    await cleanup();
  });

  it('clears what the session stored', async () => {
    sessionStorage.setItem('auth:returnTo', ROUTES.DOCUMENTS.ALL);
    const { clickLogout, cleanup } = await renderHarness();

    await clickLogout();

    expect(sessionStorage.getItem('auth:returnTo')).toBeNull();

    await cleanup();
  });

  it('signs out of Firebase, then goes to the login page', async () => {
    const { router, clickLogout, cleanup } = await renderHarness();

    await clickLogout();

    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(router.state.location.pathname).toBe(ROUTES.LOGIN);

    await cleanup();
  });
});
