import { FX } from '../_fixture-ids.js';
import type {
  IDeleteAllChargeSpreadByChargeIdAndYearOfRelevanceQuery,
  IDeleteAllChargeSpreadByChargeIdsQuery,
  IGetChargesSpreadByChargeIdsQuery,
  IInsertChargeSpreadQuery,
  IUpdateChargeSpreadQuery,
} from '../../../../../modules/charges/__generated__/charge-spread.types.js';
import { caseFor, type Cases } from '../../../cases.js';

export const cases: Cases = {
  getChargesSpreadByChargeIds: caseFor<IGetChargesSpreadByChargeIdsQuery>(s => [
    { chargeIds: [FX.officeSupplies, FX.retainer, FX.hardware] },
    { chargeIds: [s.missingId] },
  ]),

  updateChargeSpread: caseFor<IUpdateChargeSpreadQuery>(s => [
    { chargeId: FX.officeSupplies, year: '2024-01-01', amount: 650.555 },
    { chargeId: FX.officeSupplies, year: '2025-01-01', amount: null },
    { chargeId: FX.retainer, year: '2024-01-01', amount: '12' },
    { chargeId: FX.officeSupplies, year: '2030-01-01', amount: 1 },
    { chargeId: FX.officeSupplies, year: null, amount: 1 },
    { chargeId: s.missingId, year: '2024-01-01', amount: 1 },
  ]),

  insertChargeSpread: caseFor<IInsertChargeSpreadQuery>(s => [
    {
      chargeSpread: [
        {
          chargeId: FX.hardware,
          yearOfRelevance: '2024-01-01',
          amount: 100,
          ownerId: s.businessId,
        },
        {
          chargeId: FX.hardware,
          yearOfRelevance: '2025-01-01',
          amount: '99.999',
          ownerId: s.businessId,
        },
        {
          chargeId: FX.hardware,
          yearOfRelevance: '2026-01-01',
          amount: null,
          ownerId: s.businessId,
        },
      ],
    },
    // primary key (charge_id, year_of_relevance) taken
    {
      chargeSpread: [
        {
          chargeId: FX.officeSupplies,
          yearOfRelevance: '2024-01-01',
          amount: 1,
          ownerId: s.businessId,
        },
      ],
    },
    // numeric(8,2) overflow
    {
      chargeSpread: [
        {
          chargeId: FX.hardware,
          yearOfRelevance: '2024-01-01',
          amount: 1_234_567.89,
          ownerId: s.businessId,
        },
      ],
    },
    // unknown charge
    {
      chargeSpread: [
        { chargeId: s.missingId, yearOfRelevance: '2024-01-01', amount: 1, ownerId: s.businessId },
      ],
    },
  ]),

  deleteAllChargeSpreadByChargeIds: caseFor<IDeleteAllChargeSpreadByChargeIdsQuery>(s => [
    { chargeIds: [FX.officeSupplies, FX.retainer] },
    { chargeIds: [s.missingId] },
  ]),

  deleteAllChargeSpreadByChargeIdAndYearOfRelevance:
    caseFor<IDeleteAllChargeSpreadByChargeIdAndYearOfRelevanceQuery>(() => [
      { chargeId: FX.officeSupplies, yearOfRelevance: '2024-01-01' },
      { chargeId: FX.officeSupplies, yearOfRelevance: '2026-01-01' },
    ]),
};
