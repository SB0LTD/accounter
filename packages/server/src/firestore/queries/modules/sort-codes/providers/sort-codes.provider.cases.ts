import type {
  IGetSortCodesByIdsQuery,
  IGetSortCodesByOwnerIdsQuery,
  IInsertSortCodeQuery,
  IInsertSortCodesQuery,
  IUpdateSortCodeQuery,
} from '../../../../../modules/sort-codes/__generated__/sort-codes.types.js';
import { caseFor, type Cases } from '../../../cases.js';

// Fixture sort codes (scripts/firestore/fixtures/020-financial-entities.sql): 100 Revenue (1000),
// 200 Expenses, 300 Assets (3000), 400 Unused.

export const cases: Cases = {
  getSortCodesByIds: caseFor<IGetSortCodesByIdsQuery>(() => [
    { isSortCodesIds: 1, sortCodesIds: [100, 300, 999] },
    { isSortCodesIds: 0, sortCodesIds: [null] }, // every sort code
    { isSortCodesIds: 1, sortCodesIds: [999] },
    { isSortCodesIds: null, sortCodesIds: [200] }, // NULL = 0 is not true: the list decides
  ]),
  getSortCodesByOwnerIds: caseFor<IGetSortCodesByOwnerIdsQuery>(s => [
    { ownerIds: [s.businessId] },
    { ownerIds: [s.missingId, null] },
  ]),
  insertSortCode: caseFor<IInsertSortCodeQuery>(s => [
    { name: 'New code', key: 500, defaultIrsCode: 5000, ownerId: s.businessId },
    { name: 'No IRS code', key: 501, defaultIrsCode: null, ownerId: s.businessId },
    // duplicate primary key (key, owner_id)
    { name: 'Duplicate', key: 100, defaultIrsCode: null, ownerId: s.businessId },
    // NOT NULL name
    { name: null, key: 502, defaultIrsCode: null, ownerId: s.businessId },
    // another tenant: RLS WITH CHECK
    { name: 'Foreign', key: 503, defaultIrsCode: null, ownerId: s.missingId },
    // smallint out of range
    { name: 'Too big', key: 504, defaultIrsCode: 40000, ownerId: s.businessId },
  ]),
  insertSortCodes: caseFor<IInsertSortCodesQuery>(s => [
    {
      sortCodes: [
        { name: 'Batch A', key: 600, defaultIrsCode: 6000, ownerId: s.businessId },
        { name: 'Existing', key: 100, defaultIrsCode: null, ownerId: s.businessId }, // skipped
        { name: 'Batch B', key: 601, defaultIrsCode: null, ownerId: s.businessId },
      ],
    },
    {
      // the second row conflicts with the first: skipped too
      sortCodes: [
        { name: 'Twice 1', key: 700, defaultIrsCode: null, ownerId: s.businessId },
        { name: 'Twice 2', key: 700, defaultIrsCode: 1, ownerId: s.businessId },
      ],
    },
    {
      sortCodes: [{ name: 'Existing only', key: 200, defaultIrsCode: null, ownerId: s.businessId }],
    },
    { sortCodes: [{ name: null, key: 701, defaultIrsCode: null, ownerId: s.businessId }] },
  ]),
  updateSortCode: caseFor<IUpdateSortCodeQuery>(s => [
    { key: 100, ownerId: s.businessId, name: 'Revenue renamed', defaultIrsCode: null },
    { key: 200, ownerId: s.businessId, name: null, defaultIrsCode: 2000 },
    { key: 300, ownerId: s.businessId, name: null, defaultIrsCode: null },
    { key: 999, ownerId: s.businessId, name: 'Missing', defaultIrsCode: 1 },
    { key: 100, ownerId: s.missingId, name: 'Other tenant', defaultIrsCode: 1 },
  ]),
};
