// @vitest-environment happy-dom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LandingRoute } from '../../router/guards/auth-guards.js';
import { ROUTES } from '../../router/routes.js';

const { useFirebaseAuthMock, hasStoredFirebaseSessionMock } = vi.hoisted(() => ({
  useFirebaseAuthMock: vi.fn(),
  hasStoredFirebaseSessionMock: vi.fn(),
}));

vi.mock('../../lib/firebase-auth.js', () => ({
  useFirebaseAuth: useFirebaseAuthMock,
  hasStoredFirebaseSession: hasStoredFirebaseSessionMock,
}));

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

type AuthState = {
  isAuthenticated: boolean;
  isLoading: boolean;
};

async function renderRoot(authState: AuthState, hasStoredSession = false) {
  useFirebaseAuthMock.mockReturnValue(authState);
  hasStoredFirebaseSessionMock.mockReturnValue(hasStoredSession);

  const router = createMemoryRouter(
    [
      {
        path: ROUTES.HOME,
        element: React.createElement(
          LandingRoute,
          null,
          React.createElement('div', null, 'Landing Page'),
        ),
      },
      {
        path: ROUTES.APP_HOME,
        element: React.createElement('div', null, 'Charges Page'),
      },
    ],
    { initialEntries: [ROUTES.HOME] },
  );

  const container = document.createElement('div');
  document.body.append(container);

  let root: Root | null = null;
  await act(async () => {
    root = createRoot(container);
    root.render(React.createElement(RouterProvider, { router }));
    await Promise.resolve();
  });

  const html = container.innerHTML;

  const cleanup = async () => {
    await act(async () => {
      root?.unmount();
      await Promise.resolve();
    });
    container.remove();
  };

  return { html, router, cleanup };
}

describe('LandingRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the landing page to an unauthenticated visitor', async () => {
    const { html, router, cleanup } = await renderRoot({
      isAuthenticated: false,
      isLoading: false,
    });

    expect(router.state.location.pathname).toBe(ROUTES.HOME);
    expect(html).toContain('Landing Page');
    await cleanup();
  });

  it('sends an authenticated user into the app', async () => {
    const { html, router, cleanup } = await renderRoot({
      isAuthenticated: true,
      isLoading: false,
    });

    expect(router.state.location.pathname).toBe(ROUTES.APP_HOME);
    expect(html).not.toContain('Landing Page');
    await cleanup();
  });

  it('paints immediately while Firebase loads when there is no stored session', async () => {
    const { html, router, cleanup } = await renderRoot(
      { isAuthenticated: false, isLoading: true },
      false,
    );

    // A first-time visitor must not wait for Firebase to load to read the page.
    expect(html).toContain('Landing Page');
    expect(router.state.location.pathname).toBe(ROUTES.HOME);
    await cleanup();
  });

  it('holds the landing page back while a cached session resolves', async () => {
    const { html, cleanup } = await renderRoot({ isAuthenticated: false, isLoading: true }, true);

    // A redirect into the app is coming, so showing marketing copy first would flash.
    expect(html).not.toContain('Landing Page');
    await cleanup();
  });
});
