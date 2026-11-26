import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FirebaseAuthProvider,
  hasStoredFirebaseSession,
  readFirebaseConfig,
  useFirebaseAuth,
  type FirebaseAuthContextValue,
} from '../firebase-auth.js';

// The module reads its config when Firebase is first used, so it is set before anything runs.
vi.hoisted(() => {
  vi.stubEnv('VITE_FIREBASE_API_KEY', 'test-api-key');
  vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'test-project.firebaseapp.com');
  vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'test-project');
  vi.stubEnv('VITE_FIREBASE_APP_ID', '1:1:web:1');
});

type FakeUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
};

const fb = vi.hoisted(() => {
  const listeners = new Set<(user: unknown) => void>();
  const auth = {
    currentUser: null as unknown,
    authStateReady: vi.fn(async () => {}),
  };
  return {
    auth,
    listeners,
    initializeApp: vi.fn((options: unknown) => ({ name: '[DEFAULT]', options })),
    initializeAuth: vi.fn((_app: unknown, _deps: unknown) => auth),
    onIdTokenChanged: vi.fn((_auth: unknown, next: (user: unknown) => void) => {
      listeners.add(next);
      return () => listeners.delete(next);
    }),
    signInWithPopup: vi.fn(async (_auth: unknown, _provider: unknown) => ({})),
    signInWithEmailAndPassword: vi.fn(async (_auth: unknown, _email: string, _password: string) => ({})),
    sendPasswordResetEmail: vi.fn(async (_auth: unknown, _email: string) => {}),
    signOut: vi.fn(async (_auth: unknown) => {}),
    setCustomParameters: vi.fn(),
  };
});

vi.mock('firebase/app', () => ({
  getApps: () => [],
  getApp: () => {
    throw new Error('no app');
  },
  initializeApp: fb.initializeApp,
}));

vi.mock('firebase/auth', () => ({
  browserLocalPersistence: 'browserLocalPersistence',
  browserPopupRedirectResolver: 'browserPopupRedirectResolver',
  getAuth: () => fb.auth,
  initializeAuth: fb.initializeAuth,
  onIdTokenChanged: fb.onIdTokenChanged,
  signInWithPopup: fb.signInWithPopup,
  signInWithEmailAndPassword: fb.signInWithEmailAndPassword,
  sendPasswordResetEmail: fb.sendPasswordResetEmail,
  signOut: fb.signOut,
  GoogleAuthProvider: class {
    setCustomParameters = fb.setCustomParameters;
  },
}));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function fakeUser(overrides: Partial<FakeUser> = {}): FakeUser {
  return {
    uid: 'uid-1',
    email: 'member@example.com',
    displayName: 'Member One',
    photoURL: 'https://example.com/member.png',
    emailVerified: true,
    getIdToken: vi.fn(async (forceRefresh?: boolean) => (forceRefresh ? 'fresh-token' : 'token')),
    ...overrides,
  };
}

