import type { ReactElement } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAcceptInvitation } from '@/hooks/use-accept-invitation.js';
import { useLogin } from '@/hooks/use-login.js';
import { rememberInvitationReturnTo } from '@/lib/auth-return-to.js';
import { useFirebaseAuth } from '@/lib/firebase-auth.js';
import { ROUTES } from '@/router/routes.js';
import { Button } from '../ui/button.js';

export function AcceptInvitationPage(): ReactElement {
  const { token } = useParams<{ token: string }>();
  const { isAuthenticated, isLoading } = useFirebaseAuth();
  const login = useLogin();
  const navigate = useNavigate();
  const { fetching, error, acceptInvitation } = useAcceptInvitation();

  if (!token) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-sm space-y-4">
          <h1 className="text-2xl font-bold">Invalid invitation link</h1>
          <p className="text-muted-foreground">
            This invitation link is incomplete. Please use the full link from your email.
          </p>
        </div>
      </div>
    );
  }

  // While the stored session is being read, show a loading view.
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-sm space-y-4">
          <h1 className="text-2xl font-bold">Loading invitation...</h1>
          <p className="text-muted-foreground">
            Please wait while we check your authentication status.
          </p>
        </div>
      </div>
    );
  }

  // Unauthenticated users must sign in first, then come back to this tokenized route.
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen px-4">
        <div className="text-center max-w-sm space-y-4">
          <h1 className="text-2xl font-bold">You&apos;ve been invited!</h1>
          <p className="text-muted-foreground">
            Sign in to accept this invitation. If you have not set a password yet, use the link in
            your invitation email first, or continue with Google if the invitation went to a Google
            account.
          </p>
          <Button
            onClick={() => {
              const returnTo = ROUTES.ACCEPT_INVITATION(token);
              rememberInvitationReturnTo(returnTo);
              return login({ returnTo });
            }}
          >
            Sign in to accept
          </Button>
        </div>
      </div>
    );
  }

  const handleAccept = async () => {
    const success = await acceptInvitation(token);
    if (success?.success) {
      navigate(ROUTES.APP_HOME, { replace: true });
    }
  };

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">Accept Invitation</h1>
        {error && (
          <p className="text-destructive">
            {error.graphQLErrors?.[0]?.message === 'TOKEN_EXPIRED'
              ? 'This invitation link has expired. Please request a new one.'
              : (error.graphQLErrors?.[0]?.message ?? 'An error occurred')}
          </p>
        )}
        <Button onClick={handleAccept} disabled={fetching}>
          {fetching ? 'Accepting...' : 'Accept Invitation'}
        </Button>
      </div>
    </div>
  );
}
