import {
  checkEnum,
  deletable,
  insertRow,
  nullRow,
  pgParams,
  runWritableCtes,
  uuidList,
  uuidParam,
} from '../_helpers.js';
import type {
  IDeleteBusinessTaxCategoryQuery,
  IDeleteTaxCategoryQuery,
  IGetAllTaxCategoriesQuery,
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
import type { Row } from '../../../../catalog.js';
import type { QueryDb } from '../../../../query-db.js';
import { coalescePatch, inList, orderBy } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';

type Fe = Row<'financial_entities'>;
type Tc = Row<'tax_categories'>;

async function byId<T extends 'financial_entities' | 'tax_categories' | 'financial_accounts'>(
  db: QueryDb,
  table: T,
  ids: readonly unknown[],
): Promise<Map<string, Row<T>>> {
  const rows = (await db.whereIn(table, 'id' as never, ids)) as readonly Row<T>[];
  return new Map(rows.map(row => [(row as { id: string }).id, row]));
}

/** `fe.id, fe.name, fe.sort_code, fe.type, fe.created_at, fe.updated_at, fe.irs_code, fe.is_active, tc.hashavshevet_name, tc.tax_excluded` */
function feTcColumns(fe: Fe | undefined, tc: Tc | undefined) {
  return {
    id: fe?.id ?? null,
    name: fe?.name ?? null,
    sort_code: fe?.sort_code ?? null,
    type: fe?.type ?? null,
    created_at: fe?.created_at ?? null,
    updated_at: fe?.updated_at ?? null,
    irs_code: fe?.irs_code ?? null,
    is_active: fe?.is_active ?? null,
    hashavshevet_name: tc?.hashavshevet_name ?? null,
    tax_excluded: tc?.tax_excluded ?? null,
  };
}

/**
 * SELECT fe.id, fe.name, fe.sort_code, fe.type, fe.created_at, fe.updated_at, fe.irs_code, fe.is_active,
 *   tc.hashavshevet_name, tc.tax_excluded, tcm.business_id, tcm.owner_id
 * FROM tax_categories tc
 * LEFT JOIN financial_entities fe ON fe.id = tc.id
 * LEFT JOIN business_tax_category_match tcm ON tcm.tax_category_id = tc.id
 * WHERE tcm.business_id IN $$BusinessIds
 */
export const getTaxCategoryByBusinessIDs = port<IGetTaxCategoryByBusinessIDsQuery>(
  async ({ BusinessIds }, db) => {
    const matches = await db.whereIn(
      'business_tax_category_match',
      'business_id',
      uuidList(BusinessIds),
    );
    const categories = await byId(
      db,
      'tax_categories',
      matches.map(m => m.tax_category_id),
    );
    const entities = await byId(db, 'financial_entities', [...categories.keys()]);
    const result = [];
    for (const tcm of matches) {
      const tc = categories.get(tcm.tax_category_id);
      if (!tc) continue;
      result.push({
        ...feTcColumns(entities.get(tc.id), tc),
        business_id: tcm.business_id,
        owner_id: tcm.owner_id,
      });
    }
    return result as never;
  },
);

/**
 * SELECT fe.id, fe.name, fe.sort_code, fe.type, fe.created_at, fe.updated_at, fe.irs_code, fe.is_active,
 *   tc.hashavshevet_name, tc.tax_excluded, fe.owner_id
 * FROM tax_categories tc LEFT JOIN financial_entities fe ON fe.id = tc.id
 * WHERE fe.sort_code IN $$sortCodes
 */
export const getTaxCategoryBySortCodes = port<IGetTaxCategoryBySortCodesQuery>(
  async ({ sortCodes }, db) => {
    const wanted = inList(sortCodes);
    const categories = await db.rows('tax_categories');
    const entities = await byId(
      db,
      'financial_entities',
      categories.map(tc => tc.id),
    );
    const result = [];
    for (const tc of categories) {
      const fe = entities.get(tc.id);
      if (!fe || !wanted(fe.sort_code)) continue;
      result.push({ ...feTcColumns(fe, tc), owner_id: fe.owner_id });
    }
    return result as never;
  },
);

/**
 * `fatc LEFT JOIN tax_categories tc ON fatc.tax_category_id = tc.id
 *  LEFT JOIN financial_entities fe ON fatc.tax_category_id = fe.id`, selecting
 * `fe.id, fe.name, fe.sort_code, fe.type, fe.created_at, fe.updated_at, fe.owner_id, fe.irs_code,
 *  fe.is_active, tc.hashavshevet_name, tc.tax_excluded, fatc.financial_account_id, fatc.currency`
 */
async function accountCategories(
  db: QueryDb,
  rows: readonly Row<'financial_accounts_tax_categories'>[],
) {
  const ids = rows.map(fatc => fatc.tax_category_id);
  const categories = await byId(db, 'tax_categories', ids);
  const entities = await byId(db, 'financial_entities', ids);
  return rows.map(fatc => {
    const fe = entities.get(fatc.tax_category_id);
    return {
      ...feTcColumns(fe, categories.get(fatc.tax_category_id)),
      owner_id: fe?.owner_id ?? null,
      financial_account_id: fatc.financial_account_id,
      currency: fatc.currency,
    };
  });
}

/**
 * SELECT fe.id, ..., fe.owner_id, ..., tc.hashavshevet_name, tc.tax_excluded,
 *   fatc.financial_account_id, fatc.currency
 * FROM financial_accounts_tax_categories fatc
 * LEFT JOIN tax_categories tc ON fatc.tax_category_id = tc.id
 * LEFT JOIN financial_entities fe ON fatc.tax_category_id = fe.id
 * WHERE fatc.currency IN $$Currencies AND fatc.financial_account_id IN $$FinancialAccountIds
 */
export const getTaxCategoryByFinancialAccountIdsAndCurrencies =
  port<IGetTaxCategoryByFinancialAccountIdsAndCurrenciesQuery>(
    async ({ Currencies, FinancialAccountIds }, db) => {
      for (const currency of Currencies) checkEnum('currency', currency);
      const currencies = inList(Currencies);
      const rows = (
        await db.whereIn(
          'financial_accounts_tax_categories',
          'financial_account_id',
          uuidList(FinancialAccountIds),
        )
      ).filter(fatc => currencies(fatc.currency));
      return (await accountCategories(db, rows)) as never;
    },
  );

/**
 * SELECT fe.id, ..., fe.owner_id, ..., tc.hashavshevet_name, tc.tax_excluded,
 *   fatc.financial_account_id, fatc.currency, fa.owner as "financial_account_owner_id"
 * FROM financial_accounts_tax_categories fatc
 * LEFT JOIN tax_categories tc ON fatc.tax_category_id = tc.id
 * LEFT JOIN financial_entities fe ON fatc.tax_category_id = fe.id
 * LEFT JOIN financial_accounts fa ON fa.id = fatc.financial_account_id
 * WHERE fa.owner IN $$ownerIds
 */
export const getTaxCategoryByFinancialAccountOwnerIds =
  port<IGetTaxCategoryByFinancialAccountOwnerIdsQuery>(async ({ ownerIds }, db) => {
    const accounts = await db.whereIn('financial_accounts', 'owner', uuidList(ownerIds));
    const ownerOf = new Map(accounts.map(fa => [fa.id, fa.owner]));
    const rows = await db.whereIn(
      'financial_accounts_tax_categories',
      'financial_account_id',
      accounts.map(fa => fa.id),
    );
    return (await accountCategories(db, rows)).map(row => ({
      ...row,
      financial_account_owner_id: ownerOf.get(row.financial_account_id) ?? null,
    })) as never;
  });

/**
 * SELECT fe.id, ..., fe.owner_id, ..., tc.hashavshevet_name, tc.tax_excluded,
 *   fatc.financial_account_id, fatc.currency
 * FROM financial_accounts_tax_categories fatc
 * LEFT JOIN tax_categories tc ON fatc.tax_category_id = tc.id
 * LEFT JOIN financial_entities fe ON fatc.tax_category_id = fe.id
 * WHERE fatc.financial_account_id IN $$financialAccountIds
 */
export const getTaxCategoryByFinancialAccountIds = port<IGetTaxCategoryByFinancialAccountIdsQuery>(
  async ({ financialAccountIds }, db) =>
    (await accountCategories(
      db,
      await db.whereIn(
        'financial_accounts_tax_categories',
        'financial_account_id',
        uuidList(financialAccountIds),
      ),
    )) as never,
);

/** `SELECT fe.*, tc.hashavshevet_name, tc.tax_excluded FROM tax_categories tc LEFT JOIN financial_entities fe ON fe.id = tc.id` */
async function categoriesWithEntities(db: QueryDb, categories: readonly Tc[]) {
  const entities = await byId(
    db,
    'financial_entities',
    categories.map(tc => tc.id),
  );
  return categories.map(tc => ({
    ...(entities.get(tc.id) ?? nullRow('financial_entities')),
    hashavshevet_name: tc.hashavshevet_name,
    tax_excluded: tc.tax_excluded,
  }));
}

/**
 * SELECT fe.*, tc.hashavshevet_name, tc.tax_excluded
 * FROM tax_categories tc LEFT JOIN financial_entities fe ON fe.id = tc.id
 * WHERE tc.id IN $$Ids
 */
export const getTaxCategoryByIDs = port<IGetTaxCategoryByIDsQuery>(
  async ({ Ids }, db) =>
    (await categoriesWithEntities(
      db,
      await db.whereIn('tax_categories', 'id', uuidList(Ids)),
    )) as never,
);

/**
 * SELECT fe.*, tc.hashavshevet_name, tc.tax_excluded
 * FROM tax_categories tc LEFT JOIN financial_entities fe ON fe.id = tc.id
 */
export const getAllTaxCategories = port<IGetAllTaxCategoriesQuery>(
  async (_params, db) =>
    (await categoriesWithEntities(db, await db.rows('tax_categories'))) as never,
);

/**
 * SELECT tcm.tax_category_id, tcm.business_id
 * FROM business_tax_category_match tcm INNER JOIN financial_entities fe ON fe.id = tcm.business_id
 * WHERE tcm.tax_category_id IN $$taxCategoryIds
 * ORDER BY fe.name
 *
 * Businesses with the same name come back in an order the SQL leaves open.
 */
export const getBusinessMatchesByTaxCategoryIds = port<IGetBusinessMatchesByTaxCategoryIdsQuery>(
  async ({ taxCategoryIds }, db) => {
    const matches = await db.whereIn(
      'business_tax_category_match',
      'tax_category_id',
      uuidList(taxCategoryIds),
    );
    const entities = await byId(
      db,
      'financial_entities',
      matches.map(m => m.business_id),
    );
    const joined = [];
    for (const tcm of matches) {
      const fe = entities.get(tcm.business_id);
      if (fe) joined.push({ tcm, name: fe.name });
    }
    return orderBy(joined, [{ value: j => j.name }]).map(({ tcm }) => ({
      tax_category_id: tcm.tax_category_id,
      business_id: tcm.business_id,
    }));
  },
);

/**
 * UPDATE tax_categories SET hashavshevet_name = COALESCE($hashavshevetName, hashavshevet_name),
 *   tax_excluded = COALESCE($taxExcluded, tax_excluded)
 * WHERE id = $taxCategoryId RETURNING *
 */
export const updateTaxCategory = port<IUpdateTaxCategoryQuery>(
  async ({ hashavshevetName, taxExcluded, taxCategoryId }, db) => {
    const patch = coalescePatch({ hashavshevet_name: hashavshevetName, tax_excluded: taxExcluded });
    const id = uuidParam(taxCategoryId);
    if (id == null) return [];
    const updated = [];
    for (const tc of await db.where('tax_categories', { id })) {
      updated.push(await db.update('tax_categories', tc, patch as never));
    }
    return updated;
  },
);

/**
 * UPDATE business_tax_category_match SET tax_category_id = COALESCE($taxCategoryId, tax_category_id)
 * WHERE owner_id = $ownerId AND business_id = $businessId RETURNING *
 */
export const updateBusinessTaxCategory = port<IUpdateBusinessTaxCategoryQuery>(
  async ({ taxCategoryId, ownerId, businessId }, db) => {
    const patch = pgParams(
      'business_tax_category_match',
      coalescePatch({ tax_category_id: taxCategoryId }) as never,
    );
    const owner = uuidParam(ownerId);
    const business = uuidParam(businessId);
    if (owner == null || business == null) return [];
    const updated = [];
    for (const tcm of await db.where('business_tax_category_match', {
      owner_id: owner,
      business_id: business,
    })) {
      updated.push(await db.update('business_tax_category_match', tcm, patch));
    }
    return updated;
  },
);

/**
 * INSERT INTO tax_categories (id, hashavshevet_name, tax_excluded, owner_id)
 * VALUES ($id, $hashavshevetName, $taxExcluded, $ownerId) RETURNING *
 */
export const insertTaxCategory = port<IInsertTaxCategoryQuery>(
  async ({ id, hashavshevetName, taxExcluded, ownerId }, db) => {
    const row = await insertRow(
      db,
      'tax_categories',
      pgParams('tax_categories', {
        id: id ?? null,
        hashavshevet_name: hashavshevetName ?? null,
        tax_excluded: taxExcluded ?? null,
        owner_id: ownerId ?? null,
      } as never),
    );
    return row ? [row] : [];
  },
);

/**
 * INSERT INTO business_tax_category_match (business_id, owner_id, tax_category_id)
 * VALUES ($businessId, $ownerId, $taxCategoryId) RETURNING *
 */
export const insertBusinessTaxCategory = port<IInsertBusinessTaxCategoryQuery>(
  async ({ businessId, ownerId, taxCategoryId }, db) => {
    const row = await insertRow(
      db,
      'business_tax_category_match',
      pgParams('business_tax_category_match', {
        business_id: businessId ?? null,
        owner_id: ownerId ?? null,
        tax_category_id: taxCategoryId ?? null,
      } as never),
    );
    return row ? [row] : [];
  },
);

/**
 * DELETE FROM business_tax_category_match WHERE business_id = $businessId AND owner_id = $ownerId
 * RETURNING *
 */
export const deleteBusinessTaxCategory = port<IDeleteBusinessTaxCategoryQuery>(
  async ({ businessId, ownerId }, db) => {
    const owner = uuidParam(ownerId);
    const business = uuidParam(businessId);
    if (owner == null || business == null) return [];
    const rows = await db.where('business_tax_category_match', {
      business_id: business,
      owner_id: owner,
    });
    const deleted = [];
    for (const tcm of deletable(db, rows))
      deleted.push(await db.delete('business_tax_category_match', tcm));
    return deleted;
  },
);

/** DELETE FROM tax_categories WHERE id = $taxCategoryId RETURNING * */
export const deleteTaxCategory = port<IDeleteTaxCategoryQuery>(async ({ taxCategoryId }, db) => {
  const id = uuidParam(taxCategoryId);
  if (id == null) return [];
  const deleted = [];
  for (const tc of deletable(db, await db.where('tax_categories', { id }))) {
    deleted.push(await db.delete('tax_categories', tc));
  }
  return deleted;
});

/**
 * WITH accounts AS (UPDATE financial_accounts_tax_categories SET tax_category_id = $targetTaxCategoryId
 *     WHERE tax_category_id = $taxCategoryIdToReplace RETURNING financial_account_id),
 *   business_match AS (UPDATE business_tax_category_match SET tax_category_id = $targetTaxCategoryId
 *     WHERE tax_category_id = $taxCategoryIdToReplace RETURNING business_id)
 * UPDATE charges SET tax_category_id = $targetTaxCategoryId WHERE tax_category_id = $taxCategoryIdToReplace
 * RETURNING id
 */
export const replaceTaxCategories = port<IReplaceTaxCategoriesQuery>(
  async ({ targetTaxCategoryId, taxCategoryIdToReplace }, db) => {
    const step = (
      table: 'financial_accounts_tax_categories' | 'business_tax_category_match' | 'charges',
    ) => ({
      table,
      column: 'tax_category_id',
      value: targetTaxCategoryId,
      match: taxCategoryIdToReplace,
    });
    const rows = await runWritableCtes(db, [
      step('financial_accounts_tax_categories'),
      step('business_tax_category_match'),
      step('charges'),
    ]);
    return rows.map(row => ({ id: row.id as string }));
  },
);
