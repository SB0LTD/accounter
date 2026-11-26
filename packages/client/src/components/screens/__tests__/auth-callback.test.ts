// @vitest-environment happy-dom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '../../../router/routes.js';
import { AuthCallbackPage } from '../auth-callback.js';

const { useFirebaseAuthMock } = vi.hoisted(() => ({
  useFirebaseAuthMock: vi.fn(),
}));

vi.mock('../../../lib/firebase-auth.js', () => ({
  useFirebaseAuth: useFirebaseAuthMock,
}));

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

async function openCallback(authState: { isAuthenticated: boolean; isLoading: boolean }) {
  useFirebaseAuthMock.mockReturnValue(authState);

  const page = (text: string) => React.createElement('div', null, text);
  const router = createMemoryRouter(
    [
      { path: ROUTES.AUTH_CALLBACK, element: React.createElement(AuthCallbackPage) },
      { path: ROUTES.APP_HOME, element: page('Home Page') },
      { path: ROUTES.DOCUMENTS.ALL, element: page('Documents Page') },
      { path: ROUTES.ACCEPT_INVITATION(), element: page('Invitation Page') },
    ],
    { initialEntries: [`${ROUTES.AUTH_CALLBACK}?code=old&state=link`] },
  );

  const container = document.createElement('div');
  document.body.append(container);

  let root: Root | null = null;
  await act(async () => {
    root = createRoot(container);
    root.render(React.createElement(RouterProvider, { router }));
    await Promise.resolve();
  });

  const cleanup = async () => {
    await act(async () => {
      root?.unmount();
      await Promise.resolve();
    });
    container.remove();
  };

  return { container, router, cleanup };
}

describe('AuthCallbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('waits while the stored session loads', async () => {
    const { container, router, cleanup } = await openCallback({
      isAuthenticated: false,
      isLoading: true,
    });

    expect(router.state.location.pathname).toBe(ROUTES.AUTH_CALLBACK);
    expect(container.textContent).toContain('Processing authentication...');
    await cleanup();
  });

  it('sends a signed-in user home when nothing is stored', async () => {
    const { router, cleanup } = await openCallback({ isAuthenticated: true, isLoading: false });

    expect(router.state.location.pathname).toBe(ROUTES.APP_HOME);
    await cleanup();
  });

  it('sends a signed-in user to the stored destination, and forgets it', async () => {
    sessionStorage.setItem('auth:returnTo', ROUTES.DOCUMENTS.ALL);

    const { router, cleanup } = await openCallback({ isAuthenticated: true, isLoading: false });

    expect(router.state.location.pathname).toBe(ROUTES.DOCUMENTS.ALL);
    expect(sessionStorage.getItem('auth:returnTo')).toBeNull();
    await cleanup();
  });

  it('puts an invitation being accepted first', async () => {
    const invitation = ROUTES.ACCEPT_INVITATION('invite-token-123');
    sessionStorage.setItem('auth:returnTo', ROUTES.DOCUMENTS.ALL);
    sessionStorage.setItem('auth:invitationReturnTo', invitation);

    const { router, cleanup } = await openCallback({ isAuthenticated: true, isLoading: false });

    expect(router.state.location.pathname).toBe(invitation);
    expect(sessionStorage.getItem('auth:invitationReturnTo')).toBeNull();
    await cleanup();
  });

  it('keeps the destination for after sign-in when nobody is signed in', async () => {
    sessionStorage.setItem('auth:returnTo', ROUTES.DOCUMENTS.ALL);

    const { router, cleanup } = await openCallback({ isAuthenticated: false, isLoading: false });

    // The protected route it leads to sends the visitor on to sign in.
    expect(router.state.location.pathname).toBe(ROUTES.DOCUMENTS.ALL);
    expect(sessionStorage.getItem('auth:returnTo')).toBe(ROUTES.DOCUMENTS.ALL);
    await cleanup();
  });

  it('never follows a stored destination off the app', async () => {
    sessionStorage.setItem('auth:returnTo', '//evil.example/phish');

    const { router, cleanup } = await openCallback({ isAuthenticated: true, isLoading: false });

    expect(router.state.location.pathname).toBe(ROUTES.APP_HOME);
    await cleanup();
  });
});
