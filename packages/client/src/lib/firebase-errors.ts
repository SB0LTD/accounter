/**
 * Firebase Authentication errors, as the app reads and words them.
 *
 * The SDK rejects with a `FirebaseError` whose `code` is `auth/<reason>`. Only the code is read
 * here (never `instanceof`), so a rejection that crossed a module boundary, or a test double,
 * is recognised the same way.
 */

/** Code of the error `firebase-auth.tsx` throws when the build carries no Firebase config. */
export const NOT_CONFIGURED_ERROR_CODE = 'auth/not-configured';

const INCORRECT_CREDENTIALS = 'Incorrect email or password.';

const MESSAGES: Record<string, string> = {
  // With email enumeration protection on (the default for newer projects), Firebase answers a
  // wrong password and an unknown email alike, with this code.
  'auth/invalid-credential': INCORRECT_CREDENTIALS,
  'auth/invalid-login-credentials': INCORRECT_CREDENTIALS,
  'auth/wrong-password':
    'Incorrect password. Try again, or use "Forgot password?" to set a new one.',
  'auth/user-not-found':
    'No account uses this email address. Sign in with the address your invitation was sent to.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/missing-email': 'Enter your email address.',
  'auth/missing-password': 'Enter your password.',
  'auth/user-disabled': 'This account has been disabled. Contact your administrator.',
  'auth/too-many-requests':
    'Too many attempts. Wait a few minutes, or reset your password, then try again.',
  'auth/popup-closed-by-user':
    'The Google sign-in window was closed before sign-in finished. Try again.',
  'auth/cancelled-popup-request': 'Sign-in was cancelled. Try again.',
  'auth/user-cancelled': 'Sign-in was cancelled. Try again.',
  'auth/popup-blocked':
    'Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.',
  'auth/account-exists-with-different-credential':
    'This email address signs in another way. Sign in with your email and password instead.',
  'auth/unauthorized-domain':
    'Sign-in is not enabled for this site yet. Contact your administrator.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled. Contact your administrator.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/user-token-expired': 'Your session expired. Please sign in again.',
  'auth/invalid-user-token': 'Your session expired. Please sign in again.',
  'auth/invalid-api-key': 'Sign-in is not configured correctly. Contact your administrator.',
  'auth/configuration-not-found':
    'Sign-in is not configured correctly. Contact your administrator.',
  [NOT_CONFIGURED_ERROR_CODE]:
    'Sign-in is not configured for this site. Contact your administrator.',
};

/**
 * Codes meaning the session cannot be renewed silently: the refresh token was revoked or has
 * expired, or the account is gone or disabled. The SDK signs the user out when it meets one, so
 * the only way forward is to sign in again. Everything else (a network failure above all) may
 * pass, and keeps the current session.
 */
const REAUTH_REQUIRED_CODES = new Set([
  'auth/user-token-expired',
  'auth/invalid-user-token',
  'auth/user-disabled',
  'auth/user-not-found',
]);

/** The `auth/<reason>` code of a Firebase Authentication error, or null for anything else. */
export function firebaseErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }
  const { code } = error as { code?: unknown };
  return typeof code === 'string' ? code : null;
}

export function isReauthRequiredFirebaseError(error: unknown): boolean {
  const code = firebaseErrorCode(error);
  return code !== null && REAUTH_REQUIRED_CODES.has(code);
}

export function isNetworkError(error: unknown): boolean {
  if (firebaseErrorCode(error) === 'auth/network-request-failed') {
    return true;
  }
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return message.includes('network') || message.includes('failed to fetch');
}

/** What to tell the user about a failed sign-in, password reset or session renewal. */
export function getFirebaseAuthErrorMessage(error: unknown): string {
  const code = firebaseErrorCode(error);
  if (code && MESSAGES[code]) {
    return MESSAGES[code];
  }
  if (isNetworkError(error)) {
    return MESSAGES['auth/network-request-failed'];
  }
  return 'Something went wrong. Please try again.';
}
