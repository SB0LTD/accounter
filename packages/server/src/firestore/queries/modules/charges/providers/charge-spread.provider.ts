import { deletable, toNumericTypmod } from '../_helpers.js';
import type {
  IDeleteAllChargeSpreadByChargeIdAndYearOfRelevanceQuery,
  IDeleteAllChargeSpreadByChargeIdsQuery,
  IGetChargesSpreadByChargeIdsQuery,
  IInsertChargeSpreadQuery,
  IUpdateChargeSpreadQuery,
} from '../../../../../modules/charges/__generated__/charge-spread.types.js';
import { toDateString } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';

/** charge_spread.amount is numeric(8,2): the store does not apply the typmod, so the ports do. */
const spreadAmount = (amount: string | number | null | void) =>
  toNumericTypmod(amount ?? null, 8, 2);

/** SELECT * FROM charge_spread WHERE charge_id IN $$chargeIds */
export const getChargesSpreadByChargeIds = port<IGetChargesSpreadByChargeIdsQuery>(
  async ({ chargeIds }, db) => (await db.whereIn('charge_spread', 'charge_id', chargeIds)) as never,
);

/**
 * WITH variables (year) AS (VALUES ($year::DATE))
 * UPDATE charge_spread SET year_of_relevance = COALESCE(variables.year, year_of_relevance),
 *   amount = COALESCE($amount, amount)
 * FROM variables WHERE charge_id = $chargeId AND year_of_relevance = variables.year
 * RETURNING *   -- charge_spread's columns plus variables.year
 */
export const updateChargeSpread = port<IUpdateChargeSpreadQuery>(
  async ({ year, amount, chargeId }, db) => {
    const yearDate = year == null ? null : toDateString(year);
    if (chargeId == null || yearDate == null) return [];
    const result = [];
    for (const row of await db.where('charge_spread', {
      charge_id: chargeId,
      year_of_relevance: yearDate,
    })) {
      const updated = await db.update('charge_spread', row, {
        year_of_relevance: yearDate,
        amount: amount == null ? row.amount : spreadAmount(amount),
      });
      result.push({ ...updated, year: yearDate });
    }
    return result as never;
  },
);

/**
 * INSERT INTO charge_spread (charge_id, year_of_relevance, amount, owner_id)
 * VALUES $$chargeSpread(chargeId, yearOfRelevance, amount, ownerId) RETURNING *
 */
export const insertChargeSpread = port<IInsertChargeSpreadQuery>(async ({ chargeSpread }, db) => {
  const result = [];
  for (const spread of chargeSpread) {
    const row = await db.insert('charge_spread', {
      charge_id: (spread.chargeId ?? null) as never,
      year_of_relevance: (spread.yearOfRelevance ?? null) as never,
      amount: spreadAmount(spread.amount),
      owner_id: (spread.ownerId ?? null) as never,
    });
    if (row) result.push(row);
  }
  return result as never;
});

/** DELETE FROM charge_spread WHERE charge_id IN $$chargeIds */
export const deleteAllChargeSpreadByChargeIds = port<IDeleteAllChargeSpreadByChargeIdsQuery>(
  async ({ chargeIds }, db) => {
    for (const row of deletable(db, await db.whereIn('charge_spread', 'charge_id', chargeIds))) {
      await db.delete('charge_spread', row);
    }
    return [];
  },
);

/** DELETE FROM charge_spread WHERE charge_id = $chargeId AND year_of_relevance = $yearOfRelevance */
export const deleteAllChargeSpreadByChargeIdAndYearOfRelevance =
  port<IDeleteAllChargeSpreadByChargeIdAndYearOfRelevanceQuery>(
    async ({ chargeId, yearOfRelevance }, db) => {
      if (chargeId == null || yearOfRelevance == null) return [];
      const rows = await db.where('charge_spread', {
        charge_id: chargeId,
        year_of_relevance: toDateString(yearOfRelevance),
      });
      for (const row of deletable(db, rows)) {
        await db.delete('charge_spread', row);
      }
      return [];
    },
  );
