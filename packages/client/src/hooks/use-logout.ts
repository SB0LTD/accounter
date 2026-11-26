import { useNavigate } from 'react-router-dom';
import { useFirebaseAuth } from '../lib/firebase-auth.js';
import { resetUrqlClientAndNotify } from '../providers/urql.js';
import { ROUTES } from '../router/routes.js';

export function useLogout(): () => Promise<void> {
  const { logout } = useFirebaseAuth();
  const navigate = useNavigate();

  return async () => {
    sessionStorage.clear();

    // Before signing out, not after: dropping the client here discards the bearer token and hands
    // the Provider a fresh one, so nothing a later session renders can be served from the previous
    // user's state, whatever re-renders the sign-out sets off.
    resetUrqlClientAndNotify();

    await logout();

    // After signing out: the login page sends a signed-in user straight back into the app.
    await navigate(ROUTES.LOGIN, { replace: true });
  };
}
