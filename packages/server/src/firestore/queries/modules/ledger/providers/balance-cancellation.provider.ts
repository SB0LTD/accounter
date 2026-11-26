import type {
  IDeleteBalanceCancellationByBusinessIdQuery,
  IDeleteBalanceCancellationByChargeIdsQuery,
  IGetBalanceCancellationByChargesIdsQuery,
} from '../../../../../modules/ledger/__generated__/balance-cancellation.types.js';
import { port } from '../../../port.js';
import { deletable } from '../../charges/_helpers.js';

/** SELECT * FROM charge_balance_cancellation WHERE charge_id IN $$chargeIds */
export const getBalanceCancellationByChargesIds = port<IGetBalanceCancellationByChargesIdsQuery>(
  async ({ chargeIds }, db) => db.whereIn('charge_balance_cancellation', 'charge_id', chargeIds),
);

/** DELETE FROM charge_balance_cancellation WHERE business_id = $businessId */
export const deleteBalanceCancellationByBusinessId =
  port<IDeleteBalanceCancellationByBusinessIdQuery>(async ({ businessId }, db) => {
    if (businessId == null) return [];
    const rows = await db.where('charge_balance_cancellation', { business_id: businessId });
    for (const row of deletable(db, rows)) {
      await db.delete('charge_balance_cancellation', row);
    }
    return [];
  });

/** DELETE FROM charge_balance_cancellation WHERE charge_id IN $$chargeIds */
export const deleteBalanceCancellationByChargeIds =
  port<IDeleteBalanceCancellationByChargeIdsQuery>(async ({ chargeIds }, db) => {
    const rows = await db.whereIn('charge_balance_cancellation', 'charge_id', chargeIds);
    for (const row of deletable(db, rows)) {
      await db.delete('charge_balance_cancellation', row);
    }
    return [];
  });
