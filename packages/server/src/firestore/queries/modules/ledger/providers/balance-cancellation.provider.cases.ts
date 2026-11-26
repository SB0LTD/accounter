import type {
  IDeleteBalanceCancellationByBusinessIdQuery,
  IDeleteBalanceCancellationByChargeIdsQuery,
  IGetBalanceCancellationByChargesIdsQuery,
} from '../../../../../modules/ledger/__generated__/balance-cancellation.types.js';
import { caseFor, type Cases } from '../../../cases.js';
import { FX } from '../../charges/_fixture-ids.js';

export const cases: Cases = {
  getBalanceCancellationByChargesIds: caseFor<IGetBalanceCancellationByChargesIdsQuery>(s => [
    { chargeIds: [FX.officeSupplies, FX.retainer, FX.hardware] },
    { chargeIds: [s.missingId] },
  ]),
  deleteBalanceCancellationByBusinessId: caseFor<IDeleteBalanceCancellationByBusinessIdQuery>(s => [
    { businessId: FX.globex },
    { businessId: s.missingId },
    { businessId: null },
  ]),
  deleteBalanceCancellationByChargeIds: caseFor<IDeleteBalanceCancellationByChargeIdsQuery>(s => [
    { chargeIds: [FX.officeSupplies, FX.retainer] },
    { chargeIds: [s.missingId] },
  ]),
};
