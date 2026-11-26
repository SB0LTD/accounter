import { useState, type ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import { siGoogle } from 'simple-icons';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFirebaseAuth } from '../../lib/firebase-auth.js';
import { getFirebaseAuthErrorMessage } from '../../lib/firebase-errors.js';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert.js';
import { Button } from '../ui/button.js';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form.js';
import { Input } from '../ui/input.js';
import { Separator } from '../ui/separator.js';
import { Spinner } from '../ui/spinner.js';

const emailField = z
  .string()
  .trim()
  .min(1, 'Enter your email address.')
  .pipe(z.email('Enter a valid email address.'));

const signInSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Enter your password.'),
});

const resetSchema = z.object({ email: emailField });

type SignInValues = z.infer<typeof signInSchema>;
type ResetValues = z.infer<typeof resetSchema>;

type Pending = 'google' | 'email' | 'reset' | null;

function GoogleMark(): ReactElement {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="fill-current">
      <path d={siGoogle.path} />
    </svg>
  );
}

/**
 * Sign-in with Google (popup) or with email and password, and the "forgot password" step that
 * sends Firebase's reset email. An invited user who has no password yet sets one through the
 * link in their invitation email, or through the reset email from here.
 *
 * `onSignedIn` runs once a sign-in succeeded; the auth state itself reaches the app through
 * `FirebaseAuthProvider`.
 */
export function SignInForm({ onSignedIn }: { onSignedIn?: () => void }): ReactElement {
  const { isLoading, signInWithGoogle, signInWithEmail, sendPasswordReset } = useFirebaseAuth();
  const [mode, setMode] = useState<'sign-in' | 'reset'>('sign-in');
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);

  const signInForm = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });
  const resetForm = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: '' },
  });

  const busy = isLoading || pending !== null;

  async function attempt(kind: Exclude<Pending, null>, action: () => Promise<void>) {
    setPending(kind);
    setError(null);
    try {
      await action();
      return true;
    } catch (caught) {
      setError(getFirebaseAuthErrorMessage(caught));
      return false;
    } finally {
      setPending(null);
    }
  }

  async function handleGoogle() {
    if (await attempt('google', signInWithGoogle)) {
      onSignedIn?.();
    }
  }

  async function handleEmailSignIn(values: SignInValues) {
    if (await attempt('email', () => signInWithEmail(values.email, values.password))) {
      onSignedIn?.();
    }
  }

  async function handleReset(values: ResetValues) {
    if (await attempt('reset', () => sendPasswordReset(values.email))) {
      setResetSentTo(values.email);
    }
  }

  function showReset() {
    setError(null);
    setResetSentTo(null);
    resetForm.reset({ email: signInForm.getValues('email') });
    setMode('reset');
  }

  function showSignIn() {
    setError(null);
    setMode('sign-in');
  }

  const errorAlert = error ? (
    <Alert variant="destructive" data-slot="sign-in-error">
      <AlertTitle>{mode === 'reset' ? 'Could not send the email' : 'Sign-in failed'}</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  ) : null;

  if (mode === 'reset') {
    return (
      <div className="grid gap-4">
        <div className="grid gap-1">
          <h3 className="text-lg font-semibold">Reset your password</h3>
          <p className="text-sm text-muted-foreground">
            Enter your email address and we will send you a link to choose a new password.
          </p>
        </div>
        {resetSentTo ? (
          <Alert data-slot="reset-sent">
            <AlertTitle>Check your email</AlertTitle>
            <AlertDescription>
              If an account exists for {resetSentTo}, a link to set a new password is on its way.
              Open it, choose a password, then sign in here.
            </AlertDescription>
          </Alert>
        ) : null}
        {errorAlert}
        <Form {...resetForm}>
          <form onSubmit={resetForm.handleSubmit(handleReset)} className="grid gap-4" noValidate>
            <FormField
              control={resetForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" {...field} disabled={busy} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={busy}>
              {pending === 'reset' ? <Spinner /> : null}
              Send reset link
            </Button>
          </form>
        </Form>
        <Button type="button" variant="link" onClick={showSignIn} disabled={pending !== null}>
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {errorAlert}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => void handleGoogle()}
        disabled={busy}
      >
        {pending === 'google' ? <Spinner /> : <GoogleMark />}
        Continue with Google
      </Button>
      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs uppercase text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>
      <Form {...signInForm}>
        <form
          onSubmit={signInForm.handleSubmit(handleEmailSignIn)}
          className="grid gap-4"
          noValidate
        >
          <FormField
            control={signInForm.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" autoComplete="email" {...field} disabled={busy} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={signInForm.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Password</FormLabel>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto px-0 text-muted-foreground"
                    onClick={showReset}
                    disabled={pending !== null}
                  >
                    Forgot password?
                  </Button>
                </div>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    {...field}
                    disabled={busy}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={busy}>
            {pending === 'email' ? <Spinner /> : null}
            Sign in
          </Button>
        </form>
      </Form>
    </div>
  );
}
