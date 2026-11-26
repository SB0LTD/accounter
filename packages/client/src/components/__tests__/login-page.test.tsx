import { act, useSyncExternalStore } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicOnlyGuard } from '../../router/guards/auth-guards.js';
import { ROUTES } from '../../router/routes.js';
import { LoginPage } from '../login-page.js';

/**
 * The sign-in page as the app mounts it, behind `PublicOnlyGuard`, over a stand-in for the
 * Firebase layer whose auth state a test can change, as a real sign-in does.
 */

type AuthState = { isLoading: boolean; isAuthenticated: boolean };

const { authStore, actions } = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  let state = { isLoading: false, isAuthenticated: false };
  return {
    authStore: {
      get: () => state,
      set(next: { isLoading: boolean; isAuthenticated: boolean }) {
        state = next;
        for (const listener of listeners) listener();
      },
      subscribe(listener: () => void) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    actions: {
      signInWithGoogle: vi.fn<() => Promise<void>>(),
      signInWithEmail: vi.fn<(email: string, password: string) => Promise<void>>(),
      sendPasswordReset: vi.fn<(email: string) => Promise<void>>(),
    },
  };
});

vi.mock('../../lib/firebase-auth.js', () => ({
  useFirebaseAuth: () => ({
    ...useSyncExternalStore(authStore.subscribe, authStore.get),
    ...actions,
  }),
  hasStoredFirebaseSession: () => false,
}));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function firebaseError(code: string) {
  return Object.assign(new Error(`Firebase: Error (${code}).`), { code });
}

let root: Root | null = null;
let container: HTMLDivElement;

async function openLogin(
  { search = '', state }: { search?: string; state?: { returnTo: string } } = {},
  auth: AuthState = { isLoading: false, isAuthenticated: false },
) {
  authStore.set(auth);
  const page = (text: string) => <div>{text}</div>;
  const router = createMemoryRouter(
    [
      {
        path: ROUTES.LOGIN,
        element: (
          <PublicOnlyGuard>
            <LoginPage />
          </PublicOnlyGuard>
        ),
      },
      { path: ROUTES.APP_HOME, element: page('Home Page') },
      { path: ROUTES.DOCUMENTS.ALL, element: page('Documents Page') },
      { path: ROUTES.ACCEPT_INVITATION(), element: page('Invitation Page') },
    ],
    { initialEntries: [{ pathname: ROUTES.LOGIN, search, state }] },
  );

  container = document.createElement('div');
  document.body.append(container);
  await act(async () => {
    root = createRoot(container);
    root.render(<RouterProvider router={router} />);
  });
  return router;
}

/** Lets the form's async validation and the sign-in promise settle. */
async function settle() {
  await act(async () => {
    for (let tick = 0; tick < 5; tick += 1) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  });
}

function button(label: RegExp): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll('button')).find(candidate =>
    label.test(candidate.textContent ?? ''),
  );
  if (!found) {
    throw new Error(`No button matching ${label}`);
  }
  return found;
}

function input(type: 'email' | 'password'): HTMLInputElement {
  const found = container.querySelector<HTMLInputElement>(`input[type="${type}"]`);
  if (!found) {
    throw new Error(`No ${type} input`);
  }
  return found;
}

/** Types into a React-controlled input the way a user does. */
function typeInto(element: HTMLInputElement, value: string) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setValue?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

async function click(element: HTMLElement) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await settle();
}

