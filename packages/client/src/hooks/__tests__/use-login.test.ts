// @vitest-environment happy-dom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { useLogin } from '../use-login.js';
import { ROUTES } from '../../router/routes.js';

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

type HarnessOptions = Parameters<ReturnType<typeof useLogin>>[0];

async function clickLogin(options?: HarnessOptions) {
  function LoginHarness(): React.ReactElement {
    const login = useLogin();

    return React.createElement('button', { onClick: () => void login(options) }, 'Log in');
  }

  const router = createMemoryRouter(
    [
      { path: '/', element: React.createElement(LoginHarness) },
      { path: ROUTES.LOGIN, element: React.createElement('div', null, 'Login Page') },
    ],
    { initialEntries: ['/'] },
  );

  const container = document.createElement('div');
  document.body.append(container);

  let root: Root | null = null;
  await act(async () => {
    root = createRoot(container);
    root.render(React.createElement(RouterProvider, { router }));
    await Promise.resolve();
  });

  await act(async () => {
    container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
  });

  const cleanup = async () => {
    await act(async () => {
      root?.unmount();
      await Promise.resolve();
    });
    container.remove();
  };

  return { router, cleanup };
}

describe('useLogin', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('goes to the sign-in page, aimed at the app by default', async () => {
    const { router, cleanup } = await clickLogin();

    expect(router.state.location.pathname).toBe(ROUTES.LOGIN);
    expect(router.state.location.search).toBe('');
    expect(router.state.location.state).toEqual({ returnTo: ROUTES.APP_HOME });
    expect(sessionStorage.getItem('auth:returnTo')).toBe(ROUTES.APP_HOME);

    await cleanup();
  });

  it('honours an explicit returnTo', async () => {
    const { router, cleanup } = await clickLogin({ returnTo: ROUTES.REPORTS.VAT_MONTHLY });

    expect(router.state.location.state).toEqual({ returnTo: ROUTES.REPORTS.VAT_MONTHLY });
    expect(sessionStorage.getItem('auth:returnTo')).toBe(ROUTES.REPORTS.VAT_MONTHLY);

    await cleanup();
  });

  it('marks a re-login after an expired session', async () => {
    const { router, cleanup } = await clickLogin({ isReauth: true });

    expect(router.state.location.pathname).toBe(ROUTES.LOGIN);
    expect(router.state.location.search).toBe('?reauth=1');

    await cleanup();
  });

  it('keeps a returnTo an earlier reauth step already stored', async () => {
    sessionStorage.setItem('auth:returnTo', ROUTES.DOCUMENTS.ALL);

    const { cleanup } = await clickLogin({ returnTo: ROUTES.APP_HOME, isReauth: true });

    expect(sessionStorage.getItem('auth:returnTo')).toBe(ROUTES.DOCUMENTS.ALL);

    await cleanup();
  });
});
