import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { hasSignedInUser } from '../lib/firebase-auth.js';
import { setReauthHandler, type ReauthOutcome } from '../lib/reauth-coordinator.js';
import { SignInForm } from './auth/sign-in-form.js';
import { Button } from './ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog.js';

/**
 * Re-authentication in place, when the API stops accepting the session: sign in again in a
 * dialog over the page, and the requests that failed are sent again with the new token.
 *
 * When Firebase itself has ended the session (its refresh failed: revoked, expired, account
 * disabled), it has signed the user out, and the route guards are already taking them to the
 * login page, which keeps the page to come back to. A dialog over that would be a second sign-in
 * form, so the client goes straight to the login page instead.
 */
export function SessionExpiryDialog(): ReactElement {
  const [open, setOpen] = useState(false);
  const resolveRef = useRef<((outcome: ReauthOutcome) => void) | null>(null);

  const settle = useCallback((outcome: ReauthOutcome) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setOpen(false);
    resolve?.(outcome);
  }, []);

  useEffect(() => {
    setReauthHandler(() => {
      if (!hasSignedInUser()) {
        return Promise.resolve('redirect');
      }
      return new Promise<ReauthOutcome>(resolve => {
        resolveRef.current = resolve;
        setOpen(true);
      });
    });
    return () => {
      setReauthHandler(null);
    };
  }, []);

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        // Any dismissal without signing in falls back to the login page.
        if (!next) {
          settle('redirect');
        }
      }}
    >
      <DialogContent showCloseButton={false} onInteractOutside={event => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Session expired</DialogTitle>
          <DialogDescription>
            Your session expired. Sign in to continue where you left off.
          </DialogDescription>
        </DialogHeader>
        <SignInForm onSignedIn={() => settle('authenticated')} />
        <DialogFooter>
          <Button variant="outline" onClick={() => settle('redirect')}>
            Go to login page
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
