import { useEffect, useMemo, type ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { clearReturnTo, resolveReturnTo, stateReturnTo } from '../../lib/auth-return-to.js';

/**
 * Takes a signed-in user to where they were going (see `resolveReturnTo`), and forgets the stored
 * destination once taken there. `keepStored` leaves it for later: for a user who is not signed in
 * yet and is only passing through on the way to sign-in.
 */
export function RedirectAfterSignIn({
  keepStored = false,
}: {
  keepStored?: boolean;
}): ReactElement {
  const location = useLocation();
  // Kept across renders: the effect below clears what it was read from before the redirect lands.
  const target = useMemo(() => resolveReturnTo(stateReturnTo(location.state)), [location.state]);

  useEffect(() => {
    if (!keepStored) {
      clearReturnTo();
    }
  }, [keepStored]);

  return <Navigate to={target} replace />;
}
