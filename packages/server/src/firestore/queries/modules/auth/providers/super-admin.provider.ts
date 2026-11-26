import type { IGetSuperAdminByAuth0IdQuery } from '../../../../../modules/auth/__generated__/super-admin.types.js';
import { port } from '../../../port.js';

/** SELECT auth0_user_id FROM super_admins WHERE auth0_user_id = $auth0UserId LIMIT 1 */
export const getSuperAdminByAuth0Id = port<IGetSuperAdminByAuth0IdQuery>(
  async ({ auth0UserId }, db) => {
    if (auth0UserId == null) return [];
    return (await db.where('super_admins', { auth0_user_id: auth0UserId }))
      .slice(0, 1)
      .map(row => ({ auth0_user_id: row.auth0_user_id }));
  },
);
