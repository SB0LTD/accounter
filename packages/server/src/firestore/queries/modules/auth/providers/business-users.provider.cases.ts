import { F080 } from '../_fixture-ids.js';
import type {
  IDeleteBusinessUserQuery,
  IGetBusinessUserIdentitiesQuery,
  IGetBusinessUsersByAuth0IdsQuery,
  IInsertBusinessUserQuery,
  IListBusinessUsersQuery,
} from '../../../../../modules/auth/__generated__/business-users.types.js';
import { caseFor, type Cases } from '../../../cases.js';

export const cases: Cases = {
  getBusinessUsersByAuth0Ids: caseFor<IGetBusinessUsersByAuth0IdsQuery>(() => [
    { auth0UserIds: ['auth0|fixture080-owner', 'auth0|fixture080-accepted'] },
    { auth0UserIds: ['auth0|nobody080'] },
  ]),
  getBusinessUserIdentities: caseFor<IGetBusinessUserIdentitiesQuery>(s => [
    {
      userIds: [F080.u1, F080.u2, F080.u3, F080.u4],
      businessIds: [s.businessId, F080.sister],
    },
    { userIds: [F080.u1, ...(s.userId ? [s.userId] : [])], businessIds: [s.businessId] },
    { userIds: [s.missingId], businessIds: [s.businessId] },
  ]),
  insertBusinessUser: caseFor<IInsertBusinessUserQuery>(s => [
    { userId: F080.inviteFresh, auth0UserId: null, ownerId: s.businessId, roleId: 'employee' },
    // Already a member: DO NOTHING
    { userId: F080.u1, auth0UserId: 'auth0|other', ownerId: s.businessId, roleId: 'employee' },
    // Unknown role
    { userId: F080.inviteFresh, auth0UserId: null, ownerId: s.businessId, roleId: 'nope' },
    // NOT NULL user_id (the column is listed, so no default)
    { userId: null, auth0UserId: null, ownerId: s.businessId, roleId: 'employee' },
  ]),
  listBusinessUsers: caseFor<IListBusinessUsersQuery>(s => [
    { ownerId: s.businessId },
    { ownerId: F080.sister },
    { ownerId: s.missingId },
  ]),
  deleteBusinessUser: caseFor<IDeleteBusinessUserQuery>(s => [
    { userId: F080.u2, ownerId: s.businessId },
    // A member of another business
    { userId: F080.u4, ownerId: s.businessId },
  ]),
};
