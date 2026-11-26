import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { rememberReturnTo } from '../lib/auth-return-to.js';
import { ROUTES } from '../router/routes.js';

type LoginOptions = {
  /** Where to land once signed in. Defaults to the app's first screen. */
  returnTo?: string;
  /**
   * A re-login after an expired session: the login page says so, and any `returnTo` a previous
   * step already stored is kept.
   */
  isReauth?: boolean;
};

/**
 * Takes the user to the sign-in page, remembering where to go once signed in.
 *
 * Shared so that every entry point (the landing page's Log in button, an invitation, a session
 * that expired mid-use) stores the destination the same way: `auth:returnTo` in sessionStorage,
 * which the sign-in page and the route guards read back (`lib/auth-return-to.ts`).
 */
export function useLogin(): (options?: LoginOptions) => Promise<void> {
  const navigate = useNavigate();

  return useCallback(
    async ({ returnTo = ROUTES.APP_HOME, isReauth = false }: LoginOptions = {}) => {
      // Do not overwrite a returnTo an earlier step in the reauth flow stored.
      rememberReturnTo(returnTo, { keepExisting: isReauth });

      if (isReauth) {
        await navigate(`${ROUTES.LOGIN}?reauth=1`);
        return;
      }
      await navigate(ROUTES.LOGIN, { state: { returnTo } });
    },
    [navigate],
  );
}
