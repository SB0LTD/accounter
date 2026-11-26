import type {
  IDeleteBusinessTripCarRentalExpenseQuery,
  IGetBusinessTripsCarRentalExpensesByBusinessTripIdsQuery,
  IGetBusinessTripsCarRentalExpensesByBusinessTripIdsResult,
  IGetBusinessTripsCarRentalExpensesByIdsQuery,
  IGetBusinessTripsCarRentalExpensesByIdsResult,
  IInsertBusinessTripCarRentalExpenseQuery,
  IUpdateBusinessTripCarRentalExpenseQuery,
} from '../../../../../modules/business-trips/__generated__/business-trips-expenses-car-rental.types.js';
import { coalescePatch, inList } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';
import { equalsZero, orTrue, withExtended } from '../_helpers.js';

/**
 * SELECT * FROM business_trips_transactions_car_rental a
 * LEFT JOIN extended_business_trip_transactions t USING (id)
 * WHERE ($isBusinessTripIds = 0 OR t.business_trip_id IN $$businessTripIds)
 */
export const getBusinessTripsCarRentalExpensesByBusinessTripIds =
  port<IGetBusinessTripsCarRentalExpensesByBusinessTripIdsQuery>(
    async ({ isBusinessTripIds, businessTripIds }, db) => {
      const all = equalsZero(isBusinessTripIds);
      const inTrips = inList(businessTripIds);
      const rows = await withExtended(db, await db.rows('business_trips_transactions_car_rental'));
      return rows.filter(row =>
        orTrue(all, inTrips(row.business_trip_id)),
      ) as IGetBusinessTripsCarRentalExpensesByBusinessTripIdsResult[];
    },
  );

/**
 * SELECT * FROM business_trips_transactions_car_rental a
 * LEFT JOIN extended_business_trip_transactions t USING (id)
 * WHERE ($isIds = 0 OR t.id IN $$expenseIds)
 *
 * `t.id` is the view's id: NULL for a car rental without an expense row.
 */
export const getBusinessTripsCarRentalExpensesByIds =
  port<IGetBusinessTripsCarRentalExpensesByIdsQuery>(async ({ isIds, expenseIds }, db) => {
    const all = equalsZero(isIds);
    const inIds = inList(expenseIds);
    const rows = await withExtended(db, await db.rows('business_trips_transactions_car_rental'));
    return rows.filter(row =>
      orTrue(all, row.business_trip_id != null && inIds(row.id)),
    ) as IGetBusinessTripsCarRentalExpensesByIdsResult[];
  });

/**
 * UPDATE business_trips_transactions_car_rental
 * SET days = COALESCE($days, days), is_fuel_expense = COALESCE($isFuelExpense, is_fuel_expense)
 * WHERE id = $businessTripExpenseId
 * RETURNING *
 */
export const updateBusinessTripCarRentalExpense = port<IUpdateBusinessTripCarRentalExpenseQuery>(
  async ({ businessTripExpenseId, days, isFuelExpense }, db) => {
    if (businessTripExpenseId == null) return [];
    const result = [];
    for (const row of await db.where('business_trips_transactions_car_rental', {
      id: businessTripExpenseId,
    })) {
      result.push(
        await db.update(
          'business_trips_transactions_car_rental',
          row,
          coalescePatch({ days, is_fuel_expense: isFuelExpense }) as never,
        ),
      );
    }
    return result;
  },
);

/**
 * INSERT INTO business_trips_transactions_car_rental (id, days, is_fuel_expense, owner_id)
 * VALUES ($id, $days, $isFuelExpense, $ownerId)
 * RETURNING *
 */
export const insertBusinessTripCarRentalExpense = port<IInsertBusinessTripCarRentalExpenseQuery>(
  async ({ id, days, isFuelExpense, ownerId }, db) => {
    const row = await db.insert('business_trips_transactions_car_rental', {
      id: id ?? null,
      days: days ?? null,
      is_fuel_expense: isFuelExpense ?? null,
      owner_id: ownerId ?? null,
    } as never);
    return row ? [row] : [];
  },
);

/** DELETE FROM business_trips_transactions_car_rental WHERE id = $businessTripExpenseId RETURNING id */
export const deleteBusinessTripCarRentalExpense = port<IDeleteBusinessTripCarRentalExpenseQuery>(
  async ({ businessTripExpenseId }, db) => {
    if (businessTripExpenseId == null) return [];
    const result = [];
    for (const row of await db.where('business_trips_transactions_car_rental', {
      id: businessTripExpenseId,
    })) {
      result.push({ id: (await db.delete('business_trips_transactions_car_rental', row)).id });
    }
    return result;
  },
);
