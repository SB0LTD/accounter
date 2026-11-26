import { useContext, useEffect, type ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { RedirectAfterSignIn } from '../../components/auth/redirect-after-sign-in.js';
import { PageSkeleton } from '../../components/layout/page-skeleton.js';
import { useSessionViewer, useViewer } from '../../hooks/use-viewer.js';
import { hasStoredFirebaseSession, useFirebaseAuth } from '../../lib/firebase-auth.js';
import { UserContext } from '../../providers/user-provider.js';
import { ROUTES } from '../routes.js';

type GuardProps = {
  children: ReactElement;
};

const isDevAuthEnabled = import.meta.env.VITE_DEV_AUTH === '1';

export function ProtectedRoute({ children }: GuardProps): ReactElement {
  if (isDevAuthEnabled) {
    return children;
  }

  return (
    <SignedInRoute>
      <OnboardingGuard>{children}</OnboardingGuard>
    </SignedInRoute>
  );
}

function SignedInRoute({ children }: GuardProps): ReactElement {
  const { isAuthenticated, isLoading } = useFirebaseAuth();
  const location = useLocation();

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to={ROUTES.LOGIN}
        replace
        state={{ returnTo: location.pathname + location.search + location.hash }}
      />
    );
  }

  return children;
}

/**
 * Keeps an authenticated-but-unprovisioned user off the app shell.
 *
 * Being signed in is not enough to use Accounter — the identity must be
 * linked to at least one business. Without this guard such a user renders the
 * dashboard over queries that all fail, with no explanation and no way forward.
 *
 * Renders children on a query error rather than trapping the user on /welcome:
 * a network blip should not look like a missing workspace, and every underlying
 * screen handles its own failures.
 */
export function OnboardingGuard({ children }: GuardProps): ReactElement {
  // From the boot request `UserProvider` sends, rather than a query of its own: that one was sent
  // twice per load (the provider's loader remounts this guard), the second time after the boot
  // request, holding the shell back by another round trip.
  const session = useSessionViewer();
  // The boot request may be older than this render, so a not-active answer may be stale: an
  // invitation accepted since, on a page that then navigates here. Read it again before sending
  // the user away. /welcome reads `viewer` itself and sends an active user back to the app, so
  // acting on a stale answer bounced them between the two without end.
  const needsFreshRead =
    !session.fetching && !session.error && !!session.viewer && session.viewer.status !== 'ACTIVE';
  const fresh = useViewer({ pause: !needsFreshRead });
  const { fetching, error, viewer } = needsFreshRead ? fresh : session;

  // The fresh read saying active means the boot answer is out of date, and with it the user
  // context that came in the same response: empty, for someone who had no workspace then. Read
  // it again in the background, or the app stays without memberships until a reload.
  const { refreshUserContext } = useContext(UserContext);
  const bootAnswerIsOutOfDate = needsFreshRead && fresh.viewer?.status === 'ACTIVE';
  useEffect(() => {
    if (bootAnswerIsOutOfDate) {
      void refreshUserContext?.();
    }
  }, [bootAnswerIsOutOfDate, refreshUserContext]);

  if (fetching) {
    return <PageSkeleton />;
  }

  if (!error && viewer && viewer.status !== 'ACTIVE') {
    return <Navigate to={ROUTES.WELCOME} replace />;
  }

  return children;
}

/**
 * Owns the site root, which serves two audiences.
 *
 * A visitor without a session gets the public landing page; anyone already
 * signed in is sent straight into the app. Unlike the other guards this one
 * does not hold the render back on `isLoading` by default — the landing page is
 * the first thing a stranger ever sees, and making them wait for Firebase to
 * load to read marketing copy is the wrong trade. A stored session is the one
 * case worth waiting for: it means a redirect is coming, so painting the
 * marketing page first would only be a flash.
 */
export function LandingRoute({ children }: GuardProps): ReactElement {
  if (isDevAuthEnabled) {
    return <Navigate to={ROUTES.APP_HOME} replace />;
  }

  return <SessionLandingRoute>{children}</SessionLandingRoute>;
}

function SessionLandingRoute({ children }: GuardProps): ReactElement {
  const { isAuthenticated, isLoading } = useFirebaseAuth();

  if (isLoading) {
    return hasStoredFirebaseSession() ? <PageSkeleton /> : children;
  }

  if (isAuthenticated) {
    return <Navigate to={ROUTES.APP_HOME} replace />;
  }

  return children;
}

export function PublicOnlyGuard({ children }: GuardProps): ReactElement {
  if (isDevAuthEnabled) {
    return children;
  }

  return <SignedOutGuard>{children}</SignedOutGuard>;
}

/**
 * Keeps a signed-in user off the login page, taking them where they were going instead (an
 * invitation being accepted, the page that sent them to sign in, or the app). That includes the
 * moment a sign-in on the page succeeds: this is what leaves the login page afterwards.
 */
function SignedOutGuard({ children }: GuardProps): ReactElement {
  const { isAuthenticated, isLoading } = useFirebaseAuth();
  const location = useLocation();
  const isForcedReauth = new URLSearchParams(location.search).get('reauth') === '1';

  if (isLoading) {
    return <PageSkeleton />;
  }

  // Allow the explicit re-authentication flow to render the login page even when Firebase still
  // reports a signed-in user. The login page then leaves by itself once signed in again.
  if (isAuthenticated && !isForcedReauth) {
    return <RedirectAfterSignIn />;
  }

  return children;
}
