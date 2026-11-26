import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFirebaseAuth } from '../lib/firebase-auth.js';
import { createFirebaseAccessTokenProvider } from '../lib/firebase-token-provider.js';
import { resetUrqlClientAndNotify, setUrqlAccessTokenProvider } from './urql.js';

/**
 * Connects Firebase sign-in to the urql client: the signed-in user's ID token is the bearer every
 * request carries. Render it inside `FirebaseAuthProvider`, around the app.
 */
export function FirebaseUrqlTokenBridge({ children }: { children?: ReactNode }): ReactNode {
  const { getIdToken, isLoading, user } = useFirebaseAuth();
  const tokenProvider = useMemo(() => createFirebaseAccessTokenProvider(getIdToken), [getIdToken]);

  // Register token provider during render so route loaders can read it immediately.
  setUrqlAccessTokenProvider(tokenProvider);

  useEffect(() => {
    // Again after a remount (StrictMode runs the cleanup below once in development).
    setUrqlAccessTokenProvider(tokenProvider);
    return () => {
      setUrqlAccessTokenProvider(null);
    };
  }, [tokenProvider]);

  // A sign-in, sign-out or switch of user without a page load: the urql client still carries the
  // previous identity's bearer token (or none), so hand the app a fresh client, which starts from
  // the new identity's token. Not on the first answer after a page load: the client waits for
  // Firebase to read the stored session before its first request. A layout effect, so the swap
  // lands before the screens' own effects start requests for the new identity.
  const uid = isLoading ? undefined : (user?.uid ?? null);
  const lastUid = useRef<string | null | undefined>(undefined);
  useLayoutEffect(() => {
    if (uid === undefined) {
      return;
    }
    if (lastUid.current !== undefined && lastUid.current !== uid) {
      resetUrqlClientAndNotify();
    }
    lastUid.current = uid;
  }, [uid]);

  return children;
}