async function submitEmailForm(email: string, password: string) {
  await act(async () => {
    typeInto(input('email'), email);
    typeInto(input('password'), password);
  });
  await act(async () => {
    container
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await settle();
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  actions.signInWithGoogle.mockResolvedValue(undefined);
  actions.signInWithEmail.mockResolvedValue(undefined);
  actions.sendPasswordReset.mockResolvedValue(undefined);
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
  container.remove();
});

describe('LoginPage', () => {
  it('offers Google, email and password, and a way to reset the password', async () => {
    await openLogin();

    expect(button(/continue with google/i)).toBeTruthy();
    expect(input('email')).toBeTruthy();
    expect(input('password')).toBeTruthy();
    expect(button(/^sign in$/i)).toBeTruthy();
    expect(button(/forgot password/i)).toBeTruthy();
    expect(container.textContent).not.toContain('Your session expired');
  });

  it('signs in with Google, then goes back to the page that asked for sign-in', async () => {
    actions.signInWithGoogle.mockImplementation(async () => {
      authStore.set({ isLoading: false, isAuthenticated: true });
    });
    const router = await openLogin({ state: { returnTo: ROUTES.DOCUMENTS.ALL } });

    await click(button(/continue with google/i));

    expect(actions.signInWithGoogle).toHaveBeenCalledTimes(1);
    expect(router.state.location.pathname).toBe(ROUTES.DOCUMENTS.ALL);
  });

  it('says so when the Google window is closed', async () => {
    actions.signInWithGoogle.mockRejectedValue(firebaseError('auth/popup-closed-by-user'));
    const router = await openLogin();

    await click(button(/continue with google/i));

    expect(container.textContent).toContain('Sign-in failed');
    expect(container.textContent).toContain('closed before sign-in finished');
    expect(router.state.location.pathname).toBe(ROUTES.LOGIN);
    // The buttons are usable again for another try.
    expect(button(/continue with google/i).disabled).toBe(false);
  });

  it('signs in with email and password, then goes home', async () => {
    actions.signInWithEmail.mockImplementation(async () => {
      authStore.set({ isLoading: false, isAuthenticated: true });
    });
    const router = await openLogin();

    await submitEmailForm('member@example.com', 'correct horse');

    expect(actions.signInWithEmail).toHaveBeenCalledWith('member@example.com', 'correct horse');
    expect(router.state.location.pathname).toBe(ROUTES.APP_HOME);
  });

  it.each([
    ['auth/wrong-password', 'Incorrect password'],
    ['auth/user-not-found', 'No account uses this email address'],
    ['auth/invalid-credential', 'Incorrect email or password'],
  ])('explains a failed email sign-in (%s)', async (code, message) => {
    actions.signInWithEmail.mockRejectedValue(firebaseError(code));
    const router = await openLogin();

    await submitEmailForm('member@example.com', 'wrong');

    expect(container.textContent).toContain(message);
    expect(router.state.location.pathname).toBe(ROUTES.LOGIN);
  });

  it('asks for the missing fields without calling Firebase', async () => {
    await openLogin();

    await submitEmailForm('', '');

    expect(container.textContent).toContain('Enter your email address.');
    expect(container.textContent).toContain('Enter your password.');
    expect(actions.signInWithEmail).not.toHaveBeenCalled();
  });

  it('rejects a malformed email address without calling Firebase', async () => {
    await openLogin();

    await submitEmailForm('not-an-email', 'secret');

    expect(container.textContent).toContain('Enter a valid email address.');
    expect(actions.signInWithEmail).not.toHaveBeenCalled();
  });

  it('sends the password reset email for the address already typed', async () => {
    await openLogin();
    await act(async () => {
      typeInto(input('email'), 'member@example.com');
    });

    await click(button(/forgot password/i));

    expect(container.textContent).toContain('Reset your password');
    expect(input('email').value).toBe('member@example.com');
    expect(container.querySelector('input[type="password"]')).toBeNull();

    await act(async () => {
      container
        .querySelector('form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await settle();

    expect(actions.sendPasswordReset).toHaveBeenCalledWith('member@example.com');
    expect(container.textContent).toContain('Check your email');

    await click(button(/back to sign in/i));
    expect(input('password')).toBeTruthy();
  });

  it('explains a reset email that could not be sent', async () => {
    actions.sendPasswordReset.mockRejectedValue(firebaseError('auth/too-many-requests'));
    await openLogin();
    await click(button(/forgot password/i));

    await act(async () => {
      typeInto(input('email'), 'member@example.com');
    });
    await act(async () => {
      container
        .querySelector('form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await settle();

    expect(container.textContent).toContain('Could not send the email');
    expect(container.textContent).toContain('Too many attempts');
    expect(container.textContent).not.toContain('Check your email');
  });

  it('takes a signed-in user straight on, to an invitation being accepted first', async () => {
    const invitation = ROUTES.ACCEPT_INVITATION('invite-token-123');
    sessionStorage.setItem('auth:invitationReturnTo', invitation);

    const router = await openLogin(
      { state: { returnTo: ROUTES.DOCUMENTS.ALL } },
      { isLoading: false, isAuthenticated: true },
    );

    expect(router.state.location.pathname).toBe(invitation);
  });

  describe('after an expired session (?reauth=1)', () => {
    it('says the session expired', async () => {
      await openLogin({ search: '?reauth=1' });

      expect(container.textContent).toContain('Your session expired. Please sign in again.');
    });

    it('returns to the stored page once signed in again', async () => {
      sessionStorage.setItem('auth:returnTo', ROUTES.DOCUMENTS.ALL);
      actions.signInWithGoogle.mockImplementation(async () => {
        authStore.set({ isLoading: false, isAuthenticated: true });
      });
      const router = await openLogin({ search: '?reauth=1' });

      await click(button(/continue with google/i));

      expect(router.state.location.pathname).toBe(ROUTES.DOCUMENTS.ALL);
      expect(sessionStorage.getItem('auth:returnTo')).toBeNull();
    });

    it('stays on the page when signing in again fails', async () => {
      actions.signInWithGoogle.mockRejectedValue(firebaseError('auth/popup-blocked'));
      const router = await openLogin({ search: '?reauth=1' });

      await click(button(/continue with google/i));

      expect(router.state.location.pathname).toBe(ROUTES.LOGIN);
      expect(container.textContent).toContain('Allow pop-ups for this site');
    });
  });
});
