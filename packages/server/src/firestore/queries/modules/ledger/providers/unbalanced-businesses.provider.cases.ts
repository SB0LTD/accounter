import type {
  IDeleteChargeUnbalancedBusinessesByBusinessIdQuery,
  IDeleteChargeUnbalancedBusinessesByChargeIdQuery,
  IDeleteChargeUnbalancedBusinessesQuery,
  IGetChargeUnbalancedBusinessesByChargeIdsQuery,
  IInsertChargeUnbalancedBusinessesQuery,
  IUpdateChargeUnbalancedBusinessQuery,
} from '../../../../../modules/ledger/__generated__/unbalanced-businesses.types.js';
import { caseFor, type Cases } from '../../../cases.js';
import { FX } from '../../charges/_fixture-ids.js';

export const cases: Cases = {
  getChargeUnbalancedBusinessesByChargeIds: caseFor<IGetChargeUnbalancedBusinessesByChargeIdsQuery>(
    s => [{ chargeIds: [FX.officeSupplies, FX.hardware] }, { chargeIds: [s.missingId] }],
  ),

  insertChargeUnbalancedBusinesses: caseFor<IInsertChargeUnbalancedBusinessesQuery>(s => [
    {
      unbalancedBusinesses: [
        { chargeId: FX.retainer, businessId: FX.initech, remark: 'new', ownerId: s.businessId },
        // already there: skipped
        {
          chargeId: FX.officeSupplies,
          businessId: FX.globex,
          remark: 'dup',
          ownerId: s.businessId,
        },
        { chargeId: FX.retainer, businessId: FX.globex, remark: null, ownerId: s.businessId },
        // repeats a row of this statement: skipped
        { chargeId: FX.retainer, businessId: FX.initech, remark: 'again', ownerId: s.businessId },
      ],
    },
    // unknown business: foreign key
    {
      unbalancedBusinesses: [
        { chargeId: FX.retainer, businessId: s.missingId, remark: null, ownerId: s.businessId },
      ],
    },
  ]),

  deleteChargeUnbalancedBusinesses: caseFor<IDeleteChargeUnbalancedBusinessesQuery>(s => [
    { chargeId: FX.officeSupplies, businessIds: [FX.globex, s.missingId] },
    { chargeId: FX.officeSupplies, businessIds: [s.missingId] },
  ]),

  deleteChargeUnbalancedBusinessesByBusinessId:
    caseFor<IDeleteChargeUnbalancedBusinessesByBusinessIdQuery>(s => [
      { businessId: FX.globex },
      { businessId: s.missingId },
    ]),

  deleteChargeUnbalancedBusinessesByChargeId:
    caseFor<IDeleteChargeUnbalancedBusinessesByChargeIdQuery>(s => [
      { chargeId: FX.officeSupplies },
      { chargeId: s.missingId },
    ]),

  updateChargeUnbalancedBusiness: caseFor<IUpdateChargeUnbalancedBusinessQuery>(s => [
    { chargeId: FX.officeSupplies, businessId: FX.globex, remark: 'updated' },
    { chargeId: FX.officeSupplies, businessId: FX.acmeConsulting, remark: null },
    { chargeId: FX.officeSupplies, businessId: s.missingId, remark: 'none' },
  ]),
};
