/**
 * User management on Firebase Authentication, with the contract of Auth0ManagementProvider.
 *
 * The Firebase project's user pool may be shared with other apps (one account per person across
 * them), so this never disables an account: Auth0's "blocked" state becomes a custom claim, and
 * access is already gated by Accounter's own business membership, which an invitee only gets when
 * the invitation is accepted. Deleting is limited to accounts Accounter itself created for an
 * invitation and that have never signed in.
 */
import { getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth, type UserRecord } from 'firebase-admin/auth';

/** Custom claim marking an account Accounter created for an invitation. */
const REGISTERED_BY = 'accounter_registered_by';
const REGISTERED_BY_ACCOUNTER = 'accounter';
/** Custom claim: invited, not yet accepted (Auth0's `blocked`). */
const PENDING = 'accounter_pending';

const isNotFound = (error: unknown) =>
  (error as { code?: string } | null)?.code === 'auth/user-not-found';

export class FirebaseUserManagement {
  private readonly auth: Auth;

  constructor(
    projectId: string,
    private readonly frontendUrl: string | undefined,
  ) {
    const app: App =
      getApps().find(a => a.name === 'accounter-auth') ??
      initializeApp({ projectId }, 'accounter-auth');
    this.auth = getAuth(app);
  }

  private async claims(uid: string, change: Record<string, unknown>) {
    const user = await this.auth.getUser(uid);
    const next: Record<string, unknown> = { ...user.customClaims };
    for (const [key, value] of Object.entries(change)) {
      if (value === undefined) delete next[key];
      else next[key] = value;
    }
    await this.auth.setCustomUserClaims(uid, next);
  }

  async getUserByEmail(email: string): Promise<string | null> {
    try {
      return (await this.auth.getUserByEmail(email)).uid;
    } catch (error) {
      if (isNotFound(error)) return null;
      throw new Error(`Failed to get Firebase user by email: ${(error as Error).message}`, {
        cause: error,
      });
    }
  }

  async getUserEmailById(uid: string): Promise<{ email: string | null; emailVerified: boolean } | null> {
    try {
      const user = await this.auth.getUser(uid);
      return { email: user.email ?? null, emailVerified: user.emailVerified };
    } catch (error) {
      console.error(`Failed to get Firebase user ${uid}:`, error);
      return null;
    }
  }

  async getUserProfileById(uid: string): Promise<{ email: string | null; name: string | null } | null> {
    try {
      const user = await this.auth.getUser(uid);
      return { email: user.email ?? null, name: user.displayName ?? null };
    } catch (error) {
      console.error(`Failed to get Firebase user profile ${uid}:`, error);
      return null;
    }
  }

  private static unusedInvitation(user: UserRecord): boolean {
    return (
      user.customClaims?.[REGISTERED_BY] === REGISTERED_BY_ACCOUNTER &&
      !user.metadata.lastSignInTime
    );
  }

  async isUnusedInvitationUser(uid: string): Promise<boolean> {
    try {
      return FirebaseUserManagement.unusedInvitation(await this.auth.getUser(uid));
    } catch (error) {
      console.error(`Failed to inspect Firebase user ${uid}:`, error);
      return false;
    }
  }

  /**
   * The account for `email`, creating one if none exists. `created` tells whether this call made it;
   * an account that already existed is never cleaned up by Accounter.
   */
  async createBlockedUser(email: string, password?: string): Promise<{ userId: string; created: boolean }> {
    const existing = await this.getUserByEmail(email);
    if (existing) return { userId: existing, created: false };
    try {
      const user = await this.auth.createUser({
        email,
        emailVerified: false,
        ...(password ? { password } : {}),
      });
      await this.auth.setCustomUserClaims(user.uid, {
        [REGISTERED_BY]: REGISTERED_BY_ACCOUNTER,
        [PENDING]: true,
      });
      return { userId: user.uid, created: true };
    } catch (error) {
      throw new Error(`Failed to create Firebase user: ${(error as Error).message}`, { cause: error });
    }
  }

  async unblockUser(uid: string): Promise<void> {
    await this.claims(uid, { [PENDING]: undefined });
  }

  async blockUser(uid: string): Promise<void> {
    await this.claims(uid, { [PENDING]: true });
  }

  /** Deletes only an unused account Accounter created; anything else is left alone. */
  async deleteUser(uid: string): Promise<void> {
    let user: UserRecord;
    try {
      user = await this.auth.getUser(uid);
    } catch (error) {
      if (isNotFound(error)) return;
      throw error;
    }
    if (!FirebaseUserManagement.unusedInvitation(user)) {
      console.warn(`Refusing to delete Firebase user ${uid}: not an unused Accounter invitation`);
      return;
    }
    await this.auth.deleteUser(uid);
  }

  /** A link where the user sets a password, then lands on the client's login page. */
  async sendPasswordResetEmail(uid: string): Promise<string> {
    const user = await this.auth.getUser(uid);
    if (!user.email) throw new Error(`Firebase user ${uid} has no email`);
    return this.auth.generatePasswordResetLink(
      user.email,
      this.frontendUrl ? { url: `${this.frontendUrl}/login` } : undefined,
    );
  }
}
