import { FX } from '../_fixture-ids.js';
import type {
  IDeleteFinancialEntityQuery,
  IGetFinancialEntitiesByIdsQuery,
  IInsertFinancialEntitiesParams,
  IInsertFinancialEntitiesQuery,
  IReplaceFinancialEntitiesQuery,
  IUpdateFinancialEntityQuery,
} from '../../../../../modules/financial-entities/__generated__/financial-entities.types.js';
import { caseFor, type Cases } from '../../../cases.js';

type NewEntity = IInsertFinancialEntitiesParams['financialEntities'][number];
const entity = (ownerId: string | null, values: Partial<NewEntity>): NewEntity => ({
  type: 'business',
  ownerId,
  name: 'New Entity',
  sortCode: null,
  irsCode: null,
  isActive: true,
  ...values,
});

export const cases: Cases = {
  getFinancialEntitiesByIds: caseFor<IGetFinancialEntitiesByIdsQuery>(s => [
    { ids: [FX.alpha, FX.tcAlpha, FX.theta, s.businessId, s.missingId] },
    { ids: [FX.alpha.toUpperCase(), null] },
    { ids: [s.missingId] },
  ]),
  updateFinancialEntity: caseFor<IUpdateFinancialEntityQuery>(s => [
    {
      financialEntityId: FX.alpha,
      name: 'Alpha Renamed',
      sortCode: 300,
      irsCode: 2020,
      isActive: false,
      type: null,
    },
    { financialEntityId: FX.alpha, type: 'tax_category' },
    { financialEntityId: FX.theta }, // nothing to change (updated_at still moves)
    { financialEntityId: FX.beta, sortCode: 999 }, // no such sort code: 23503
    { financialEntityId: FX.alpha, irsCode: 40000 }, // smallint: 22003
    { financialEntityId: s.missingId, name: 'Missing' },
    { financialEntityId: null, name: 'Nothing' },
  ]),
  insertFinancialEntities: caseFor<IInsertFinancialEntitiesQuery>(s => [
    {
      financialEntities: [
        entity(s.businessId, { name: 'New A', sortCode: 100 }),
        entity(s.businessId, { type: 'tag', name: 'New B', irsCode: 5, isActive: false }),
      ],
    },
    { financialEntities: [entity(s.businessId, { isActive: null })] }, // explicit NULL: 23502
    { financialEntities: [entity(s.businessId, { sortCode: 999 })] }, // 23503
    { financialEntities: [entity(null, {})] }, // RLS
    { financialEntities: [entity(s.missingId, {})] }, // RLS
    { financialEntities: [entity(s.businessId, { name: null })] },
  ]),
  deleteFinancialEntity: caseFor<IDeleteFinancialEntityQuery>(s => [
    { financialEntityId: FX.theta }, // unreferenced
    { financialEntityId: FX.alpha }, // its businesses row references it: 23503
    { financialEntityId: FX.tcGamma }, // its tax_categories row references it: 23503
    { financialEntityId: s.missingId },
    { financialEntityId: null },
  ]),
  replaceFinancialEntities: caseFor<IReplaceFinancialEntitiesQuery>(s => [
    { targetEntityId: FX.zeta, entityIdToReplace: FX.eta },
    { targetEntityId: FX.alpha, entityIdToReplace: FX.beta },
    { targetEntityId: s.missingId, entityIdToReplace: FX.eta }, // 23503
    { targetEntityId: FX.zeta, entityIdToReplace: s.missingId },
    { targetEntityId: null, entityIdToReplace: FX.eta }, // misc_expenses.debtor_id NOT NULL
  ]),
};
