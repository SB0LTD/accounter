import { ROUTES } from '../router/routes.js';

/**
 * Where to take the user once they have signed in.
 *
 * The page that sent them to sign in is remembered in sessionStorage, so it survives the full page
 * load of a session that expired mid-use (`providers/urql.tsx` stores it there too), and an
 * invitation being accepted is remembered apart from it, ahead of everything else: it is the one
 * destination the user must not lose on the way through sign-in.
 */

export const RETURN_TO_KEY = 'auth:returnTo';
export const INVITATION_RETURN_TO_KEY = 'auth:invitationReturnTo';
/** Written by the Auth0 callback this replaced; cleared with the others so none lingers. */
const LEGACY_KEYS = ['auth:lastResolvedReturnTo'];

function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // A browser that blocks storage loses the destination, not the sign-in.
  }
}

/** A path inside this app. Anything else (another origin, `//host`) is not followed. */
export function isAppPath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.startsWith('/\\')
  );
}

/**
 * Remembers where to go after sign-in. `keepExisting` leaves a destination an earlier step stored
 * in place (a re-login after an expired session).
 */
export function rememberReturnTo(returnTo: string, { keepExisting = false } = {}): void {
  if (keepExisting && read(RETURN_TO_KEY)) {
    return;
  }
  write(RETURN_TO_KEY, returnTo);
}

/** Remembers the invitation being accepted, so sign-in comes back to it whatever else happens. */
export function rememberInvitationReturnTo(returnTo: string): void {
  write(RETURN_TO_KEY, returnTo);
  write(INVITATION_RETURN_TO_KEY, returnTo);
}

/**
 * The destination after sign-in: an invitation being accepted, then the page the route guard
 * sent here (`location.state.returnTo`), then the one stored in sessionStorage, then the app.
 */
export function resolveReturnTo(stateReturnTo?: unknown): string {
  return (
    [read(INVITATION_RETURN_TO_KEY), stateReturnTo, read(RETURN_TO_KEY)].find(isAppPath) ??
    ROUTES.APP_HOME
  );
}

/** Forgets every stored destination, once the user has been taken to one. */
export function clearReturnTo(): void {
  for (const key of [RETURN_TO_KEY, INVITATION_RETURN_TO_KEY, ...LEGACY_KEYS]) {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

/** `location.state.returnTo`, as the route guards set it. */
export function stateReturnTo(state: unknown): string | undefined {
  const returnTo = (state as { returnTo?: unknown } | null | undefined)?.returnTo;
  return isAppPath(returnTo) ? returnTo : undefined;
}
