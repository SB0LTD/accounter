import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  getAuth,
  GoogleAuthProvider,
  initializeAuth,
  onIdTokenChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { firebaseErrorCode, NOT_CONFIGURED_ERROR_CODE } from './firebase-errors.js';

/**
 * Sign-in for the web client, on Firebase Authentication.
 *
 * `FirebaseAuthProvider` follows the signed-in user and `useFirebaseAuth` hands the app what it
 * needs: the user, the sign-in methods, sign-out, and the ID token the API takes as its bearer.
 * The session is kept in localStorage (`browserLocalPersistence`), so it survives reloads and new
 * tabs; Firebase refreshes the ID token itself before it expires.
 *
 * Google sign-in opens a popup rather than redirecting: the app is served from its own domain while
 * the auth domain is `<project>.firebaseapp.com`, and a redirect across the two depends on
 * third-party storage that browsers increasingly block.
 */

/** The signed-in user, as the app shows them. */
export type AuthUser = {
  uid: string;
  email: string | null;
  name: string | null;
  picture: string | null;
  emailVerified: boolean;
};

export type FirebaseAuthContextValue = {
  /** True until Firebase has read the stored session, if any. */
  isLoading: boolean;
  isAuthenticated: boolean;
  user: AuthUser | null;
  /** Google sign-in in a popup. Rejects when the popup is closed, blocked or fails. */
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  /** Sends Firebase's password reset email, which is also how an invited user sets a password. */
  sendPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  /**
   * The signed-in user's ID token (refreshed by Firebase when it is close to expiry, or on
   * `forceRefresh`), or null when nobody is signed in. Waits for the stored session to load first.
   */
  getIdToken: (options?: { forceRefresh?: boolean }) => Promise<string | null>;
};

/** The web app config this build was given (see `build-env.ts`), or null when it is incomplete. */
export function readFirebaseConfig(): FirebaseOptions | null {
  // Each name in full: `build-env.ts` inlines these exact expressions, not `import.meta.env` whole.
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY?.trim();
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim();
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();
  const appId = import.meta.env.VITE_FIREBASE_APP_ID?.trim();
  if (!apiKey || !authDomain || !projectId) {
    return null;
  }
  return { apiKey, authDomain, projectId, ...(appId ? { appId } : {}) };
}

/** `undefined` until first asked for; null when the build has no (usable) Firebase config. */
let authInstance: Auth | null | undefined;

/** The app's Firebase Auth instance, created on first use. Null when sign-in cannot work. */
export function getFirebaseAuth(): Auth | null {
  if (authInstance !== undefined) {
    return authInstance;
  }

  const config = readFirebaseConfig();
  if (!config) {
    console.warn(
      'Firebase environment variables not set (FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID). Sign-in will fail.',
    );
    authInstance = null;
    return authInstance;
  }

  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(config);
    try {
      authInstance = initializeAuth(app, {
        persistence: browserLocalPersistence,
        popupRedirectResolver: browserPopupRedirectResolver,
      });
    } catch (error) {
      // A module reloaded in development finds the instance it created before.
      if (firebaseErrorCode(error) !== 'auth/already-initialized') {
        throw error;
      }
      authInstance = getAuth(app);
    }
  } catch (error) {
    console.error('Firebase Authentication could not start. Sign-in will fail.', error);
    authInstance = null;
  }
  return authInstance;
}

function notConfiguredError(): Error {
  return Object.assign(new Error('Firebase Authentication is not configured for this build'), {
    code: NOT_CONFIGURED_ERROR_CODE,
  });
}

function requireAuth(): Auth {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw notConfiguredError();
  }
  return auth;
}

async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  // Always offer the account chooser: an invitation may have gone to another Google account than
  // the one the browser is signed in to.
  provider.setCustomParameters({ prompt: 'select_account' });
  await signInWithPopup(requireAuth(), provider);
}

async function signInWithEmail(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(requireAuth(), email.trim(), password);
}

async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(requireAuth(), email.trim());
}

async function logout(): Promise<void> {
  const auth = getFirebaseAuth();
  if (auth) {
    await signOut(auth);
  }
}

