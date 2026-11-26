import { afterNow, pick } from '../_helpers.js';
import type {
  IDeleteInvitationQuery,
  IDeletePendingInvitationPlaceholderQuery,
  IGetActiveInvitationsByEmailsQuery,
  IGetInvitationsByTokensQuery,
  IInsertInvitationQuery,
  IListInvitationsQuery,
} from '../../../../../modules/auth/__generated__/invitations.types.js';
import { orderBy } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';
import { deleteInvitationPlaceholderUser } from './accept-invitations.provider.js';

/**
 * DELETE FROM business_users WHERE user_id = $userId AND business_id = $ownerId AND auth0_user_id
 * IS NULL
 *
 * The same SQL as accept-invitations.provider.ts#deleteInvitationPlaceholderUser. The index keys
 * queries by their text, so that port is the one that runs for both; this name is exported for
 * completeness.
 */
export const deletePendingInvitationPlaceholder = port<IDeletePendingInvitationPlaceholderQuery>(
  deleteInvitationPlaceholderUser,
);

/**
 * SELECT id, email FROM invitations WHERE business_id = $ownerId
 *   AND lower(email) = ANY(SELECT lower(u) FROM unnest($emails::varchar[]) AS u)
 *   AND accepted_at IS NULL AND expires_at > NOW()
 */
export const getActiveInvitationsByEmails = port<IGetActiveInvitationsByEmailsQuery>(
  async ({ ownerId, emails }, db) => {
    if (ownerId == null || emails == null) return [];
    const wanted = new Set(emails.filter(e => e != null).map(e => e.toLowerCase()));
    return (await db.where('invitations', { business_id: ownerId }))
      .filter(
        i =>
          wanted.has(i.email.toLowerCase()) && i.accepted_at == null && afterNow(i.expires_at, db),
      )
      .map(i => ({ id: i.id, email: i.email }));
  },
);

/**
 * SELECT id, business_id, role_id, auth0_user_id, accepted_at, expires_at, token_hash FROM
 * invitations WHERE token_hash IN $$tokenHashes
 */
export const getInvitationsByTokens = port<IGetInvitationsByTokensQuery>(
  async ({ tokenHashes }, db) =>
    (await db.whereIn('invitations', 'token_hash', tokenHashes)).map(i =>
      pick(i, [
        'id',
        'business_id',
        'role_id',
        'auth0_user_id',
        'accepted_at',
        'expires_at',
        'token_hash',
      ]),
    ),
);

/**
 * SELECT id, email, role_id, expires_at FROM invitations WHERE business_id = $ownerId AND
 * accepted_at IS NULL ORDER BY created_at DESC
 */
export const listInvitations = port<IListInvitationsQuery>(async ({ ownerId }, db) => {
  if (ownerId == null) return [];
  const pending = (await db.where('invitations', { business_id: ownerId })).filter(
    i => i.accepted_at == null,
  );
  return orderBy(pending, [{ value: i => i.created_at, desc: true }]).map(i =>
    pick(i, ['id', 'email', 'role_id', 'expires_at']),
  );
});

/**
 * DELETE FROM invitations WHERE id = $invitationId AND business_id = $ownerId AND accepted_at IS
 * NULL RETURNING id, user_id
 */
export const deleteInvitation = port<IDeleteInvitationQuery>(
  async ({ invitationId, ownerId }, db) => {
    if (invitationId == null || ownerId == null) return [];
    const result: { id: string; user_id: string }[] = [];
    for (const i of await db.where('invitations', { id: invitationId, business_id: ownerId })) {
      if (i.accepted_at != null) continue;
      await db.delete('invitations', i);
      result.push({ id: i.id, user_id: i.user_id });
    }
    return result;
  },
);

/**
 * INSERT INTO invitations (user_id, business_id, email, role_id, token_hash, auth0_user_created,
 * auth0_user_id, invited_by_user_id, invited_by_business_id, expires_at) VALUES (...) RETURNING id,
 * email, business_id, role_id, expires_at
 */
export const insertInvitation = port<IInsertInvitationQuery>(async (params, db) => {
  const row = await db.insert('invitations', {
    user_id: (params.userId ?? null) as string,
    business_id: (params.ownerId ?? null) as string,
    email: (params.email ?? null) as string,
    role_id: (params.roleId ?? null) as string,
    token_hash: (params.tokenHash ?? null) as string,
    auth0_user_created: (params.auth0UserCreated ?? null) as boolean,
    auth0_user_id: params.auth0UserId ?? null,
    invited_by_user_id: params.invitedByUserId ?? null,
    invited_by_business_id: params.invitedByBusinessId ?? null,
    expires_at: (params.expiresAt ?? null) as Date,
  });
  return row ? [pick(row, ['id', 'email', 'business_id', 'role_id', 'expires_at'])] : [];
});
