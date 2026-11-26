import { FX } from '../_fixture-ids.js';
import type {
  IBatchUpdateChargesQuery,
  IDeleteChargesByIdsQuery,
  IGenerateChargeQuery,
  IGetChargesByFiltersParams,
  IGetChargesByFiltersQuery,
  IGetChargesByIdsQuery,
  IGetChargesByTransactionIdsQuery,
  IGetSimilarChargesQuery,
  IUpdateAccountantApprovalQuery,
  IUpdateChargeQuery,
} from '../../../../../modules/charges/__generated__/charges.types.js';
import { caseFor, type Cases, type Snapshot } from '../../../cases.js';

/** The parameters ChargesProvider.getChargesByFilters builds when nothing is filtered. */
function filters(
  s: Snapshot,
  over: Partial<IGetChargesByFiltersParams> = {},
): IGetChargesByFiltersParams {
  return {
    asc: false,
    sortColumn: 'event_date',
    isOwnerIds: 0,
    isBusinessIds: 0,
    isIDs: 0,
    isTags: 0,
    isAccountantStatuses: 0,
    isBusinessTripIds: 0,
    isAccountIds: 0,
    isExcludedBusinessIds: 0,
    isExcludedTags: 0,
    isExcludedAccountIds: 0,
    fromDate: null,
    toDate: null,
    fromAnyDate: null,
    toAnyDate: null,
    ownerIds: [null],
    businessIds: null,
    IDs: [null],
    tags: null,
    businessTripIds: null,
    accountIds: null,
    excludedBusinessIds: null,
    excludedTags: null,
    excludedAccountIds: null,
    withMissingCounterparty: false,
    chargeType: 'ALL',
    withoutInvoice: false,
    withoutReceipt: false,
    withoutDocuments: false,
    withOpenDocuments: false,
    withoutTransactions: false,
    withoutLedger: false,
    withoutTags: false,
    accountantStatuses: null,
    type: null,
    freeText: null,
    freeTextNumeric: null,
    excludedFreeText: null,
    excludedFreeTextNumeric: null,
    limit: null,
    offset: null,
    ...over,
  };
}

/** Free text as the provider passes it: lower-cased, and a comma-free numeric copy when it has a digit. */
const text = (raw: string) => {
  const freeText = raw.trim().toLowerCase();
  return { freeText, freeTextNumeric: /\d/.test(freeText) ? freeText.replaceAll(',', '') : null };
};
const excludedText = (raw: string) => {
  const t = text(raw);
  return { excludedFreeText: t.freeText, excludedFreeTextNumeric: t.freeTextNumeric };
};

