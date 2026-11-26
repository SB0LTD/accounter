import { FX } from '../_fixture-ids.js';
import type {
  IGetBusinessByEmailQuery,
  IGetBusinessesByFiltersParams,
  IGetBusinessesByFiltersQuery,
  IGetBusinessesByIdsQuery,
  IInsertBusinessesParams,
  IInsertBusinessesQuery,
  IReplaceBusinessesQuery,
  IUpdateBusinessQuery,
} from '../../../../../modules/financial-entities/__generated__/businesses.types.js';
import { caseFor, type Cases } from '../../../cases.js';

/** The provider's parameters when no filter is set. */
const noFilters: IGetBusinessesByFiltersParams = {
  name: null,
  isTaxCategoryIds: 0,
  taxCategoryIds: [null],
  withoutTaxCategory: null,
  isSortCodes: 0,
  sortCodes: [null],
  withoutSortCode: null,
  isCountries: 0,
  countries: [null],
  isClient: null,
  isActive: null,
  isAdmin: null,
};

type NewBusiness = IInsertBusinessesParams['businesses'][number];
const newBusiness = (ownerId: string, values: Partial<NewBusiness>): NewBusiness => ({
  id: FX.theta,
  hebrewName: null,
  address: null,
  city: null,
  zipCode: null,
  email: null,
  website: null,
  phoneNumber: null,
  governmentId: null,
  exemptDealer: false,
  suggestions: null,
  optionalVat: false,
  country: 'ISR',
  pcn874RecordTypeOverride: null,
  isReceiptEnough: false,
  isDocumentsOptional: false,
  ownerId,
  ...values,
});

