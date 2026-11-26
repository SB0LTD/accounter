import type { Row } from '../../../../catalog.js';
import type {
  IDeleteFinancialAccountTaxCategoriesQuery,
  IGetFinancialAccountTaxCategoriesByAccountIdsQuery,
  IInsertFinancialAccountTaxCategoriesQuery,
  IUpdateFinancialAccountTaxCategoryQuery,
} from '../../../../../modules/financial-accounts/__generated__/financial-accounts-tax-categories.types.js';
import { coalescePatch, inList } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';
import { deletable, typed } from '../../salaries/_helpers.js';

type TaxCategoryRow = Row<'financial_accounts_tax_categories'>;

/** SELECT * FROM financial_accounts_tax_categories WHERE financial_account_id IN $$accountIds */
export const getFinancialAccountTaxCategoriesByAccountIds =
  port<IGetFinancialAccountTaxCategoriesByAccountIdsQuery>(async ({ accountIds }, db) =>
    db.whereIn('financial_accounts_tax_categories', 'financial_account_id', accountIds),
  );

/**
 * UPDATE financial_accounts_tax_categories
 * SET tax_category_id = COALESCE($taxCategoryId, tax_category_id)
 * WHERE financial_account_id = $financialAccountId AND currency = $currency
 * RETURNING *
 */
export const updateFinancialAccountTaxCategory = port<IUpdateFinancialAccountTaxCategoryQuery>(
  async ({ financialAccountId, currency, taxCategoryId }, db) => {
    if (financialAccountId == null || currency == null) return [];
    const patch = typed(
      'financial_accounts_tax_categories',
      coalescePatch({ tax_category_id: taxCategoryId }),
    );
    const updated: TaxCategoryRow[] = [];
    for (const row of await db.where('financial_accounts_tax_categories', {
      financial_account_id: financialAccountId,
      currency,
    })) {
      updated.push(await db.update('financial_accounts_tax_categories', row, patch));
    }
    return updated;
  },
);

/**
 * INSERT INTO financial_accounts_tax_categories (financial_account_id, currency, tax_category_id, owner_id)
 * VALUES $$financialAccountsTaxCategories(financialAccountId, currency, taxCategoryId, ownerId)
 * RETURNING *
 */
export const insertFinancialAccountTaxCategories =
  port<IInsertFinancialAccountTaxCategoriesQuery>(async ({ financialAccountsTaxCategories }, db) => {
    const inserted: TaxCategoryRow[] = [];
    for (const tc of financialAccountsTaxCategories) {
      const row = await db.insert(
        'financial_accounts_tax_categories',
        typed('financial_accounts_tax_categories', {
          financial_account_id: tc.financialAccountId ?? null,
          currency: tc.currency ?? null,
          tax_category_id: tc.taxCategoryId ?? null,
          owner_id: tc.ownerId ?? null,
        }),
      );
      if (row) inserted.push(row);
    }
    return inserted;
  });

/**
 * DELETE FROM financial_accounts_tax_categories
 * WHERE financial_account_id = $financialAccountId AND currency IN $$currencies
 * RETURNING *
 */
export const deleteFinancialAccountTaxCategories =
  port<IDeleteFinancialAccountTaxCategoriesQuery>(async ({ financialAccountId, currencies }, db) => {
    if (financialAccountId == null) return [];
    const inCurrencies = inList(currencies);
    const rows = (
      await db.where('financial_accounts_tax_categories', {
        financial_account_id: financialAccountId,
      })
    ).filter(row => inCurrencies(row.currency));
    const deleted: TaxCategoryRow[] = [];
    for (const row of deletable(rows, db.ctx.businessId)) {
      deleted.push(await db.delete('financial_accounts_tax_categories', row));
    }
    return deleted;
  });