export const cases: Cases = {
  getChargesByIds: caseFor<IGetChargesByIdsQuery>(s => [
    { chargeIds: [FX.officeSupplies, FX.retainer, s.missingId] },
    { chargeIds: s.ids('charges', 5) },
    { chargeIds: [s.missingId] },
  ]),

  getChargesByTransactionIds: caseFor<IGetChargesByTransactionIdsQuery>(s => [
    { transactionIds: [FX.tx(1), FX.tx(3), FX.demoTransaction] },
    { transactionIds: s.ids('transactions', 4) },
    { transactionIds: [s.missingId] },
  ]),

  updateCharge: caseFor<IUpdateChargeQuery>(s => [
    {
      chargeId: FX.officeSupplies,
      userDescription: 'Globex office supplies (edited)',
      type: 'COMMON',
      isInvoicePaymentDifferentCurrency: true,
      accountantStatus: 'APPROVED',
      taxCategoryId: FX.consulting,
      optionalVAT: true,
      optionalDocuments: true,
      isProperty: true,
    },
    { chargeId: FX.retainer, userDescription: 'Only the description' },
    { chargeId: FX.hardware },
    { chargeId: FX.retainer, taxCategoryId: s.missingId },
    { chargeId: s.missingId, userDescription: 'nothing' },
    { chargeId: null, userDescription: 'nothing' },
  ]),

  batchUpdateCharges: caseFor<IBatchUpdateChargesQuery>(s => [
    {
      chargeIds: [FX.officeSupplies, FX.retainer, s.missingId],
      type: 'COMMON',
      optionalVAT: false,
    },
    { chargeIds: [FX.hardware], accountantStatus: 'PENDING', userDescription: 'batch' },
    { chargeIds: [s.missingId], isProperty: true },
  ]),

  updateAccountantApproval: caseFor<IUpdateAccountantApprovalQuery>(s => [
    { chargeId: FX.officeSupplies, accountantStatus: 'APPROVED' },
    { chargeId: FX.retainer, accountantStatus: 'UNAPPROVED' },
    { chargeId: s.missingId, accountantStatus: 'APPROVED' },
    { chargeId: FX.officeSupplies, accountantStatus: null },
  ]),

  generateCharge: caseFor<IGenerateChargeQuery>(s => [
    {
      ownerId: s.businessId,
      type: 'FINANCIAL',
      accountantStatus: 'UNAPPROVED',
      userDescription: 'Generated',
      taxCategoryId: FX.revaluation,
      optionalVAT: false,
      optionalDocuments: true,
      isProperty: false,
    },
    {
      ownerId: s.businessId,
      type: null,
      accountantStatus: 'PENDING',
      userDescription: null,
      taxCategoryId: null,
      optionalVAT: true,
      optionalDocuments: false,
      isProperty: true,
    },
    // NOT NULL accountant_status
    {
      ownerId: s.businessId,
      accountantStatus: null,
      optionalVAT: false,
      optionalDocuments: false,
      isProperty: false,
    },
    // another tenant: row-level security
    {
      ownerId: s.missingId,
      accountantStatus: 'UNAPPROVED',
      optionalVAT: false,
      optionalDocuments: false,
      isProperty: false,
    },
  ]),

  deleteChargesByIds: caseFor<IDeleteChargesByIdsQuery>(s => [
    { chargeIds: [FX.emptyCharge, FX.deleteMeToo] },
    // still referenced by transactions / documents
    { chargeIds: [FX.demoJanuary] },
    { chargeIds: [s.missingId] },
  ]),

  getChargesByFilters: caseFor<IGetChargesByFiltersQuery>(s => [
    // sorting
    filters(s),
    filters(s, { asc: true }),
    filters(s, { sortColumn: 'event_amount' }),
    filters(s, { sortColumn: 'event_amount', asc: true }),
    filters(s, { sortColumn: 'abs_event_amount', asc: true }),
    filters(s, { sortColumn: 'abs_event_amount' }),
    filters(s, { sortColumn: 'no_such_column' }),
    filters(s, { asc: null }),
    // paging
    filters(s, { asc: true, limit: 5, offset: 2 }),
    filters(s, { limit: 3 }),
    filters(s, { offset: 30 }),
    filters(s, { sortColumn: 'event_amount', limit: '4', offset: '1' }),
    // free text, one per branch of search_matches
    filters(s, text('Globex')),
    filters(s, text('toner')),
    filters(s, text('URGENT')),
    filters(s, text('rc-77')),
    filters(s, text('gx-1001')),
    filters(s, text('retainer')),
    filters(s, text('initech')),
    filters(s, text('150.25')),
    filters(s, text('80.5')),
    filters(s, text('1,170')),
    filters(s, text('-500')),
    filters(s, text('no such words')),
    filters(s, { freeText: '', freeTextNumeric: null }),
    filters(s, { freeText: 'c_n%ulting', freeTextNumeric: null }),
    // exclusions
    filters(s, excludedText('consulting')),
    filters(s, excludedText('500')),
    filters(s, excludedText('initech')),
    filters(s, { ...text('globex'), ...excludedText('toner') }),
    filters(s, { excludedBusinessIds: [FX.globex], isExcludedBusinessIds: 1 }),
    filters(s, { excludedTags: [FX.tagGpu, FX.tagCloud], isExcludedTags: 1 }),
    filters(s, { excludedAccountIds: [FX.bank1], isExcludedAccountIds: 1 }),
    // id / owner filters
    filters(s, { isIDs: 1, IDs: [FX.officeSupplies, FX.retainer, FX.hardware, s.missingId] }),
    filters(s, { isOwnerIds: 1, ownerIds: [s.businessId] }),
    filters(s, { isOwnerIds: 1, ownerIds: [s.missingId] }),
    // array filters
    filters(s, { isBusinessIds: 1, businessIds: [FX.globex] }),
    filters(s, { isBusinessIds: 1, businessIds: [FX.initech, FX.acmeRetail] }),
    filters(s, { isTags: 1, tags: [FX.tagOperations] }),
    filters(s, { isTags: 1, tags: [FX.tagEvents, FX.tagGpu] }),
    filters(s, { isBusinessTripIds: 1, businessTripIds: [FX.trip] }),
    filters(s, { isAccountIds: 1, accountIds: [FX.cc1] }),
    filters(s, { isAccountantStatuses: 1, accountantStatuses: ['APPROVED', 'PENDING'] }),
    // dates
    filters(s, { fromDate: '2024-05-01' }),
    filters(s, { toDate: '2024-04-30' }),
    filters(s, { fromDate: '2024-03-01', toDate: '2024-06-30', asc: true }),
    filters(s, { fromAnyDate: '2024-12-01' }),
    filters(s, { toAnyDate: '2024-02-01' }),
    filters(s, { fromAnyDate: '2024-06-01', toAnyDate: '2024-08-31' }),
    // charge type and kind
    filters(s, { chargeType: 'INCOME' }),
    filters(s, { chargeType: 'EXPENSE' }),
    filters(s, { chargeType: null }),
    filters(s, { type: 'BANK_DEPOSIT' }),
    // boolean filters
    filters(s, { withoutInvoice: true }),
    filters(s, { withoutReceipt: true }),
    filters(s, { withoutDocuments: true }),
    filters(s, { withoutTransactions: true }),
    filters(s, { withOpenDocuments: true }),
    filters(s, { withoutLedger: true }),
    filters(s, { withoutTags: true }),
    filters(s, { withMissingCounterparty: true }),
    // combined
    filters(s, {
      ...text('globex'),
      isExcludedBusinessIds: 1,
      excludedBusinessIds: [FX.initech],
      sortColumn: 'event_amount',
      asc: true,
      limit: 1,
      offset: 0,
    }),
    filters(s, {
      isAccountantStatuses: 1,
      accountantStatuses: ['UNAPPROVED'],
      withoutLedger: true,
      sortColumn: 'abs_event_amount',
      asc: false,
      limit: 4,
    }),
  ]),

  getSimilarCharges: caseFor<IGetSimilarChargesQuery>(s => [
    { ownerId: s.businessId, businessId: FX.acmeConsulting },
    { ownerId: s.businessId, businessArray: [FX.acmeConsulting] },
    { ownerId: s.businessId, businessId: FX.globex },
    { ownerId: s.businessId, businessArray: [FX.globex, FX.initech] },
    { ownerId: s.businessId, businessId: FX.acmeConsulting, withMissingTags: true },
    { ownerId: s.businessId, businessId: FX.globex, withMissingDescription: true },
    { ownerId: s.businessId, businessId: FX.acmeConsulting, withMissingDescription: false },
    { ownerId: s.businessId, businessId: FX.acmeConsulting, tagsDifferentThan: [FX.tagCloud] },
    {
      ownerId: s.businessId,
      businessId: FX.globex,
      tagsDifferentThan: [FX.tagOperations, FX.tagMarketing],
    },
    {
      ownerId: s.businessId,
      businessId: FX.acmeConsulting,
      descriptionDifferentThan: 'January consulting services',
    },
    { ownerId: s.missingId, businessId: FX.acmeConsulting },
    { ownerId: s.businessId, businessId: null, businessArray: null },
  ]),
};
