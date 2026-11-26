import type {
  IDeleteChargeUnbalancedBusinessesByBusinessIdQuery,
  IDeleteChargeUnbalancedBusinessesByChargeIdQuery,
  IDeleteChargeUnbalancedBusinessesQuery,
  IGetChargeUnbalancedBusinessesByChargeIdsQuery,
  IInsertChargeUnbalancedBusinessesQuery,
  IUpdateChargeUnbalancedBusinessQuery,
} from '../../../../../modules/ledger/__generated__/unbalanced-businesses.types.js';
import { inList } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';
import { deletable } from '../../charges/_helpers.js';

/** SELECT * FROM charge_unbalanced_ledger_businesses WHERE charge_id IN $$chargeIds */
export const getChargeUnbalancedBusinessesByChargeIds =
  port<IGetChargeUnbalancedBusinessesByChargeIdsQuery>(async ({ chargeIds }, db) =>
    db.whereIn('charge_unbalanced_ledger_businesses', 'charge_id', chargeIds),
  );

/**
 * INSERT INTO charge_unbalanced_ledger_businesses (charge_id, business_id, remark, owner_id)
 * VALUES $$unbalancedBusinesses(chargeId, businessId, remark, ownerId)
 * ON CONFLICT DO NOTHING RETURNING *
 */
export const insertChargeUnbalancedBusinesses = port<IInsertChargeUnbalancedBusinessesQuery>(
  async ({ unbalancedBusinesses }, db) => {
    const result = [];
    for (const b of unbalancedBusinesses) {
      const row = await db.insert(
        'charge_unbalanced_ledger_businesses',
        {
          charge_id: (b.chargeId ?? null) as never,
          business_id: (b.businessId ?? null) as never,
          remark: b.remark ?? null,
          owner_id: (b.ownerId ?? null) as never,
        },
        { action: 'nothing' },
      );
      if (row) result.push(row);
    }
    return result;
  },
);

/** DELETE FROM charge_unbalanced_ledger_businesses WHERE charge_id = $chargeId AND business_id IN $$businessIds */
export const deleteChargeUnbalancedBusinesses = port<IDeleteChargeUnbalancedBusinessesQuery>(
  async ({ chargeId, businessIds }, db) => {
    if (chargeId == null) return [];
    const isBusiness = inList(businessIds);
    const rows = await db.where('charge_unbalanced_ledger_businesses', { charge_id: chargeId });
    for (const row of deletable(db, rows)) {
      if (isBusiness(row.business_id)) await db.delete('charge_unbalanced_ledger_businesses', row);
    }
    return [];
  },
);

/** DELETE FROM charge_unbalanced_ledger_businesses WHERE business_id = $businessId */
export const deleteChargeUnbalancedBusinessesByBusinessId =
  port<IDeleteChargeUnbalancedBusinessesByBusinessIdQuery>(async ({ businessId }, db) => {
    if (businessId == null) return [];
    const rows = await db.where('charge_unbalanced_ledger_businesses', { business_id: businessId });
    for (const row of deletable(db, rows)) {
      await db.delete('charge_unbalanced_ledger_businesses', row);
    }
    return [];
  });

/** DELETE FROM charge_unbalanced_ledger_businesses WHERE charge_id = $chargeId */
export const deleteChargeUnbalancedBusinessesByChargeId =
  port<IDeleteChargeUnbalancedBusinessesByChargeIdQuery>(async ({ chargeId }, db) => {
    if (chargeId == null) return [];
    const rows = await db.where('charge_unbalanced_ledger_businesses', { charge_id: chargeId });
    for (const row of deletable(db, rows)) {
      await db.delete('charge_unbalanced_ledger_businesses', row);
    }
    return [];
  });

/**
 * UPDATE charge_unbalanced_ledger_businesses SET remark = $remark
 * WHERE charge_id = $chargeId AND business_id = $businessId RETURNING *
 */
export const updateChargeUnbalancedBusiness = port<IUpdateChargeUnbalancedBusinessQuery>(
  async ({ chargeId, businessId, remark }, db) => {
    if (chargeId == null || businessId == null) return [];
    const result = [];
    for (const row of await db.where('charge_unbalanced_ledger_businesses', {
      charge_id: chargeId,
      business_id: businessId,
    })) {
      result.push(
        await db.update('charge_unbalanced_ledger_businesses', row, { remark: remark ?? null }),
      );
    }
    return result;
  },
);
