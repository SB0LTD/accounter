import type {
  IDeleteBusinessTripExpenseQuery,
  IGetBusinessTripsExpensesByBusinessTripIdsQuery,
  IGetBusinessTripsExpensesByIdsQuery,
  IInsertBusinessTripExpenseQuery,
  IUpdateBusinessTripExpenseQuery,
} from '../../../../../modules/business-trips/__generated__/business-trips-expenses.types.js';
import { coalescePatch, inList } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';
import { extendedExpenses } from '../_helpers.js';

/** SELECT * FROM extended_business_trip_transactions WHERE business_trip_id IN $$businessTripIds */
export const getBusinessTripsExpensesByBusinessTripIds =
  port<IGetBusinessTripsExpensesByBusinessTripIdsQuery>(async ({ businessTripIds }, db) => {
    const inTrips = inList(businessTripIds);
    return (await extendedExpenses(db)).filter(t => inTrips(t.business_trip_id));
  });

/** SELECT * FROM extended_business_trip_transactions WHERE id IN $$expenseIds */
export const getBusinessTripsExpensesByIds = port<IGetBusinessTripsExpensesByIdsQuery>(
  async ({ expenseIds }, db) => {
    const inIds = inList(expenseIds);
    return (await extendedExpenses(db)).filter(t => inIds(t.id));
  },
);

/**
 * UPDATE business_trips_transactions
 * SET business_trip_id = COALESCE($businessTripId, business_trip_id), category = COALESCE($category, category)
 * WHERE id = $businessTripExpenseId
 * RETURNING *
 */
export const updateBusinessTripExpense = port<IUpdateBusinessTripExpenseQuery>(
  async ({ businessTripExpenseId, businessTripId, category }, db) => {
    if (businessTripExpenseId == null) return [];
    const result = [];
    for (const row of await db.where('business_trips_transactions', {
      id: businessTripExpenseId,
    })) {
      result.push(
        await db.update(
          'business_trips_transactions',
          row,
          coalescePatch({ business_trip_id: businessTripId, category }) as never,
        ),
      );
    }
    return result;
  },
);

/**
 * INSERT INTO business_trips_transactions (business_trip_id, category, owner_id)
 * VALUES ($businessTripId, $category, $ownerId)
 * RETURNING *
 */
export const insertBusinessTripExpense = port<IInsertBusinessTripExpenseQuery>(
  async ({ businessTripId, category, ownerId }, db) => {
    const row = await db.insert('business_trips_transactions', {
      business_trip_id: businessTripId ?? null,
      category: category ?? null,
      owner_id: ownerId ?? null,
    } as never);
    return row ? [row] : [];
  },
);

/**
 * DELETE FROM business_trips_transactions WHERE id = $businessTripExpenseId RETURNING id
 *
 * Employee payments, accommodations, flights, others and matches reference the row (NO ACTION):
 * deleting an expense that still has one raises 23503.
 */
export const deleteBusinessTripExpense = port<IDeleteBusinessTripExpenseQuery>(
  async ({ businessTripExpenseId }, db) => {
    if (businessTripExpenseId == null) return [];
    const result = [];
    for (const row of await db.where('business_trips_transactions', {
      id: businessTripExpenseId,
    })) {
      result.push({ id: (await db.delete('business_trips_transactions', row)).id });
    }
    return result;
  },
);
