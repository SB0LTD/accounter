import { F080 } from '../_fixture-ids.js';
import type {
  IDeleteInvitationPlaceholderUserQuery,
  IGetInvitationByTokenQuery,
  IGetInvitationForAcceptanceQuery,
  IGetUserIdByAuth0UserIdQuery,
  IInsertAcceptedBusinessUserQuery,
  IUpdateBusinessUserAuth0IdQuery,
  IUpdateInvitationAcceptanceQuery,
} from '../../../../../modules/auth/__generated__/accept-invitations.types.js';
import { caseFor, type Cases } from '../../../cases.js';

export const cases: Cases = {
  updateInvitationAcceptance: caseFor<IUpdateInvitationAcceptanceQuery>(s => [
    { id: F080.i1, userId: F080.u2 },
    // The accepting user's existing membership: the (user_id, business_id) foreign key holds
    { id: F080.i1, userId: F080.u1 },
    { id: s.missingId, userId: F080.u1 },
    // NOT NULL user_id
    { id: F080.i1, userId: null },
    // No membership (missingId, demo tenant): foreign key violation
    { id: F080.i1, userId: s.missingId },
  ]),
  getInvitationForAcceptance: caseFor<IGetInvitationForAcceptanceQuery>(() => [
    { tokenHash: 'tok080-pending' },
    { tokenHash: 'tok080-accepted' },
    { tokenHash: 'tok080-expired' },
    { tokenHash: null },
  ]),
  getInvitationByToken: caseFor<IGetInvitationByTokenQuery>(() => [
    { tokenHash: 'tok080-pending' },
    { tokenHash: 'tok080-accepted' },
    { tokenHash: 'no-such-token' },
  ]),
  getUserIdByAuth0UserId: caseFor<IGetUserIdByAuth0UserIdQuery>(() => [
    { auth0UserId: 'auth0|fixture080-accepted' },
    // Two memberships of the same user
    { auth0UserId: 'auth0|fixture080-owner' },
    { auth0UserId: 'auth0|nobody080' },
  ]),
  insertAcceptedBusinessUser: caseFor<IInsertAcceptedBusinessUserQuery>(s => [
    {
      userId: F080.u3,
      auth0UserId: 'auth0|fixture080-accepted',
      ownerId: F080.sister,
      roleId: 'employee',
    },
    // Already a member: primary key violation
    {
      userId: F080.u1,
      auth0UserId: 'auth0|fixture080-owner',
      ownerId: s.businessId,
      roleId: 'employee',
    },
    // Unknown role, unknown admin business: foreign key violations
    { userId: F080.u3, auth0UserId: null, ownerId: F080.sister, roleId: 'no-such-role' },
    { userId: F080.u3, auth0UserId: null, ownerId: s.missingId, roleId: 'employee' },
  ]),
  updateBusinessUserAuth0Id: caseFor<IUpdateBusinessUserAuth0IdQuery>(s => [
    { auth0UserId: 'auth0|new080', userId: F080.u2, ownerId: s.businessId },
    { auth0UserId: null, userId: F080.u3, ownerId: s.businessId },
    { auth0UserId: 'auth0|new080', userId: F080.u2, ownerId: F080.sister },
  ]),
  deleteInvitationPlaceholderUser: caseFor<IDeleteInvitationPlaceholderUserQuery>(s => [
    // Placeholder: deleted (its invitation cascades)
    { userId: F080.u2, ownerId: s.businessId },
    // A member who signed in: kept
    { userId: F080.u3, ownerId: s.businessId },
    { userId: F080.u4, ownerId: F080.sister },
  ]),
};
