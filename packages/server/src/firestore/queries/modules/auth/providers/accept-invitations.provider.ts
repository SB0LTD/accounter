import { afterNow, pick } from '../_helpers.js';
import type {
  IDeleteInvitationPlaceholderUserQuery,
  IGetInvitationByTokenQuery,
  IGetInvitationForAcceptanceQuery,
  IGetUserIdByAuth0UserIdQuery,
  IInsertAcceptedBusinessUserQuery,
  IUpdateBusinessUserAuth0IdQuery,
  IUpdateInvitationAcceptanceQuery,
} from '../../../../../modules/auth/__generated__/accept-invitations.types.js';
import { port } from '../../../port.js';

/** UPDATE invitations SET accepted_at = NOW(), user_id = $userId WHERE id = $id */
export const updateInvitationAcceptance = port<IUpdateInvitationAcceptanceQuery>(
  async ({ id, userId }, db) => {
    if (id == null) return [];
    for (const invitation of await db.where('invitations', { id })) {
      await db.update('invitations', invitation, {
        accepted_at: db.ctx.now,
        user_id: (userId ?? null) as string,
      });
    }
    return [];
  },
);

/**
 * SELECT id, user_id, business_id, role_id, email, auth0_user_id, auth0_user_created, accepted_at,
 * expires_at FROM invitations WHERE token_hash = $tokenHash AND accepted_at IS NULL AND expires_at >
 * NOW() FOR UPDATE
 *
 * FOR UPDATE has nothing to lock here: the store commits a transaction's writes as one batch.
 */
export const getInvitationForAcceptance = port<IGetInvitationForAcceptanceQuery>(
  async ({ tokenHash }, db) => {
    if (tokenHash == null) return [];
    return (await db.where('invitations', { token_hash: tokenHash }))
      .filter(i => i.accepted_at == null && afterNow(i.expires_at, db))
      .map(i =>
        pick(i, [
          'id',
          'user_id',
          'business_id',
          'role_id',
          'email',
          'auth0_user_id',
          'auth0_user_created',
          'accepted_at',
          'expires_at',
        ]),
      );
  },
);

/**
 * SELECT id, user_id, business_id, role_id, email, auth0_user_id, accepted_at, expires_at FROM
 * invitations WHERE token_hash = $tokenHash
 */
export const getInvitationByToken = port<IGetInvitationByTokenQuery>(async ({ tokenHash }, db) => {
  if (tokenHash == null) return [];
  return (await db.where('invitations', { token_hash: tokenHash })).map(i =>
    pick(i, [
      'id',
      'user_id',
      'business_id',
      'role_id',
      'email',
      'auth0_user_id',
      'accepted_at',
      'expires_at',
    ]),
  );
});

/**
 * SELECT user_id FROM business_users WHERE auth0_user_id = $auth0UserId LIMIT 1
 *
 * LIMIT without ORDER BY: when several memberships share the Auth0 id, Postgres returns whichever
 * it reads first, as the port does.
 */
export const getUserIdByAuth0UserId = port<IGetUserIdByAuth0UserIdQuery>(
  async ({ auth0UserId }, db) => {
    if (auth0UserId == null) return [];
    const rows = await db.where('business_users', { auth0_user_id: auth0UserId });
    return rows.slice(0, 1).map(row => ({ user_id: row.user_id }));
  },
);

/** INSERT INTO business_users (user_id, auth0_user_id, business_id, role_id) VALUES (...) */
export const insertAcceptedBusinessUser = port<IInsertAcceptedBusinessUserQuery>(
  async ({ userId, auth0UserId, ownerId, roleId }, db) => {
    await db.insert('business_users', {
      user_id: (userId ?? null) as string,
      auth0_user_id: auth0UserId ?? null,
      business_id: (ownerId ?? null) as string,
      role_id: (roleId ?? null) as string,
    });
    return [];
  },
);

/**
 * UPDATE business_users SET auth0_user_id = $auth0UserId, updated_at = NOW() WHERE user_id =
 * $userId AND business_id = $ownerId
 */
export const updateBusinessUserAuth0Id = port<IUpdateBusinessUserAuth0IdQuery>(
  async ({ auth0UserId, userId, ownerId }, db) => {
    if (userId == null || ownerId == null) return [];
    for (const row of await db.where('business_users', { user_id: userId, business_id: ownerId })) {
      await db.update('business_users', row, {
        auth0_user_id: auth0UserId ?? null,
        updated_at: db.ctx.now,
      });
    }
    return [];
  },
);

/**
 * DELETE FROM business_users WHERE user_id = $userId AND business_id = $ownerId AND auth0_user_id
 * IS NULL
 *
 * Same SQL as invitations.provider.ts#deletePendingInvitationPlaceholder; the index keys queries
 * by their text, so this port serves both.
 */
export const deleteInvitationPlaceholderUser = port<IDeleteInvitationPlaceholderUserQuery>(
  async ({ userId, ownerId }, db) => {
    if (userId == null || ownerId == null) return [];
    for (const row of await db.where('business_users', { user_id: userId, business_id: ownerId })) {
      if (row.auth0_user_id == null) await db.delete('business_users', row);
    }
    return [];
  },
);
