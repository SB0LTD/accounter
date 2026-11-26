import { castUuid } from '../_helpers.js';
import type { IGetAuth0UserReferencesQuery } from '../../../../../modules/auth/__generated__/auth0-user-references.types.js';
import { port } from '../../../port.js';

/**
 * SELECT (
 *   EXISTS (SELECT 1 FROM invitations WHERE auth0_user_id = $auth0UserId
 *           AND ($excludeInvitationId::uuid IS NULL OR id <> $excludeInvitationId::uuid))
 *   OR EXISTS (SELECT 1 FROM business_users WHERE auth0_user_id = $auth0UserId)
 * ) AS "referenced!"
 *
 * pgTyped strips the `!` hint from the column name, so the row's key is `referenced`.
 */
export const getAuth0UserReferences = port<IGetAuth0UserReferencesQuery>(
  async ({ auth0UserId, excludeInvitationId }, db) => {
    const excluded = castUuid(excludeInvitationId);
    if (auth0UserId == null) return [{ referenced: false }];
    const invitations = await db.where('invitations', { auth0_user_id: auth0UserId });
    if (invitations.some(i => excluded === null || i.id !== excluded)) {
      return [{ referenced: true }];
    }
    const memberships = await db.where('business_users', { auth0_user_id: auth0UserId });
    return [{ referenced: memberships.length > 0 }];
  },
);
