import { F080 } from '../_fixture-ids.js';
import type {
  IDeleteInvitationQuery,
  IGetActiveInvitationsByEmailsQuery,
  IGetInvitationsByTokensQuery,
  IInsertInvitationQuery,
  IListInvitationsQuery,
} from '../../../../../modules/auth/__generated__/invitations.types.js';
import { caseFor, type Cases } from '../../../cases.js';

export const cases: Cases = {
  getActiveInvitationsByEmails: caseFor<IGetActiveInvitationsByEmailsQuery>(s => [
    {
      ownerId: s.businessId,
      emails: ['pending.user080@example.com', 'EXPIRED080@example.com', 'accepted080@example.com'],
    },
    { ownerId: F080.sister, emails: ['PENDING.USER080@EXAMPLE.COM'] },
    { ownerId: s.businessId, emails: [] },
    { ownerId: s.businessId, emails: null },
  ]),
  getInvitationsByTokens: caseFor<IGetInvitationsByTokensQuery>(() => [
    { tokenHashes: ['tok080-pending', 'tok080-sister', 'tok080-accepted'] },
    { tokenHashes: ['no-such-token'] },
  ]),
  listInvitations: caseFor<IListInvitationsQuery>(s => [
    { ownerId: s.businessId },
    { ownerId: F080.sister },
    { ownerId: s.missingId },
  ]),
  deleteInvitation: caseFor<IDeleteInvitationQuery>(s => [
    { invitationId: F080.i1, ownerId: s.businessId },
    // Accepted: not revocable
    { invitationId: F080.i2, ownerId: s.businessId },
    // Another business's invitation
    { invitationId: F080.i4, ownerId: s.businessId },
  ]),
  insertInvitation: caseFor<IInsertInvitationQuery>(s => {
    const base = {
      userId: F080.u2,
      ownerId: s.businessId,
      email: 'new080@example.com',
      roleId: 'accountant',
      tokenHash: 'tok080-new',
      auth0UserCreated: true,
      auth0UserId: 'auth0|new080',
      invitedByUserId: F080.u1,
      invitedByBusinessId: s.businessId,
      expiresAt: new Date('2099-06-01T00:00:00Z'),
    };
    return [
      base,
      // A pending invitation for that email already exists (partial unique index)
      { ...base, email: 'Pending.User080@Example.com' },
      // Same token
      { ...base, tokenHash: 'tok080-pending' },
      // NOT NULL auth0_user_created (listed, so no default)
      { ...base, auth0UserCreated: null },
      // No such membership
      { ...base, userId: s.missingId },
    ];
  }),
};
