import type { AccessTokenProvider } from '../providers/urql.js';
import { isReauthRequiredFirebaseError } from './firebase-errors.js';

/**
 * The signed-in user's Firebase ID token, or null when nobody is signed in. A forced refresh asks
 * Firebase for a new token even when the cached one has not expired yet.
 */
export type GetIdToken = (options?: { forceRefresh?: boolean }) => Promise<string | null>;

/**
 * Builds the access-token provider that `setUrqlAccessTokenProvider` registers: the Firebase ID
 * token is the bearer the server verifies.
 *
 * - no signed-in user: `unauthenticated`, so the client goes through re-login;
 * - `cacheMode: 'off'` (the client asks after the server answered UNAUTHENTICATED): a forced
 *   refresh, rather than the cached token the server just refused;
 * - a refresh Firebase cannot do any more (revoked or expired session, deleted or disabled
 *   account): `unauthenticated`, the same as no user — the SDK has signed the user out by then;
 * - anything else, a network failure above all: `error`, so the client keeps the token it has.
 */
export function createFirebaseAccessTokenProvider(getIdToken: GetIdToken): AccessTokenProvider {
  return async options => {
    try {
      const token = await getIdToken({ forceRefresh: options?.cacheMode === 'off' });
      if (!token) {
        return { status: 'unauthenticated' };
      }
      return { status: 'token', token };
    } catch (error) {
      if (isReauthRequiredFirebaseError(error)) {
        return { status: 'unauthenticated' };
      }
      return { status: 'error', error };
    }
  };
}
