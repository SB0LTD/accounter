import { FX } from '../_fixture-ids.js';
import type {
  IEnsureBusinessParams,
  IEnsureBusinessQuery,
  IEnsureCountryQuery,
  IEnsureFinancialEntityQuery,
  IEnsureTaxCategoryQuery,
} from '../../../../../modules/financial-entities/__generated__/entity-ensure.types.js';
import { caseFor, type Cases } from '../../../cases.js';

/** What ensureBusinessForEntity passes when no options are given. */
const business = (
  ownerId: string | null,
  values: IEnsureBusinessParams,
): IEnsureBusinessParams => ({
  hebrewName: null,
  address: null,
  city: null,
  zipCode: null,
  email: null,
  website: null,
  phoneNumber: null,
  governmentId: null,
  exemptDealer: false,
  optionalVat: false,
  country: 'ISR',
  isReceiptEnough: false,
  isDocumentsOptional: false,
  ownerId,
  ...values,
});

export const cases: Cases = {
  ensureFinancialEntity: caseFor<IEnsureFinancialEntityQuery>(s => [
    { id: FX.unused, name: 'Ensured Entity', type: 'business', ownerId: s.businessId },
    { id: FX.alpha, name: 'Ignored', type: 'business', ownerId: s.businessId }, // exists
    { id: FX.unused, name: 'No owner', type: 'business', ownerId: null }, // RLS
    { id: null, name: 'No id', type: 'business', ownerId: s.businessId }, // explicit NULL id
    { id: FX.unused, name: null, type: 'tag', ownerId: s.businessId },
    { id: FX.unused, name: 'Other tenant', type: 'business', ownerId: s.missingId },
  ]),
  ensureBusiness: caseFor<IEnsureBusinessQuery>(s => [
    business(s.businessId, {
      id: FX.theta,
      hebrewName: 'תטא',
      address: 'Road 2',
      city: 'Ashdod',
      zipCode: '7700000',
      email: 'theta@example.com',
      website: 'theta.example',
      phoneNumber: '08-0000000',
      governmentId: '516000000',
      exemptDealer: true,
      optionalVat: true,
      country: 'USA',
      isReceiptEnough: true,
      isDocumentsOptional: true,
    }),
    business(s.businessId, { id: FX.alpha }), // exists: DO NOTHING
    business(s.businessId, { id: FX.unused }), // no financial entity: 23503
    business(null, { id: FX.theta }), // NULL owner: RLS before NOT NULL
    business(s.businessId, { id: FX.theta, country: null }),
    business(s.businessId, { id: FX.theta, zipCode: '1234567890123456' }), // varchar(15)
    business(s.businessId, { id: 'not-a-uuid' }),
  ]),
  ensureTaxCategory: caseFor<IEnsureTaxCategoryQuery>(s => [
    { id: FX.theta, hashavshevetName: 'THETA', taxExcluded: false, ownerId: s.businessId },
    { id: FX.tcAlpha, hashavshevetName: 'Ignored', taxExcluded: true, ownerId: s.businessId },
    { id: FX.unused, hashavshevetName: null, taxExcluded: false, ownerId: s.businessId }, // 23503
    { id: FX.theta, hashavshevetName: null, taxExcluded: null, ownerId: s.businessId }, // 23502
    { id: FX.theta, hashavshevetName: null, taxExcluded: false, ownerId: null }, // RLS
  ]),
  ensureCountry: caseFor<IEnsureCountryQuery>(s => {
    const israel = s.rows('countries').find(c => c.code === 'ISR')?.name as string;
    return [
      { code: 'ZZZ', name: 'Zedland' },
      { code: 'ISR', name: 'Ignored' }, // exists: DO NOTHING
      { code: 'ZZY', name: israel }, // the name is unique too, and not the conflict target: 23505
      { code: 'ZZZZ', name: 'Too long' }, // varchar(3)
      { code: null, name: 'No code' },
    ];
  }),
};
