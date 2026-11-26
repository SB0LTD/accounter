import { useEffect, type ReactElement } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { clearReturnTo, resolveReturnTo, stateReturnTo } from '../lib/auth-return-to.js';
import { ROUTES } from '../router/routes.js';
import { SignInForm } from './auth/sign-in-form.js';
import { SB0_URL, Sb0Mark } from './brand/sb0-mark.js';

/**
 * The sign-in page.
 *
 * Leaving it once signed in is `PublicOnlyGuard`'s job: it takes a signed-in user to where they
 * were going, the moment sign-in succeeds. The one exception is the re-login after an expired
 * session (`?reauth=1`), which the guard lets through even with a session, so this page takes the
 * user back itself.
 */
export function LoginPage(): ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const isReauthFlow = new URLSearchParams(location.search).get('reauth') === '1';

  useEffect(() => {
    // Clean up legacy user session from localStorage
    try {
      localStorage.removeItem('user');
    } catch {
      // ignore
    }
  }, []);

  function handleSignedIn(): void {
    if (!isReauthFlow) {
      return;
    }
    const target = resolveReturnTo(stateReturnTo(location.state));
    clearReturnTo();
    void navigate(target, { replace: true });
  }

  return (
    <div className="w-full flex flex-col justify-center items-center min-h-screen py-8 lg:grid lg:grid-cols-2 lg:py-0">
      <div className="flex items-center justify-center px-4">
        <div className="space-y-6 w-full max-w-xs">
          <div className="grid gap-2 text-center">
            <h1 className="text-3xl font-bold">Accounter</h1>
            <h2 className="text-2xl font-semibold">Sign In</h2>
            {isReauthFlow ? (
              <p className="text-sm text-destructive" data-slot="session-expired">
                Your session expired. Please sign in again.
              </p>
            ) : (
              <p className="text-balance text-muted-foreground">Sign in to continue</p>
            )}
          </div>

          <SignInForm onSignedIn={handleSignedIn} />

          <p className="text-center text-xs text-muted-foreground text-balance">
            Invited by email? Set your password with the link in the invitation, or continue with
            Google if the invitation went to a Google account.
          </p>

          <p className="text-center text-xs text-muted-foreground text-balance">
            By signing in you accept the{' '}
            <Link to={ROUTES.TERMS} className="underline underline-offset-2">
              Terms of Service
            </Link>{' '}
            and the{' '}
            <Link to={ROUTES.PRIVACY} className="underline underline-offset-2">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>

      {/* SB0 runs this service, and its shield is the logo on Google's sign-in consent screen. The
          panel takes the shield image's own background colour, so the image has no visible edge. */}
      <div className="hidden bg-[#0e0e0e] lg:block rounded-tl-3xl rounded-bl-3xl">
        <a
          href={SB0_URL}
          className="flex flex-col justify-center items-center gap-4 h-screen text-sm text-gray-400"
        >
          <Sb0Mark className="size-32 rounded-none" />
          <span>Accounter, a service of SB0 LTD</span>
        </a>
      </div>
    </div>
  );
}
