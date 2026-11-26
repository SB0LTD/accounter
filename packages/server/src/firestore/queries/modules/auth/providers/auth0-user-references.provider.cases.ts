import { F080 } from '../_fixture-ids.js';
import type { IGetAuth0UserReferencesQuery } from '../../../../../modules/auth/__generated__/auth0-user-references.types.js';
import { caseFor, type Cases } from '../../../cases.js';

export const cases: Cases = {
  getAuth0UserReferences: caseFor<IGetAuth0UserReferencesQuery>(() => [
    // Two invitations
    { auth0UserId: 'auth0|fixture080-pending', excludeInvitationId: null },
    { auth0UserId: 'auth0|fixture080-pending', excludeInvitationId: F080.i1 },
    // Only the excluded invitation
    { auth0UserId: 'auth0|fixture080-expired', excludeInvitationId: F080.i3 },
    // Excluded invitation, but a membership
    { auth0UserId: 'auth0|fixture080-accepted', excludeInvitationId: F080.i2 },
    { auth0UserId: 'auth0|nobody080', excludeInvitationId: null },
    { auth0UserId: null, excludeInvitationId: null },
    // Not a uuid: the cast fails
    { auth0UserId: 'auth0|fixture080-pending', excludeInvitationId: 'not-a-uuid' },
  ]),
};
