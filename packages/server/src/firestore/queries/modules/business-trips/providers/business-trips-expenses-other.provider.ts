import type {
  IDeleteBusinessTripOtherExpenseQuery,
  IGetBusinessTripsOtherExpensesByBusinessTripIdsQuery,
  IGetBusinessTripsOtherExpensesByBusinessTripIdsResult,
  IGetBusinessTripsOtherExpensesByIdsQuery,
  IGetBusinessTripsOtherExpensesByIdsResult,
  IInsertBusinessTripOtherExpenseQuery,
  IUpdateBusinessTripOtherExpenseQuery,
} from '../../../../../modules/business-trips/__generated__/business-trips-expenses-other.types.js';
import { coalescePatch, inList } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';
import { equalsZero, orTrue, withExtended } from '../_helpers.js';

/**
 * SELECT * FROM business_trips_transactions_other a
 * LEFT JOIN extended_business_trip_transactions t USING (id)
 * WHERE ($isBusinessTripIds = 0 OR t.business_trip_id IN $$businessTripIds)
 */
export const getBusinessTripsOtherExpensesByBusinessTripIds =
  port<IGetBusinessTripsOtherExpensesByBusinessTripIdsQuery>(
    async ({ isBusinessTripIds, businessTripIds }, db) => {
      const all = equalsZero(isBusinessTripIds);
      const inTrips = inList(businessTripIds);
      const rows = await withExtended(db, await db.rows('business_trips_transactions_other'));
      return rows.filter(row =>
        orTrue(all, inTrips(row.business_trip_id)),
      ) as IGetBusinessTripsOtherExpensesByBusinessTripIdsResult[];
    },
  );

/**
 * SELECT * FROM business_trips_transactions_other a
 * LEFT JOIN extended_business_trip_transactions t USING (id)
 * WHERE ($isIds = 0 OR t.id IN $$expenseIds)
 *
 * `t.id` is the view's id: NULL for a row without an expense row.
 */
export const getBusinessTripsOtherExpensesByIds = port<IGetBusinessTripsOtherExpensesByIdsQuery>(
  async ({ isIds, expenseIds }, db) => {
    const all = equalsZero(isIds);
    const inIds = inList(expenseIds);
    const rows = await withExtended(db, await db.rows('business_trips_transactions_other'));
    return rows.filter(row =>
      orTrue(all, row.business_trip_id != null && inIds(row.id)),
    ) as IGetBusinessTripsOtherExpensesByIdsResult[];
  },
);

/**
 * UPDATE business_trips_transactions_other
 * SET deductible_expense = COALESCE($deductibleExpense, deductible_expense),
 *   description = COALESCE($description, description)
 * WHERE id = $businessTripExpenseId
 * RETURNING *
 */
export const updateBusinessTripOtherExpense = port<IUpdateBusinessTripOtherExpenseQuery>(
  async ({ businessTripExpenseId, deductibleExpense, description }, db) => {
    if (businessTripExpenseId == null) return [];
    const result = [];
    for (const row of await db.where('business_trips_transactions_other', {
      id: businessTripExpenseId,
    })) {
      result.push(
        await db.update(
          'business_trips_transactions_other',
          row,
          coalescePatch({ deductible_expense: deductibleExpense, description }) as never,
        ),
      );
    }
    return result;
  },
);

/**
 * INSERT INTO business_trips_transactions_other (id, deductible_expense, description, owner_id)
 * VALUES ($id, $deductibleExpense, $description, $ownerId)
 * RETURNING *
 */
export const insertBusinessTripOtherExpense = port<IInsertBusinessTripOtherExpenseQuery>(
  async ({ id, deductibleExpense, description, ownerId }, db) => {
    const row = await db.insert('business_trips_transactions_other', {
      id: id ?? null,
      deductible_expense: deductibleExpense ?? null,
      description: description ?? null,
      owner_id: ownerId ?? null,
    } as never);
    return row ? [row] : [];
  },
);

/** DELETE FROM business_trips_transactions_other WHERE id = $businessTripExpenseId RETURNING id */
export const deleteBusinessTripOtherExpense = port<IDeleteBusinessTripOtherExpenseQuery>(
  async ({ businessTripExpenseId }, db) => {
    if (businessTripExpenseId == null) return [];
    const result = [];
    for (const row of await db.where('business_trips_transactions_other', {
      id: businessTripExpenseId,
    })) {
      result.push({ id: (await db.delete('business_trips_transactions_other', row)).id });
    }
    return result;
  },
);
