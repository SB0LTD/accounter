import type {
  IDeleteDepreciationDisposalQuery,
  IGetDepreciationDisposalsByChargeIdsQuery,
  IGetDepreciationDisposalsByDatesQuery,
  IGetDepreciationDisposalsByDepreciationIdsQuery,
  IGetDepreciationDisposalsByIdsQuery,
  IInsertDepreciationDisposalParams,
  IInsertDepreciationDisposalQuery,
  IReplaceDepreciationDisposalsChargeIdQuery,
  IUpdateDepreciationDisposalQuery,
} from '../../../../../modules/depreciation/__generated__/depreciation-disposals.types.js';
import { caseFor, type Cases, type Snapshot } from '../../../cases.js';

/** Fixture ids (060-depreciation-securities.sql) */
const id = (n: number) => `0f060000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** A column of a fixture row, read from the loaded data. */
const field = (
  s: Snapshot,
  table: 'depreciation' | 'depreciation_disposals',
  n: number,
  column: string,
) => s.rows(table).find(row => row.id === id(n))?.[column] as string;

const base = (s: Snapshot): IInsertDepreciationDisposalParams => ({
  ownerId: s.businessId,
  depreciationId: id(101),
  chargeId: null,
  type: 'SALE',
  refundMode: null,
  disposalDate: '2025-01-01',
  disposedCost: 100.5,
  originalAmount: null,
  originalCurrency: null,
  proceeds: 50,
  description: 'Fixture sale',
});

export const cases: Cases = {
  getDepreciationDisposalsByIds: caseFor<IGetDepreciationDisposalsByIdsQuery>(s => [
    { ids: [id(201), id(202), id(207), s.missingId] }, // 207 is another business's
    { ids: [s.missingId] },
  ]),
  getDepreciationDisposalsByDepreciationIds:
    caseFor<IGetDepreciationDisposalsByDepreciationIdsQuery>(s => [
      { depreciationIds: [id(101), id(105), id(103), id(107)] },
      { depreciationIds: [id(105)] },
      { depreciationIds: [s.missingId] },
    ]),
  getDepreciationDisposalsByChargeIds: caseFor<IGetDepreciationDisposalsByChargeIdsQuery>(s => [
    { chargeIds: s.values('depreciation_disposals', 'charge_id', 5) as string[] },
    { chargeIds: [field(s, 'depreciation_disposals', 201, 'charge_id')] },
    { chargeIds: [s.missingId] },
  ]),
  getDepreciationDisposalsByDates: caseFor<IGetDepreciationDisposalsByDatesQuery>(() => [
    { fromDate: '2023-01-01', toDate: '2024-06-30' },
    { fromDate: '2024-06-30', toDate: '2024-06-30' }, // two on one day: by id
    { fromDate: '2023-01-31', toDate: '2023-12-31' },
    { fromDate: '2025-01-01', toDate: '2024-01-01' },
    { fromDate: null, toDate: '2024-01-01' },
  ]),
  insertDepreciationDisposal: caseFor<IInsertDepreciationDisposalQuery>(s => [
    base(s),
    {
      ...base(s),
      chargeId: field(s, 'depreciation_disposals', 201, 'charge_id'),
      type: 'COST_REFUND',
      refundMode: 'FROM_ACTIVATION',
      disposedCost: null,
      originalAmount: '12.3456',
      originalCurrency: 'USD',
      proceeds: 0,
      description: null,
    },
    { ...base(s), proceeds: null }, // explicit NULL: 23502, not the default
    { ...base(s), disposedCost: 0 }, // 23514
    { ...base(s), depreciationId: id(107) }, // another business's asset: 23503
    { ...base(s), depreciationId: s.missingId }, // 23503
  ]),
  updateDepreciationDisposal: caseFor<IUpdateDepreciationDisposalQuery>(s => [
    // clear the charge; NULLs for the plain-assigned columns
    { id: id(201), clearChargeId: true, chargeId: null },
    // COALESCE columns keep their values when NULL
    {
      id: id(202),
      chargeId: field(s, 'depreciation_disposals', 201, 'charge_id'),
      clearChargeId: false,
      type: 'SALE',
      refundMode: null,
      disposalDate: '2023-02-28',
      disposedCost: 999.99,
      originalAmount: null,
      originalCurrency: null,
      proceeds: 10,
      description: 'Sold after all',
    },
    {
      id: id(204),
      type: null,
      refundMode: 'FROM_REFUND_DATE',
      disposalDate: null,
      disposedCost: null,
      originalAmount: 600,
      originalCurrency: 'USD',
      proceeds: null,
      description: 'Vendor refund',
    },
    { id: id(203), disposedCost: -1 }, // 23514
    { id: id(207), description: 'not mine' }, // another business's: no row
    { id: s.missingId, description: 'nothing' },
  ]),
  deleteDepreciationDisposal: caseFor<IDeleteDepreciationDisposalQuery>(s => [
    { id: id(201) },
    { id: id(207) },
    { id: s.missingId },
  ]),
  replaceDepreciationDisposalsChargeId: caseFor<IReplaceDepreciationDisposalsChargeIdQuery>(s => [
    {
      replaceChargeID: field(s, 'depreciation_disposals', 201, 'charge_id'),
      assertChargeID: field(s, 'depreciation_disposals', 205, 'charge_id'),
    },
    { replaceChargeID: field(s, 'depreciation_disposals', 205, 'charge_id'), assertChargeID: null },
    {
      replaceChargeID: field(s, 'depreciation_disposals', 205, 'charge_id'),
      assertChargeID: s.missingId,
    }, // 23503
    { replaceChargeID: s.missingId, assertChargeID: field(s, 'depreciation', 101, 'charge_id') },
  ]),
};