export const cases: Cases = {
  getBusinessesByIds: caseFor<IGetBusinessesByIdsQuery>(s => [
    { ids: [FX.alpha, FX.beta, FX.theta, s.businessId, s.missingId] },
    { ids: [FX.alpha.toUpperCase(), null] },
    { ids: [s.missingId] },
  ]),
  getBusinessesByFilters: caseFor<IGetBusinessesByFiltersQuery>(() => [
    noFilters,
    { ...noFilters, name: 'alpha' },
    { ...noFilters, name: 'ACME' },
    { ...noFilters, name: 'אלפא' }, // hebrew_name
    { ...noFilters, name: '%' }, // literal, not a wildcard
    { ...noFilters, isTaxCategoryIds: 1, taxCategoryIds: [FX.tcAlpha] },
    { ...noFilters, isTaxCategoryIds: 1, taxCategoryIds: [FX.tcBeta], withoutTaxCategory: true },
    { ...noFilters, withoutTaxCategory: true },
    { ...noFilters, withoutTaxCategory: false },
    { ...noFilters, isSortCodes: 1, sortCodes: [100, 200] },
    { ...noFilters, withoutSortCode: true },
    { ...noFilters, isSortCodes: 1, sortCodes: [100], withoutSortCode: true },
    { ...noFilters, isCountries: 1, countries: ['USA', 'GBR'] },
    { ...noFilters, isClient: true },
    { ...noFilters, isClient: false },
    { ...noFilters, isActive: false },
    { ...noFilters, isAdmin: true },
    { ...noFilters, isAdmin: false },
    {
      ...noFilters,
      name: 'a',
      isCountries: 1,
      countries: ['ISR'],
      isClient: true,
      isActive: true,
    },
    // NULL flags: `NULL = 0` is not true, so nothing passes the tax-category predicate
    { ...noFilters, isTaxCategoryIds: null },
    { ...noFilters, isSortCodes: null, withoutSortCode: true },
  ]),
  getBusinessByEmail: caseFor<IGetBusinessByEmailQuery>(() => [
    { email: 'invoice-123@cloudflare.example' }, // *@cloudflare.example
    { email: 'BILLING_TEAM@example.com' }, // case-insensitive
    { email: 'billingXteam@example.com' }, // `_` is literal
    { email: '50%off@deals.example' },
    { email: '50Xoff@deals.example' }, // `%` is literal
    { email: 'a#b@hash.example' }, // the escape character itself
    { email: 'exact@gamma.example' },
    { email: '5' }, // a number in the emails array
    { email: '{"x": 1}' }, // an object in the emails array, as jsonb prints it
    { email: 'nobody@nowhere.example' },
    { email: null },
  ]),
  updateBusiness: caseFor<IUpdateBusinessQuery>(s => [
    {
      businessId: FX.alpha,
      hebrewName: 'אלפא חדש',
      city: 'Jerusalem',
      suggestionData: { emails: ['x@alpha.example'], phrases: ['alpha'] },
      pcn874RecordTypeOverride: 'S2',
      exemptDealer: true,
    },
    {
      businessId: FX.beta,
      vatNumber: '123',
      address: 'Somewhere 1',
      addressHebrew: 'מקום 1',
      email: 'e@beta.example',
      website: 'https://beta.example',
      phoneNumber: '+1-555',
      zipCode: '90210',
      country: 'GBR',
      isDocumentsOptional: false,
      isReceiptEnough: true,
      optionalVat: false,
    },
    { businessId: FX.gamma }, // nothing to change
    { businessId: FX.alpha, country: 'XXX' }, // no such country: 23503
    { businessId: FX.alpha, country: 'ISRA' }, // varchar(3): 22001
    { businessId: FX.alpha, pcn874RecordTypeOverride: 'ZZ' as never }, // enum: 22P02
    { businessId: s.missingId, country: 'ISRA' }, // no row, no length check
    { businessId: s.missingId, pcn874RecordTypeOverride: 'ZZ' as never }, // bound anyway: 22P02
    { businessId: null, city: 'Nowhere' },
  ]),
  insertBusinesses: caseFor<IInsertBusinessesQuery>(s => [
    // theta is a financial entity without a businesses row
    {
      businesses: [
        newBusiness(s.businessId, {
          hebrewName: 'תטא',
          city: 'Eilat',
          zipCode: '8800000',
          email: 'theta@example.com',
          governmentId: '515151515',
          suggestions: { emails: ['*@theta.example'] },
          country: 'USA',
          pcn874RecordTypeOverride: 'S1',
          isReceiptEnough: true,
        }),
      ],
    },
    { businesses: [newBusiness(s.businessId, { id: FX.alpha })] }, // exists: 23505
    { businesses: [newBusiness(s.businessId, { id: FX.unused })] }, // no financial entity: 23503
    { businesses: [newBusiness(s.businessId, { country: null })] }, // explicit NULL: 23502
    { businesses: [newBusiness(s.businessId, { city: 'x'.repeat(51) })] }, // varchar(50): 22001
    { businesses: [newBusiness(s.missingId, {})] }, // another tenant: 42501
    { businesses: [newBusiness(null as never, {})] }, // NULL owner: RLS before NOT NULL
    {
      businesses: [newBusiness(s.businessId, {}), newBusiness(s.businessId, { id: FX.gamma })],
    },
  ]),
  replaceBusinesses: caseFor<IReplaceBusinessesQuery>(s => [
    { targetBusinessId: FX.zeta, businessIdToReplace: FX.eta },
    {
      targetBusinessId: FX.zeta,
      businessIdToReplace: s.values('transactions', 'business_id', 1)[0] as string,
    },
    { targetBusinessId: FX.zeta, businessIdToReplace: s.businessId },
    { targetBusinessId: s.missingId, businessIdToReplace: FX.eta }, // 23503
    { targetBusinessId: FX.alpha, businessIdToReplace: FX.eta }, // alpha is a client already: 23505
    { targetBusinessId: null, businessIdToReplace: FX.eta }, // NOT NULL
    { targetBusinessId: FX.zeta, businessIdToReplace: s.missingId },
    { targetBusinessId: 'not-a-uuid', businessIdToReplace: FX.eta },
  ]),
};
