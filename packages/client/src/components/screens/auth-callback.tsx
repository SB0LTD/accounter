import type { ReactElement } from 'react';
import { useFirebaseAuth } from '../../lib/firebase-auth.js';
import { RedirectAfterSignIn } from '../auth/redirect-after-sign-in.js';

/**
 * `/auth/callback`, kept as a URL: the Auth0 sign-in redirected here, and links and bookmarks may
 * still point at it. Sign-in no longer passes through it (Firebase signs in on the login page,
 * in a popup), so all it does is send the user on to where they were going, or home.
 *
 * Someone not signed in goes the same way: the route guard then sends them to sign in, carrying
 * the destination along, so the stored one is kept for after.
 */
export function AuthCallbackPage(): ReactElement {
  const { isLoading, isAuthenticated } = useFirebaseAuth();

  if (isLoading) {
    return <div>Processing authentication...</div>;
  }

  return <RedirectAfterSignIn keepStored={!isAuthenticated} />;
}
