import { describe, expect, it, vi } from 'vitest';
import { createFirebaseAccessTokenProvider, type GetIdToken } from '../firebase-token-provider.js';

function firebaseError(code: string, message = code): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}

describe('createFirebaseAccessTokenProvider', () => {
  it('resolves an ID token to the "token" status', async () => {
    const getIdToken = vi.fn<GetIdToken>().mockResolvedValue('id-token');
    const provider = createFirebaseAccessTokenProvider(getIdToken);

    await expect(provider()).resolves.toEqual({ status: 'token', token: 'id-token' });
  });

  it('maps "nobody signed in" to unauthenticated', async () => {
    const getIdToken = vi.fn<GetIdToken>().mockResolvedValue(null);
    const provider = createFirebaseAccessTokenProvider(getIdToken);

    await expect(provider()).resolves.toEqual({ status: 'unauthenticated' });
  });

  it('uses the cached token by default', async () => {
    const getIdToken = vi.fn<GetIdToken>().mockResolvedValue('id-token');
    const provider = createFirebaseAccessTokenProvider(getIdToken);

    await provider();
    await provider({ cacheMode: 'on' });

    expect(getIdToken).toHaveBeenNthCalledWith(1, { forceRefresh: false });
    expect(getIdToken).toHaveBeenNthCalledWith(2, { forceRefresh: false });
  });

  it('forces a refresh when the client asks past its cache, after an UNAUTHENTICATED answer', async () => {
    const getIdToken = vi.fn<GetIdToken>().mockResolvedValue('fresh-token');
    const provider = createFirebaseAccessTokenProvider(getIdToken);

    await expect(provider({ cacheMode: 'off' })).resolves.toEqual({
      status: 'token',
      token: 'fresh-token',
    });
    expect(getIdToken).toHaveBeenCalledWith({ forceRefresh: true });
  });

  // Firebase signs the user out when it meets one of these: only a new sign-in helps.
  it.each([
    'auth/user-token-expired',
    'auth/invalid-user-token',
    'auth/user-disabled',
    'auth/user-not-found',
  ])('treats a failed refresh with %s as unauthenticated', async code => {
    const getIdToken = vi.fn<GetIdToken>().mockRejectedValue(firebaseError(code));
    const provider = createFirebaseAccessTokenProvider(getIdToken);

    await expect(provider({ cacheMode: 'off' })).resolves.toEqual({ status: 'unauthenticated' });
  });

  it('surfaces network failures as errors so the current token is preserved', async () => {
    const error = firebaseError('auth/network-request-failed', 'Firebase: Error (network)');
    const getIdToken = vi.fn<GetIdToken>().mockRejectedValue(error);
    const provider = createFirebaseAccessTokenProvider(getIdToken);

    await expect(provider()).resolves.toEqual({ status: 'error', error });
  });

  it('surfaces errors without a Firebase code as errors', async () => {
    const error = new Error('boom');
    const getIdToken = vi.fn<GetIdToken>().mockRejectedValue(error);
    const provider = createFirebaseAccessTokenProvider(getIdToken);

    await expect(provider()).resolves.toEqual({ status: 'error', error });
  });
});
