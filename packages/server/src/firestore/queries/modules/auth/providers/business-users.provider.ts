import { fallbackEmail } from '../_helpers.js';
import type {
  IDeleteBusinessUserQuery,
  IGetBusinessUserIdentitiesQuery,
  IGetBusinessUsersByAuth0IdsQuery,
  IInsertBusinessUserQuery,
  IListBusinessUsersQuery,
} from '../../../../../modules/auth/__generated__/business-users.types.js';
import { inList, orderBy } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';

/**
 * SELECT user_id, auth0_user_id, business_id, role_id FROM business_users WHERE auth0_user_id IN
 * $$auth0UserIds ORDER BY updated_at DESC
 */
export const getBusinessUsersByAuth0Ids = port<IGetBusinessUsersByAuth0IdsQuery>(
  async ({ auth0UserIds }, db) => {
    const rows = await db.whereIn('business_users', 'auth0_user_id', auth0UserIds);
    return orderBy(rows, [{ value: row => row.updated_at, desc: true }]).map(row => ({
      user_id: row.user_id,
      auth0_user_id: row.auth0_user_id,
      business_id: row.business_id,
      role_id: row.role_id,
    }));
  },
);

/**
 * SELECT bu.user_id, bu.business_id, bu.auth0_user_id,
 *        (SELECT i.email FROM invitations i WHERE i.user_id = bu.user_id
 *           AND i.business_id = bu.business_id ORDER BY i.created_at DESC LIMIT 1) AS fallback_email
 * FROM business_users bu WHERE bu.user_id IN $$userIds AND bu.business_id IN $$businessIds
 */
export const getBusinessUserIdentities = port<IGetBusinessUserIdentitiesQuery>(
  async ({ userIds, businessIds }, db) => {
    const inBusinesses = inList(businessIds);
    const rows = (await db.whereIn('business_users', 'user_id', userIds)).filter(row =>
      inBusinesses(row.business_id),
    );
    const result = [];
    for (const row of rows) {
      result.push({
        user_id: row.user_id,
        business_id: row.business_id,
        auth0_user_id: row.auth0_user_id,
        fallback_email: await fallbackEmail(db, row.user_id, row.business_id),
      });
    }
    return result;
  },
);

/**
 * INSERT INTO business_users (user_id, auth0_user_id, business_id, role_id) VALUES ($userId,
 * $auth0UserId, $ownerId, $roleId) ON CONFLICT (user_id, business_id) DO NOTHING RETURNING *
 */
export const insertBusinessUser = port<IInsertBusinessUserQuery>(
  async ({ userId, auth0UserId, ownerId, roleId }, db) => {
    const row = await db.insert(
      'business_users',
      {
        user_id: (userId ?? null) as string,
        auth0_user_id: auth0UserId ?? null,
        business_id: (ownerId ?? null) as string,
        role_id: (roleId ?? null) as string,
      },
      { target: ['user_id', 'business_id'], action: 'nothing' },
    );
    return row ? [row] : [];
  },
);

/**
 * SELECT bu.user_id, bu.auth0_user_id, bu.role_id, bu.created_at,
 *        (SELECT i.email FROM invitations i WHERE i.user_id = bu.user_id
 *           AND i.business_id = bu.business_id ORDER BY i.created_at DESC LIMIT 1) AS fallback_email
 * FROM business_users bu WHERE bu.business_id = $ownerId ORDER BY bu.created_at DESC
 */
export const listBusinessUsers = port<IListBusinessUsersQuery>(async ({ ownerId }, db) => {
  if (ownerId == null) return [];
  const rows = orderBy(await db.where('business_users', { business_id: ownerId }), [
    { value: row => row.created_at, desc: true },
  ]);
  const result = [];
  for (const row of rows) {
    result.push({
      user_id: row.user_id,
      auth0_user_id: row.auth0_user_id,
      role_id: row.role_id,
      created_at: row.created_at,
      fallback_email: await fallbackEmail(db, row.user_id, row.business_id),
    });
  }
  return result;
});

/** DELETE FROM business_users WHERE user_id = $userId AND business_id = $ownerId RETURNING user_id */
export const deleteBusinessUser = port<IDeleteBusinessUserQuery>(
  async ({ userId, ownerId }, db) => {
    if (userId == null || ownerId == null) return [];
    const result: { user_id: string }[] = [];
    for (const row of await db.where('business_users', { user_id: userId, business_id: ownerId })) {
      await db.delete('business_users', row);
      result.push({ user_id: row.user_id });
    }
    return result;
  },
);
