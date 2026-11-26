import type {
  IDeleteFinancialAccountTaxCategoriesQuery,
  IGetFinancialAccountTaxCategoriesByAccountIdsQuery,
  IInsertFinancialAccountTaxCategoriesQuery,
  IUpdateFinancialAccountTaxCategoryQuery,
} from '../../../../../modules/financial-accounts/__generated__/financial-accounts-tax-categories.types.js';
import { caseFor, type Cases } from '../../../cases.js';

// Fixture rows (scripts/firestore/fixtures/090-accounts-salaries.sql)
const FA = (n: number) => `0f090000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const CARD = FA(1); // USD, EUR, ILS
const BANK = FA(2); // ILS
const NO_OWNER = FA(3); // none
const WALLET = FA(4); // none

export const cases: Cases = {
  getFinancialAccountTaxCategoriesByAccountIds:
    caseFor<IGetFinancialAccountTaxCategoriesByAccountIdsQuery>(s => [
      { accountIds: [CARD, BANK] },
      { accountIds: s.ids('financial_accounts', 20) },
      { accountIds: [WALLET, s.missingId] },
    ]),
  updateFinancialAccountTaxCategory: caseFor<IUpdateFinancialAccountTaxCategoryQuery>(s => [
    { financialAccountId: CARD, currency: 'USD', taxCategoryId: s.ids('tax_categories', 1)[0] },
    { financialAccountId: CARD, currency: 'EUR', taxCategoryId: null },
    { financialAccountId: CARD, currency: 'GBP', taxCategoryId: s.ids('tax_categories', 1)[0] },
    { financialAccountId: BANK, currency: 'ILS', taxCategoryId: s.missingId }, // FK: 23503
    { financialAccountId: null, currency: 'USD', taxCategoryId: s.ids('tax_categories', 1)[0] },
    { financialAccountId: CARD, currency: null, taxCategoryId: s.ids('tax_categories', 1)[0] },
  ]),
  insertFinancialAccountTaxCategories: caseFor<IInsertFinancialAccountTaxCategoriesQuery>(s => [
    {
      financialAccountsTaxCategories: [
        {
          financialAccountId: CARD,
          currency: 'GBP',
          taxCategoryId: s.ids('tax_categories', 1)[0],
          ownerId: s.businessId,
        },
        {
          financialAccountId: NO_OWNER,
          currency: 'USD',
          taxCategoryId: s.ids('tax_categories', 2)[1],
          ownerId: s.businessId,
        },
      ],
    },
    // primary key (financial_account_id, currency) taken: 23505
    {
      financialAccountsTaxCategories: [
        {
          financialAccountId: CARD,
          currency: 'USD',
          taxCategoryId: s.ids('tax_categories', 1)[0],
          ownerId: s.businessId,
        },
      ],
    },
    // no such financial account: 23503
    {
      financialAccountsTaxCategories: [
        {
          financialAccountId: s.missingId,
          currency: 'USD',
          taxCategoryId: s.ids('tax_categories', 1)[0],
          ownerId: s.businessId,
        },
      ],
    },
    // no such tax category: 23503
    {
      financialAccountsTaxCategories: [
        {
          financialAccountId: WALLET,
          currency: 'ILS',
          taxCategoryId: s.missingId,
          ownerId: s.businessId,
        },
      ],
    },
    // currency is NOT NULL
    {
      financialAccountsTaxCategories: [
        {
          financialAccountId: WALLET,
          currency: null,
          taxCategoryId: s.ids('tax_categories', 1)[0],
          ownerId: s.businessId,
        },
      ],
    },
  ]),
  deleteFinancialAccountTaxCategories: caseFor<IDeleteFinancialAccountTaxCategoriesQuery>(s => [
    { financialAccountId: CARD, currencies: ['USD', 'EUR'] },
    { financialAccountId: CARD, currencies: ['GBP', null] },
    { financialAccountId: BANK, currencies: ['ILS', 'USD'] },
    { financialAccountId: s.missingId, currencies: ['ILS'] },
    { financialAccountId: null, currencies: ['ILS'] },
  ]),
};
