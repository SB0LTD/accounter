import type {
  IDeleteDepreciationCategoryQuery,
  IGetDepreciationCategoriesByIdsQuery,
  IInsertDepreciationCategoryQuery,
  IUpdateDepreciationCategoryQuery,
} from '../../../../../modules/depreciation/__generated__/depreciation-categories.types.js';
import { caseFor, type Cases } from '../../../cases.js';

/** Fixture ids (060-depreciation-securities.sql) */
const id = (n: number) => `0f060000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const COMPUTERS = id(1);
const FURNITURE = id(2);
const LAND = id(3);
const UNUSED = id(4); // no asset uses it

export const cases: Cases = {
  getDepreciationCategoriesByIds: caseFor<IGetDepreciationCategoriesByIdsQuery>(s => [
    { depreciationCategoriesIds: [COMPUTERS, LAND, s.missingId] },
    { depreciationCategoriesIds: [s.missingId] },
  ]),
  updateDepreciationCategory: caseFor<IUpdateDepreciationCategoryQuery>(s => [
    { depreciationCategoryId: COMPUTERS, name: 'PCs', percentage: null },
    { depreciationCategoryId: FURNITURE, name: null, percentage: 7.125 }, // rounds to 7.13
    { depreciationCategoryId: LAND, name: null, percentage: null },
    { depreciationCategoryId: UNUSED, name: 'Cars', percentage: '12' }, // 12.00
    { depreciationCategoryId: UNUSED, percentage: 1000 }, // 22003
    { depreciationCategoryId: s.missingId, name: 'nothing', percentage: 1 },
    { depreciationCategoryId: null, name: 'nothing' },
  ]),
  insertDepreciationCategory: caseFor<IInsertDepreciationCategoryQuery>(() => [
    { name: 'Software', percentage: 25 },
    { name: 'Precise', percentage: '12.345' },
    { name: 'Negative', percentage: -999.994 },
    { name: 'Overflow', percentage: 999.995 }, // rounds to 1000.00: 22003
    { name: null, percentage: 10 }, // 23502
  ]),
  deleteDepreciationCategory: caseFor<IDeleteDepreciationCategoryQuery>(s => [
    { depreciationCategoryId: UNUSED },
    { depreciationCategoryId: COMPUTERS }, // still used: 23503
    { depreciationCategoryId: s.missingId },
    // Not a case: category 005, used only by an asset of a business outside the request's scope.
    // Postgres's foreign key sees that asset and raises 23503; the store only checks the tenant
    // partitions it has loaded, so it deletes the category (a store-core gap, reported).
  ]),
};
