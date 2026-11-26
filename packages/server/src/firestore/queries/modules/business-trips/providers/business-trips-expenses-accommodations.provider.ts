import type {
  IDeleteBusinessTripAccommodationsExpenseQuery,
  IGetBusinessTripsAccommodationsExpensesByBusinessTripIdsQuery,
  IGetBusinessTripsAccommodationsExpensesByBusinessTripIdsResult,
  IGetBusinessTripsAccommodationsExpensesByIdsQuery,
  IGetBusinessTripsAccommodationsExpensesByIdsResult,
  IInsertBusinessTripAccommodationsExpenseQuery,
  IUpdateBusinessTripAccommodationsExpenseQuery,
} from '../../../../../modules/business-trips/__generated__/business-trips-expenses-accommodations.types.js';
import { coalescePatch, inList } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';
import { withExtended } from '../_helpers.js';

/**
 * SELECT * FROM business_trips_transactions_accommodations a
 * LEFT JOIN extended_business_trip_transactions t USING (id)
 * WHERE t.business_trip_id IN $$businessTripIds
 */
export const getBusinessTripsAccommodationsExpensesByBusinessTripIds =
  port<IGetBusinessTripsAccommodationsExpensesByBusinessTripIdsQuery>(
    async ({ businessTripIds }, db) => {
      const inTrips = inList(businessTripIds);
      const rows = await withExtended(
        db,
        await db.rows('business_trips_transactions_accommodations'),
      );
      return rows.filter(
        row => inTrips(row.business_trip_id),
      ) as IGetBusinessTripsAccommodationsExpensesByBusinessTripIdsResult[];
    },
  );

/**
 * SELECT * FROM business_trips_transactions_accommodations a
 * LEFT JOIN extended_business_trip_transactions t USING (id)
 * WHERE a.id IN $$expenseIds
 */
export const getBusinessTripsAccommodationsExpensesByIds =
  port<IGetBusinessTripsAccommodationsExpensesByIdsQuery>(async ({ expenseIds }, db) =>
    (await withExtended(
      db,
      await db.whereIn('business_trips_transactions_accommodations', 'id', expenseIds),
    )) as IGetBusinessTripsAccommodationsExpensesByIdsResult[],
  );

/**
 * UPDATE business_trips_transactions_accommodations
 * SET country = COALESCE($country, country), nights_count = COALESCE($nightsCount, nights_count),
 *   attendees_stay = COALESCE($attendeesStay, attendees_stay)
 * WHERE id = $businessTripExpenseId
 * RETURNING *
 */
export const updateBusinessTripAccommodationsExpense =
  port<IUpdateBusinessTripAccommodationsExpenseQuery>(
    async ({ businessTripExpenseId, country, nightsCount, attendeesStay }, db) => {
      if (businessTripExpenseId == null) return [];
      const result = [];
      for (const row of await db.where('business_trips_transactions_accommodations', {
        id: businessTripExpenseId,
      })) {
        result.push(
          await db.update(
            'business_trips_transactions_accommodations',
            row,
            coalescePatch({
              country,
              nights_count: nightsCount,
              attendees_stay: attendeesStay,
            }) as never,
          ),
        );
      }
      return result;
    },
  );

/**
 * INSERT INTO business_trips_transactions_accommodations (id, country, nights_count, attendees_stay, owner_id)
 * VALUES ($id, $country, $nightsCount, $attendeesStay, $ownerId)
 * RETURNING *
 */
export const insertBusinessTripAccommodationsExpense =
  port<IInsertBusinessTripAccommodationsExpenseQuery>(
    async ({ id, country, nightsCount, attendeesStay, ownerId }, db) => {
      const row = await db.insert('business_trips_transactions_accommodations', {
        id: id ?? null,
        country: country ?? null,
        nights_count: nightsCount ?? null,
        attendees_stay: attendeesStay ?? null,
        owner_id: ownerId ?? null,
      } as never);
      return row ? [row] : [];
    },
  );

/** DELETE FROM business_trips_transactions_accommodations WHERE id = $businessTripExpenseId RETURNING id */
export const deleteBusinessTripAccommodationsExpense =
  port<IDeleteBusinessTripAccommodationsExpenseQuery>(async ({ businessTripExpenseId }, db) => {
    if (businessTripExpenseId == null) return [];
    const result = [];
    for (const row of await db.where('business_trips_transactions_accommodations', {
      id: businessTripExpenseId,
    })) {
      result.push({ id: (await db.delete('business_trips_transactions_accommodations', row)).id });
    }
    return result;
  });
