import type {
  IDeleteBusinessTripFlightsExpenseQuery,
  IGetBusinessTripsFlightsExpensesByBusinessTripIdsQuery,
  IGetBusinessTripsFlightsExpensesByBusinessTripIdsResult,
  IGetBusinessTripsFlightsExpensesByIdsQuery,
  IGetBusinessTripsFlightsExpensesByIdsResult,
  IInsertBusinessTripFlightsExpenseQuery,
  IUpdateBusinessTripFlightsExpenseQuery,
} from '../../../../../modules/business-trips/__generated__/business-trips-expenses-flights.types.js';
import { coalescePatch, inList } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';
import { withExtended } from '../_helpers.js';

/**
 * SELECT * FROM business_trips_transactions_flights f
 * LEFT JOIN extended_business_trip_transactions t USING (id)
 * WHERE t.business_trip_id IN $$businessTripIds
 */
export const getBusinessTripsFlightsExpensesByBusinessTripIds =
  port<IGetBusinessTripsFlightsExpensesByBusinessTripIdsQuery>(async ({ businessTripIds }, db) => {
    const inTrips = inList(businessTripIds);
    const rows = await withExtended(db, await db.rows('business_trips_transactions_flights'));
    return rows.filter(row =>
      inTrips(row.business_trip_id),
    ) as IGetBusinessTripsFlightsExpensesByBusinessTripIdsResult[];
  });

/**
 * SELECT * FROM business_trips_transactions_flights f
 * LEFT JOIN extended_business_trip_transactions t USING (id)
 * WHERE t.id IN $$expenseIds
 *
 * `t.id` is the view's id: NULL (never matching) for a flight without an expense row.
 */
export const getBusinessTripsFlightsExpensesByIds =
  port<IGetBusinessTripsFlightsExpensesByIdsQuery>(async ({ expenseIds }, db) => {
    const rows = await withExtended(
      db,
      await db.whereIn('business_trips_transactions_flights', 'id', expenseIds),
    );
    return rows.filter(
      row => row.business_trip_id != null,
    ) as IGetBusinessTripsFlightsExpensesByIdsResult[];
  });

/**
 * UPDATE business_trips_transactions_flights
 * SET path = COALESCE($path, path), class = COALESCE($class, class),
 *   attendees = COALESCE($attendeeIds, attendees)
 * WHERE id = $businessTripExpenseId
 * RETURNING *
 */
export const updateBusinessTripFlightsExpense = port<IUpdateBusinessTripFlightsExpenseQuery>(
  async ({ businessTripExpenseId, path, class: flightClass, attendeeIds }, db) => {
    if (businessTripExpenseId == null) return [];
    const result = [];
    for (const row of await db.where('business_trips_transactions_flights', {
      id: businessTripExpenseId,
    })) {
      result.push(
        await db.update(
          'business_trips_transactions_flights',
          row,
          coalescePatch({ path, class: flightClass, attendees: attendeeIds }) as never,
        ),
      );
    }
    return result;
  },
);

/**
 * INSERT INTO business_trips_transactions_flights (id, path, class, attendees, owner_id)
 * VALUES ($id, $path, $class, $attendeeIds, $ownerId)
 * RETURNING *
 */
export const insertBusinessTripFlightsExpense = port<IInsertBusinessTripFlightsExpenseQuery>(
  async ({ id, path, class: flightClass, attendeeIds, ownerId }, db) => {
    const row = await db.insert('business_trips_transactions_flights', {
      id: id ?? null,
      path: path ?? null,
      class: flightClass ?? null,
      attendees: attendeeIds ?? null,
      owner_id: ownerId ?? null,
    } as never);
    return row ? [row] : [];
  },
);

/** DELETE FROM business_trips_transactions_flights WHERE id = $businessTripExpenseId RETURNING id */
export const deleteBusinessTripFlightsExpense = port<IDeleteBusinessTripFlightsExpenseQuery>(
  async ({ businessTripExpenseId }, db) => {
    if (businessTripExpenseId == null) return [];
    const result = [];
    for (const row of await db.where('business_trips_transactions_flights', {
      id: businessTripExpenseId,
    })) {
      result.push({ id: (await db.delete('business_trips_transactions_flights', row)).id });
    }
    return result;
  },
);
