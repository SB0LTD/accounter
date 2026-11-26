import type {
  IExpireActiveInvitationsQuery,
  IGetBootstrapBusinessQuery,
  IGetBootstrapContextQuery,
  ISetRlsContextQuery,
  ISetSelfOwnerQuery,
} from '../../../../../modules/onboarding/__generated__/admin-onboarding.types.js';
import { caseFor, type Cases } from '../../../cases.js';

/** Fixture rows of scripts/firestore/fixtures/080-auth-email.sql. */
const SISTER = '0f080000-0000-4000-8000-000000000001';
const VENDOR = '0f080000-0000-4000-8000-000000000002';

export const cases: Cases = {
  setRlsContext: caseFor<ISetRlsContextQuery>(s => [
    { businessId: s.businessId },
    { businessId: SISTER },
    { businessId: null },
  ]),
  setSelfOwner: caseFor<ISetSelfOwnerQuery>(s => [
    // Already self-owned
    { id: s.businessId },
    // Would hand the row to another owner: row-level security refuses
    { id: VENDOR },
    { id: s.missingId },
  ]),
  getBootstrapBusiness: caseFor<IGetBootstrapBusinessQuery>(s => [
    { id: s.businessId },
    { id: SISTER },
    { id: s.missingId },
  ]),
  getBootstrapContext: caseFor<IGetBootstrapContextQuery>(s => [
    { ownerId: s.businessId },
    { ownerId: s.missingId },
  ]),
  expireActiveInvitations: caseFor<IExpireActiveInvitationsQuery>(s => [
    { businessId: s.businessId, email: 'PENDING.user080@example.com' },
    { businessId: s.businessId, email: 'expired080@example.com' },
    { businessId: SISTER, email: 'pending.user080@example.com' },
  ]),
};
