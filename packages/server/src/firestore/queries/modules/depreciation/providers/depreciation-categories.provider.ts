import { given, numericTypmod } from '../_helpers.js';
import type {
  IDeleteDepreciationCategoryQuery,
  IGetAllDepreciationCategoriesQuery,
  IGetDepreciationCategoriesByIdsQuery,
  IInsertDepreciationCategoryQuery,
  IUpdateDepreciationCategoryQuery,
} from '../../../../../modules/depreciation/__generated__/depreciation-categories.types.js';
import type { Row } from '../../../../catalog.js';
import { coalescePatch } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';

/** depreciation_categories.percentage is numeric(5,2). */
const percentageValue = (value: number | string | null | undefined | void) =>
  numericTypmod(value, 5, 2);

/** SELECT * FROM depreciation_categories */
export const getAllDepreciationCategories = port<IGetAllDepreciationCategoriesQuery>(
  async (_params, db) => db.rows('depreciation_categories'),
);

/** SELECT * FROM depreciation_categories WHERE id IN $$depreciationCategoriesIds */
export const getDepreciationCategoriesByIds = port<IGetDepreciationCategoriesByIdsQuery>(
  async ({ depreciationCategoriesIds }, db) =>
    db.whereIn('depreciation_categories', 'id', depreciationCategoriesIds),
);

/**
 * UPDATE depreciation_categories
 * SET name = COALESCE($name, name), percentage = COALESCE($percentage, percentage)
 * WHERE id = $depreciationCategoryId
 * RETURNING *
 */
export const updateDepreciationCategory = port<IUpdateDepreciationCategoryQuery>(
  async ({ depreciationCategoryId, name, percentage }, db) => {
    if (depreciationCategoryId == null) return [];
    const result = [];
    for (const row of await db.where('depreciation_categories', { id: depreciationCategoryId })) {
      result.push(
        await db.update(
          'depreciation_categories',
          row,
          coalescePatch({
            name: given(name),
            percentage: percentageValue(percentage),
          }) as Partial<Row<'depreciation_categories'>>,
        ),
      );
    }
    return result;
  },
);

/** INSERT INTO depreciation_categories (name, percentage) VALUES ($name, $percentage) RETURNING * */
export const insertDepreciationCategory = port<IInsertDepreciationCategoryQuery>(
  async ({ name, percentage }, db) => {
    const row = await db.insert('depreciation_categories', {
      name: (name ?? null) as never,
      percentage: percentageValue(percentage) as never,
    });
    return row ? [row] : [];
  },
);

/**
 * DELETE FROM depreciation_categories WHERE id = $depreciationCategoryId RETURNING id
 *
 * A category still used by an asset raises 23503 (depreciation.category, ON DELETE NO ACTION).
 * The store checks that in the tenant partitions it has loaded only, so an asset of a tenant this
 * instance has not loaded does not stop the delete (store core; Postgres checks every tenant).
 */
export const deleteDepreciationCategory = port<IDeleteDepreciationCategoryQuery>(
  async ({ depreciationCategoryId }, db) => {
    if (depreciationCategoryId == null) return [];
    const result = [];
    for (const row of await db.where('depreciation_categories', { id: depreciationCategoryId })) {
      await db.delete('depreciation_categories', row);
      result.push({ id: row.id });
    }
    return result;
  },
);