async function getIdToken({ forceRefresh = false }: { forceRefresh?: boolean } = {}): Promise<
  string | null
> {
  const auth = getFirebaseAuth();
  if (!auth) {
    return null;
  }
  // Right after a page load `currentUser` is null until the stored session has been read: asking
  // before then would send the first requests without a token.
  await auth.authStateReady();
  const user = auth.currentUser;
  return user ? user.getIdToken(forceRefresh) : null;
}

/** Whether Firebase has a signed-in user at this moment, for code outside React. */
export function hasSignedInUser(): boolean {
  return !!getFirebaseAuth()?.currentUser;
}

/**
 * Whether this browser holds a stored Firebase session, without waiting for Firebase to load it.
 * For the landing page, which paints at once for a visitor with no session at all.
 */
export function hasStoredFirebaseSession(): boolean {
  const apiKey = readFirebaseConfig()?.apiKey;
  if (!apiKey) {
    return false;
  }
  // Reading localStorage throws where the browser blocks site data; there is no stored session
  // there either.
  try {
    const prefix = `firebase:authUser:${apiKey}:`;
    for (let index = 0; index < localStorage.length; index += 1) {
      if (localStorage.key(index)?.startsWith(prefix)) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

function toAuthUser(user: User | null): AuthUser | null {
  if (!user) {
    return null;
  }
  return {
    uid: user.uid,
    email: user.email,
    name: user.displayName,
    picture: user.photoURL,
    emailVerified: user.emailVerified,
  };
}

function sameAuthUser(a: AuthUser | null, b: AuthUser | null): boolean {
  if (!a || !b) {
    return a === b;
  }
  return (
    a.uid === b.uid &&
    a.email === b.email &&
    a.name === b.name &&
    a.picture === b.picture &&
    a.emailVerified === b.emailVerified
  );
}

const ACTIONS = { signInWithGoogle, signInWithEmail, sendPasswordReset, logout, getIdToken };

function outsideProvider(): Promise<never> {
  return Promise.reject(new Error('Firebase sign-in is used outside <FirebaseAuthProvider>'));
}

/** Outside the provider (dev auth mode): still loading, nobody signed in, no sign-in possible. */
const FirebaseAuthContext = createContext<FirebaseAuthContextValue>({
  isLoading: true,
  isAuthenticated: false,
  user: null,
  signInWithGoogle: outsideProvider,
  signInWithEmail: outsideProvider,
  sendPasswordReset: outsideProvider,
  logout: async () => {},
  getIdToken: async () => null,
});

type AuthSnapshot = { isLoading: boolean; user: AuthUser | null };

export function FirebaseAuthProvider({ children }: { children?: ReactNode }): ReactNode {
  const [snapshot, setSnapshot] = useState<AuthSnapshot>(() => ({
    // Without a config there is nothing to wait for.
    isLoading: getFirebaseAuth() !== null,
    user: null,
  }));

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      return;
    }
    // Fires once the stored session is read, then on every sign-in, sign-out and token refresh.
    // A refresh leaves the user as it was, so it keeps the same object and re-renders nothing.
    return onIdTokenChanged(
      auth,
      firebaseUser => {
        const next = toAuthUser(firebaseUser);
        setSnapshot(previous => {
          if (sameAuthUser(previous.user, next)) {
            return previous.isLoading ? { isLoading: false, user: previous.user } : previous;
          }
          return { isLoading: false, user: next };
        });
      },
      error => {
        console.error('Firebase Authentication state could not be read', error);
        setSnapshot(previous => (previous.isLoading ? { isLoading: false, user: null } : previous));
      },
    );
  }, []);

  const value = useMemo<FirebaseAuthContextValue>(
    () => ({
      isLoading: snapshot.isLoading,
      isAuthenticated: !!snapshot.user,
      user: snapshot.user,
      ...ACTIONS,
    }),
    [snapshot],
  );

  return <FirebaseAuthContext.Provider value={value}>{children}</FirebaseAuthContext.Provider>;
}

export function useFirebaseAuth(): FirebaseAuthContextValue {
  return useContext(FirebaseAuthContext);
}