/** What Firebase reports: the stored session read, a sign-in, a sign-out or a token refresh. */
async function emit(user: FakeUser | null) {
  fb.auth.currentUser = user;
  await act(async () => {
    for (const listener of fb.listeners) {
      listener(user);
    }
  });
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let seen: FirebaseAuthContextValue[] = [];

function Probe(): ReactElement | null {
  seen.push(useFirebaseAuth());
  return null;
}

const latest = () => seen[seen.length - 1];

async function mount() {
  const element = document.createElement('div');
  container = element;
  document.body.append(element);
  await act(async () => {
    root = createRoot(element);
    root.render(
      <FirebaseAuthProvider>
        <Probe />
      </FirebaseAuthProvider>,
    );
  });
}

beforeEach(() => {
  seen = [];
  fb.auth.currentUser = null;
  localStorage.clear();
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
  container?.remove();
  container = null;
  vi.clearAllMocks();
});

describe('FirebaseAuthProvider', () => {
  it('starts Firebase with local persistence and the popup resolver', async () => {
    await mount();

    expect(fb.initializeApp).toHaveBeenCalledWith({
      apiKey: 'test-api-key',
      authDomain: 'test-project.firebaseapp.com',
      projectId: 'test-project',
      appId: '1:1:web:1',
    });
    // Created once, on first use: later tests see the instance this one created.
    expect(fb.initializeAuth).toHaveBeenCalledWith(expect.anything(), {
      persistence: 'browserLocalPersistence',
      popupRedirectResolver: 'browserPopupRedirectResolver',
    });
  });

  it('is loading until Firebase has read the stored session', async () => {
    await mount();

    expect(latest().isLoading).toBe(true);
    expect(latest().isAuthenticated).toBe(false);

    await emit(null);

    expect(latest().isLoading).toBe(false);
    expect(latest().isAuthenticated).toBe(false);
    expect(latest().user).toBeNull();
  });

  it('follows the signed-in user', async () => {
    await mount();
    await emit(fakeUser());

    expect(latest().isLoading).toBe(false);
    expect(latest().isAuthenticated).toBe(true);
    expect(latest().user).toEqual({
      uid: 'uid-1',
      email: 'member@example.com',
      name: 'Member One',
      picture: 'https://example.com/member.png',
      emailVerified: true,
    });

    await emit(null);

    expect(latest().isAuthenticated).toBe(false);
    expect(latest().user).toBeNull();
  });

  it('keeps the same user object across token refreshes', async () => {
    await mount();
    await emit(fakeUser());
    const before = latest().user;
    const renders = seen.length;

    await emit(fakeUser());

    expect(latest().user).toBe(before);
    expect(seen.length).toBe(renders);
  });
});

describe('useFirebaseAuth actions', () => {
  it('signs in with Google in a popup, offering the account chooser', async () => {
    await mount();
    await emit(null);

    await latest().signInWithGoogle();

    expect(fb.setCustomParameters).toHaveBeenCalledWith({ prompt: 'select_account' });
    expect(fb.signInWithPopup).toHaveBeenCalledWith(fb.auth, expect.anything());
  });

  it('signs in with email and password, trimming the email', async () => {
    await mount();

    await latest().signInWithEmail('  member@example.com ', 'secret pass ');

    expect(fb.signInWithEmailAndPassword).toHaveBeenCalledWith(
      fb.auth,
      'member@example.com',
      'secret pass ',
    );
  });

  it('sends the password reset email', async () => {
    await mount();

    await latest().sendPasswordReset(' member@example.com');

    expect(fb.sendPasswordResetEmail).toHaveBeenCalledWith(fb.auth, 'member@example.com');
  });

  it('signs out', async () => {
    await mount();

    await latest().logout();

    expect(fb.signOut).toHaveBeenCalledWith(fb.auth);
  });

  it('hands out the ID token once the stored session is read, refreshed on request', async () => {
    await mount();
    const user = fakeUser();
    fb.auth.currentUser = user;

    await expect(latest().getIdToken()).resolves.toBe('token');
    await expect(latest().getIdToken({ forceRefresh: true })).resolves.toBe('fresh-token');

    expect(fb.auth.authStateReady).toHaveBeenCalled();
    expect(user.getIdToken).toHaveBeenNthCalledWith(1, false);
    expect(user.getIdToken).toHaveBeenNthCalledWith(2, true);
  });

  it('hands out no token when nobody is signed in', async () => {
    await mount();

    await expect(latest().getIdToken()).resolves.toBeNull();
  });
});

describe('readFirebaseConfig', () => {
  afterEach(() => {
    vi.stubEnv('VITE_FIREBASE_API_KEY', 'test-api-key');
  });

  it('needs the API key, auth domain and project id', () => {
    expect(readFirebaseConfig()).toMatchObject({ projectId: 'test-project' });

    vi.stubEnv('VITE_FIREBASE_API_KEY', '');
    expect(readFirebaseConfig()).toBeNull();
  });
});

describe('hasStoredFirebaseSession', () => {
  it('finds a session Firebase stored for this project', () => {
    expect(hasStoredFirebaseSession()).toBe(false);

    localStorage.setItem('firebase:authUser:test-api-key:[DEFAULT]', '{}');
    expect(hasStoredFirebaseSession()).toBe(true);
  });

  it('ignores one stored for another project', () => {
    localStorage.setItem('firebase:authUser:other-key:[DEFAULT]', '{}');
    expect(hasStoredFirebaseSession()).toBe(false);
  });
});
