import { FX } from '../_fixture-ids.js';
import type {
  IDeleteBusinessTaxCategoryQuery,
  IDeleteTaxCategoryQuery,
  IGetBusinessMatchesByTaxCategoryIdsQuery,
  IGetTaxCategoryByBusinessIDsQuery,
  IGetTaxCategoryByFinancialAccountIdsAndCurrenciesQuery,
  IGetTaxCategoryByFinancialAccountIdsQuery,
  IGetTaxCategoryByFinancialAccountOwnerIdsQuery,
  IGetTaxCategoryByIDsQuery,
  IGetTaxCategoryBySortCodesQuery,
  IInsertBusinessTaxCategoryQuery,
  IInsertTaxCategoryQuery,
  IReplaceTaxCategoriesQuery,
  IUpdateBusinessTaxCategoryQuery,
  IUpdateTaxCategoryQuery,
} from '../../../../../modules/financial-entities/__generated__/tax-categories.types.js';
import { caseFor, type Cases } from '../../../cases.js';

export const cases: Cases = {
  getTaxCategoryByBusinessIDs: caseFor<IGetTaxCategoryByBusinessIDsQuery>(s => [
    { BusinessIds: [FX.alpha, FX.beta, FX.delta, FX.eta, FX.gamma, s.missingId] },
    { BusinessIds: [null] }, // the provider's placeholder for no ids
  ]),
  getTaxCategoryBySortCodes: caseFor<IGetTaxCategoryBySortCodesQuery>(() => [
    { sortCodes: [100, 200, 300] }, // 100 and 200 also hold businesses, which are not tax categories
    { sortCodes: [999] },
  ]),
  getTaxCategoryByFinancialAccountIdsAndCurrencies:
    caseFor<IGetTaxCategoryByFinancialAccountIdsAndCurrenciesQuery>(s => [
      {
        FinancialAccountIds: [
          FX.account,
          ...(s.values('financial_accounts_tax_categories', 'financial_account_id', 5) as string[]),
        ],
        Currencies: ['USD', 'ILS'],
      },
      { FinancialAccountIds: [FX.account], Currencies: ['EUR'] },
      { FinancialAccountIds: [null], Currencies: [null] },
      { FinancialAccountIds: [FX.account], Currencies: ['XYZ' as never] }, // not a currency: 22P02
    ]),
  getTaxCategoryByFinancialAccountOwnerIds: caseFor<IGetTaxCategoryByFinancialAccountOwnerIdsQuery>(
    s => [
      { ownerIds: [s.businessId, FX.alpha] },
      { ownerIds: [FX.alpha] },
      { ownerIds: [s.missingId] },
    ],
  ),
  getTaxCategoryByFinancialAccountIds: caseFor<IGetTaxCategoryByFinancialAccountIdsQuery>(s => [
    {
      financialAccountIds: [
        FX.account,
        ...(s.values('financial_accounts_tax_categories', 'financial_account_id', 5) as string[]),
      ],
    },
    { financialAccountIds: [s.missingId] },
  ]),
  getTaxCategoryByIDs: caseFor<IGetTaxCategoryByIDsQuery>(s => [
    { Ids: [FX.tcAlpha, FX.tcBeta, FX.alpha, s.missingId, ...s.ids('tax_categories', 3)] },
    { Ids: [FX.tcGamma.toUpperCase()] },
    { Ids: [s.missingId] },
  ]),
  getBusinessMatchesByTaxCategoryIds: caseFor<IGetBusinessMatchesByTaxCategoryIdsQuery>(() => [
    { taxCategoryIds: [FX.tcAlpha, FX.tcBeta] },
    { taxCategoryIds: [FX.tcBeta] },
    { taxCategoryIds: [FX.tcGamma] },
  ]),
  updateTaxCategory: caseFor<IUpdateTaxCategoryQuery>(s => [
    { taxCategoryId: FX.tcAlpha, hashavshevetName: 'ALPHA-NEW', taxExcluded: true },
    { taxCategoryId: FX.tcBeta, hashavshevetName: null, taxExcluded: null },
    { taxCategoryId: FX.tcGamma, hashavshevetName: null, taxExcluded: true },
    { taxCategoryId: s.missingId, hashavshevetName: 'X', taxExcluded: null },
  ]),
  updateBusinessTaxCategory: caseFor<IUpdateBusinessTaxCategoryQuery>(s => [
    { businessId: FX.alpha, ownerId: s.businessId, taxCategoryId: FX.tcBeta },
    { businessId: FX.alpha, ownerId: s.businessId, taxCategoryId: null },
    { businessId: FX.alpha, ownerId: s.businessId, taxCategoryId: s.missingId }, // 23503
    { businessId: FX.gamma, ownerId: s.businessId, taxCategoryId: FX.tcAlpha }, // no match
    { businessId: FX.alpha, ownerId: s.missingId, taxCategoryId: FX.tcAlpha },
  ]),
  insertTaxCategory: caseFor<IInsertTaxCategoryQuery>(s => [
    { id: FX.theta, hashavshevetName: 'THETA', taxExcluded: false, ownerId: s.businessId },
    { id: FX.tcAlpha, hashavshevetName: null, taxExcluded: false, ownerId: s.businessId }, // 23505
    { id: FX.theta, hashavshevetName: null, taxExcluded: null, ownerId: s.businessId }, // 23502
    { id: FX.unused, hashavshevetName: null, taxExcluded: false, ownerId: s.businessId }, // 23503
    { id: FX.theta, hashavshevetName: null, taxExcluded: false, ownerId: s.missingId }, // 42501
  ]),
  insertBusinessTaxCategory: caseFor<IInsertBusinessTaxCategoryQuery>(s => [
    { businessId: FX.gamma, ownerId: s.businessId, taxCategoryId: FX.tcGamma },
    { businessId: FX.alpha, ownerId: s.businessId, taxCategoryId: FX.tcBeta }, // 23505
    { businessId: FX.gamma, ownerId: s.businessId, taxCategoryId: s.missingId }, // 23503
    { businessId: FX.theta, ownerId: s.businessId, taxCategoryId: FX.tcAlpha }, // no businesses row
    { businessId: FX.gamma, ownerId: s.missingId, taxCategoryId: FX.tcAlpha }, // 42501
  ]),
  deleteBusinessTaxCategory: caseFor<IDeleteBusinessTaxCategoryQuery>(s => [
    { businessId: FX.alpha, ownerId: s.businessId },
    { businessId: FX.gamma, ownerId: s.businessId },
    { businessId: FX.alpha, ownerId: s.missingId },
  ]),
  deleteTaxCategory: caseFor<IDeleteTaxCategoryQuery>(s => [
    { taxCategoryId: FX.tcGamma }, // unreferenced
    { taxCategoryId: FX.tcAlpha }, // matched to businesses: 23503
    { taxCategoryId: s.missingId },
  ]),
  replaceTaxCategories: caseFor<IReplaceTaxCategoriesQuery>(s => [
    { targetTaxCategoryId: FX.tcDelta, taxCategoryIdToReplace: FX.tcAlpha },
    { targetTaxCategoryId: FX.tcBeta, taxCategoryIdToReplace: FX.tcAlpha },
    {
      targetTaxCategoryId: FX.tcDelta,
      taxCategoryIdToReplace: s.values('charges', 'tax_category_id', 1)[0] as string | undefined,
    },
    { targetTaxCategoryId: s.missingId, taxCategoryIdToReplace: FX.tcAlpha }, // 23503
    { targetTaxCategoryId: FX.tcDelta, taxCategoryIdToReplace: s.missingId },
  ]),
};
