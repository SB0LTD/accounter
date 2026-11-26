import type {
  IGetAdminContextsQuery,
  IGetSecuritiesContextForUpdateQuery,
  IGetSecurityBusinessIdsQuery,
  IUpdateAdminContextQuery,
  IUpdateSecuritiesContextQuery,
} from '../../../../../modules/admin-context/__generated__/admin-context.types.js';
import { caseFor, type Cases } from '../../../cases.js';

/** Fixture rows of scripts/firestore/fixtures/080-auth-email.sql. */
const SISTER = '0f080000-0000-4000-8000-000000000001';
const SECURITY = '0f080000-0000-4000-8000-000000000004';

export const cases: Cases = {
  getAdminContexts: caseFor<IGetAdminContextsQuery>(s => [
    { ownerIds: [s.businessId] },
    { ownerIds: [s.missingId] },
  ]),
  getSecurityBusinessIds: caseFor<IGetSecurityBusinessIdsQuery>(s => [
    // The sister business's security is outside the read scope
    { ownerIds: [s.businessId, SISTER] },
    { ownerIds: [s.missingId] },
  ]),
  updateAdminContext: caseFor<IUpdateAdminContextQuery>(s => {
    const context = s.rows('user_context').find(r => r.owner_id === s.businessId)!;
    return [
      // Every parameter NULL: nothing changes, the row comes back
      { ownerId: s.businessId },
      {
        ownerId: s.businessId,
        locality: 'ISR',
        ledgerLock: '2025-12-31',
        dateEstablished: '2019-01-01',
        initialAccounterYear: 2021,
        defaultLocalCurrency: 'USD',
        swiftBusinessId: SECURITY,
        incomeInAdvanceTaxCategoryId: context.default_tax_category_id as string,
      },
      // Unknown business: foreign key violation
      { ownerId: s.businessId, vatBusinessId: s.missingId },
      { ownerId: s.missingId, locality: 'ISR' },
    ];
  }),
  getSecuritiesContextForUpdate: caseFor<IGetSecuritiesContextForUpdateQuery>(s => [
    { ownerId: s.businessId },
    { ownerId: s.missingId },
  ]),
  updateSecuritiesContext: caseFor<IUpdateSecuritiesContextQuery>(s => [
    {
      ownerId: s.businessId,
      securitiesContext: {
        foreignSecuritiesBusinessId: SECURITY,
        sortCode: 900,
        taxCategories: { foreignSecuritiesFees: null },
      } as Record<string, unknown> as never,
    },
    // JSON text, as a caller might pass it
    { ownerId: s.businessId, securitiesContext: '{"sortCode": 901}' },
    // Not an object: the check constraint refuses it
    { ownerId: s.businessId, securitiesContext: '[1, 2]' },
    { ownerId: s.missingId, securitiesContext: {} },
  ]),
};
