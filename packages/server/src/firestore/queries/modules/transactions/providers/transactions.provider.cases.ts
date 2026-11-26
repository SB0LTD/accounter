import type {
  IGetSimilarTransactionsQuery,
  IGetTransactionsByChargeIdsQuery,
  IGetTransactionsByExtendedFiltersParams,
  IGetTransactionsByExtendedFiltersQuery,
  IGetTransactionsByFiltersParams,
  IGetTransactionsByFiltersQuery,
  IGetTransactionsByIdsQuery,
  IReplaceTransactionsChargeIdQuery,
  IUpdateTransactionsQuery,
} from '../../../../../modules/transactions/__generated__/transactions.types.js';
import { caseFor, type Cases } from '../../../cases.js';
import { FX } from '../../charges/_fixture-ids.js';

/** What TransactionsProvider.getTransactionsByFilters passes when nothing is filtered. */
const filters = (
  over: Partial<IGetTransactionsByFiltersParams> = {},
): IGetTransactionsByFiltersParams => ({
  isIDs: 0,
  isBusinessIDs: 0,
  isOwnerIDs: 0,
  fromEventDate: null,
  toEventDate: null,
  fromDebitDate: null,
  toDebitDate: null,
  IDs: [null],
  businessIDs: [null],
  ownerIDs: [null],
  ...over,
});

/** What TransactionsProvider.getTransactionsByExtendedFilters passes when nothing is filtered. */
const extended = (
  over: Partial<IGetTransactionsByExtendedFiltersParams> = {},
): IGetTransactionsByExtendedFiltersParams => {
  const freeText = over.freeText ?? null;
  return {
    fromEventDate: null,
    toEventDate: null,
    fromDebitDate: null,
    toDebitDate: null,
    fromAnyDate: null,
    toAnyDate: null,
    isIDs: 0,
    isChargeIDs: 0,
    isOwnerIDs: 0,
    isCounterpartyIDs: 0,
    IDs: [null],
    chargeIDs: [null],
    ownerIDs: [null],
    counterpartyIDs: [null],
    withMissingCounterparty: false,
    withMissingInfo: false,
    freeText,
    freeTextNumeric: freeText ? freeText.replaceAll(',', '') : null,
    ...over,
  };
};

export const cases: Cases = {
  getTransactionsByIds: caseFor<IGetTransactionsByIdsQuery>(s => [
    { transactionIds: [FX.tx(1), FX.tx(3), FX.demoTransaction, s.missingId] },
    { transactionIds: [s.missingId] },
  ]),

  getTransactionsByChargeIds: caseFor<IGetTransactionsByChargeIdsQuery>(s => [
    { chargeIds: [FX.officeSupplies, FX.cardPurchases, FX.demoJanuary] },
    { chargeIds: [s.missingId] },
  ]),

  // Postgres leaves the order of same-day transactions open: whole-table cases can come back SOFT.
  getTransactionsByFilters: caseFor<IGetTransactionsByFiltersQuery>(s => [
    filters(),
    filters({ isIDs: 1, IDs: [FX.tx(1), FX.tx(4), FX.tx(7), FX.tx(21)] }),
    filters({ fromEventDate: '2024-07-21', toEventDate: '2024-09-30' }),
    filters({ fromDebitDate: '2024-04-01', toDebitDate: '2024-05-31' }),
    filters({ toDebitDate: '2024-03-06' }),
    filters({ isBusinessIDs: 1, businessIDs: [FX.globex, FX.initech] }),
    filters({ isOwnerIDs: 1, ownerIDs: [s.missingId] }),
    filters({ isOwnerIDs: 1, ownerIDs: [s.businessId], fromEventDate: '2024-12-01' }),
  ]),

  getTransactionsByExtendedFilters: caseFor<IGetTransactionsByExtendedFiltersQuery>(s => [
    extended(),
    extended({ isIDs: 1, IDs: [FX.tx(1), FX.tx(3), FX.tx(9)] }),
    extended({ isChargeIDs: 1, chargeIDs: [FX.cardPurchases, FX.hardware] }),
    extended({ isOwnerIDs: 1, ownerIDs: [s.businessId], toEventDate: '2024-03-31' }),
    extended({ isCounterpartyIDs: 1, counterpartyIDs: [FX.initech] }),
    extended({ fromEventDate: '2024-05-01', toEventDate: '2024-05-31' }),
    extended({ fromDebitDate: '2024-08-10', toDebitDate: '2024-08-10' }),
    // any date: event date or debit date inside the window
    extended({ fromAnyDate: '2024-04-11', toAnyDate: '2024-04-12' }),
    extended({ fromAnyDate: '2024-12-20' }),
    extended({ toAnyDate: '2024-01-14' }),
    extended({ withMissingCounterparty: true }),
    extended({ withMissingInfo: true }),
    // free text over each column, and amounts
    extended({ freeText: 'globex' }),
    extended({ freeText: 'gx-1001' }),
    extended({ freeText: '12-600' }),
    extended({ freeText: 'FX070-2' }),
    extended({ freeText: 'initech services' }),
    extended({ freeText: '50.25' }),
    extended({ freeText: '1,500' }),
    extended({ freeText: '-75' }),
    extended({ freeText: 'nothing like this' }),
    extended({ freeText: 'globex', freeTextNumeric: null }),
  ]),

  getSimilarTransactions: caseFor<IGetSimilarTransactionsQuery>(s => [
    {
      ownerId: s.businessId,
      details: 'GLOBEX SUPPLIES LTD',
      counterAccount: null,
      withMissingInfo: false,
    },
    {
      ownerId: s.businessId,
      details: null,
      counterAccount: '12-600-123456',
      withMissingInfo: null,
    },
    { ownerId: s.businessId, details: 'Cafe', counterAccount: null, withMissingInfo: true },
    {
      ownerId: s.businessId,
      details: 'GLOBEX SUPPLIES LTD',
      counterAccount: null,
      withMissingInfo: true,
    },
    { ownerId: s.businessId, details: '', counterAccount: '', withMissingInfo: false },
    { ownerId: s.missingId, details: 'Cafe', counterAccount: null, withMissingInfo: false },
  ]),

  replaceTransactionsChargeId: caseFor<IReplaceTransactionsChargeIdQuery>(s => [
    { replaceChargeID: FX.cardPurchases, assertChargeID: FX.emptyCharge },
    { replaceChargeID: FX.officeSupplies, assertChargeID: s.missingId },
    { replaceChargeID: FX.officeSupplies, assertChargeID: null },
    { replaceChargeID: s.missingId, assertChargeID: FX.emptyCharge },
  ]),

  updateTransactions: caseFor<IUpdateTransactionsQuery>(s => [
    {
      transactionIds: [FX.tx(4), FX.tx(9)],
      accountId: FX.bank1,
      chargeId: FX.emptyCharge,
      debitDate: '2024-09-01',
      businessId: FX.globex,
      isFee: true,
    },
    { transactionIds: [FX.tx(3)], isFee: false },
    { transactionIds: [FX.tx(1), s.missingId] },
    { transactionIds: [FX.tx(1)], businessId: s.missingId },
    { transactionIds: [s.missingId], chargeId: FX.emptyCharge },
  ]),
};
