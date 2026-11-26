import type { IGetSuperAdminByAuth0IdQuery } from '../../../../../modules/auth/__generated__/super-admin.types.js';
import { caseFor, type Cases } from '../../../cases.js';

export const cases: Cases = {
  getSuperAdminByAuth0Id: caseFor<IGetSuperAdminByAuth0IdQuery>(() => [
    { auth0UserId: 'auth0|fixture080-super' },
    { auth0UserId: 'auth0|nobody080' },
    { auth0UserId: null },
  ]),
};
