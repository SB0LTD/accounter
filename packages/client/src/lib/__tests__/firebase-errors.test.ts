import { describe, expect, it } from 'vitest';
import {
  firebaseErrorCode,
  getFirebaseAuthErrorMessage,
  isNetworkError,
  isReauthRequiredFirebaseError,
  NOT_CONFIGURED_ERROR_CODE,
} from '../firebase-errors.js';

function firebaseError(code: string, message = `Firebase: Error (${code}).`) {
  return Object.assign(new Error(message), { code });
}

describe('firebaseErrorCode', () => {
  it('reads the code of a Firebase error', () => {
    expect(firebaseErrorCode(firebaseError('auth/wrong-password'))).toBe('auth/wrong-password');
  });

  it('answers null for anything else', () => {
    expect(firebaseErrorCode(new Error('plain'))).toBeNull();
    expect(firebaseErrorCode('auth/wrong-password')).toBeNull();
    expect(firebaseErrorCode(null)).toBeNull();
    expect(firebaseErrorCode({ code: 42 })).toBeNull();
  });
});

describe('getFirebaseAuthErrorMessage', () => {
  it.each([
    ['auth/wrong-password', 'Incorrect password'],
    ['auth/user-not-found', 'No account uses this email address'],
    ['auth/invalid-credential', 'Incorrect email or password'],
    ['auth/popup-closed-by-user', 'sign-in window was closed'],
    ['auth/popup-blocked', 'blocked the Google sign-in window'],
    ['auth/too-many-requests', 'Too many attempts'],
    ['auth/unauthorized-domain', 'not enabled for this site'],
    [NOT_CONFIGURED_ERROR_CODE, 'not configured'],
  ])('words %s for the user', (code, expected) => {
    expect(getFirebaseAuthErrorMessage(firebaseError(code))).toContain(expected);
  });

  it('words a network failure without a code', () => {
    expect(getFirebaseAuthErrorMessage(new Error('Failed to fetch'))).toContain('Network error');
  });

  it('falls back to a generic message, never the raw SDK text', () => {
    const message = getFirebaseAuthErrorMessage(firebaseError('auth/internal-error'));
    expect(message).toBe('Something went wrong. Please try again.');
  });
});

describe('isReauthRequiredFirebaseError', () => {
  it.each(['auth/user-token-expired', 'auth/invalid-user-token', 'auth/user-disabled'])(
    'is true for %s',
    code => {
      expect(isReauthRequiredFirebaseError(firebaseError(code))).toBe(true);
    },
  );

  it('is false for a network failure', () => {
    expect(isReauthRequiredFirebaseError(firebaseError('auth/network-request-failed'))).toBe(false);
  });
});

describe('isNetworkError', () => {
  it('recognises the SDK code and fetch failures', () => {
    expect(isNetworkError(firebaseError('auth/network-request-failed'))).toBe(true);
    expect(isNetworkError(new Error('Failed to fetch'))).toBe(true);
    expect(isNetworkError(firebaseError('auth/wrong-password'))).toBe(false);
  });
});
