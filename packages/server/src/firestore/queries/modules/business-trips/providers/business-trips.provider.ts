import type {
  IDeleteChargeBusinessTripQuery,
  IGetAllBusinessTripsQuery,
  IGetBusinessTripsByChargeIdsQuery,
  IGetBusinessTripsByChargeIdsResult,
  IGetBusinessTripsByDatesQuery,
  IGetBusinessTripsByDatesResult,
  IGetBusinessTripsByIdsQuery,
  IGetChargeIdsByBusinessTripIdQuery,
  IInsertBusinessTripQuery,
  IUpdateAccountantApprovalQuery,
  IUpdateBusinessTripQuery,
  IUpdateChargeBusinessTripQuery,
} from '../../../../../modules/business-trips/__generated__/business-trips.types.js';
import { coalescePatch, groupBy, maxOf, minOf, toDateString } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';
import { leftJoined } from '../_helpers.js';

/** SELECT * FROM business_trips */
export const getAllBusinessTrips = port<IGetAllBusinessTripsQuery>(async (_params, db) =>
  db.rows('business_trips'),
);

/** SELECT * FROM business_trips WHERE id IN $$businessTripsIds */
export const getBusinessTripsByIds = port<IGetBusinessTripsByIdsQuery>(
  async ({ businessTripsIds }, db) => db.whereIn('business_trips', 'id', businessTripsIds),
);

/**
 * SELECT btc.charge_id, bt.*
 * FROM business_trip_charges btc LEFT JOIN business_trips bt ON btc.business_trip_id = bt.id
 * WHERE btc.charge_id IN $$chargeIds
 */
export const getBusinessTripsByChargeIds = port<IGetBusinessTripsByChargeIdsQuery>(
  async ({ chargeIds }, db) => {
    const links = await db.whereIn('business_trip_charges', 'charge_id', chargeIds);
    const trips = await db.whereIn(
      'business_trips',
      'id',
      links.map(link => link.business_trip_id),
    );
    const tripById = new Map(trips.map(trip => [trip.id, trip]));
    return links.map(
      link =>
        ({
          charge_id: link.charge_id,
          ...leftJoined(
            'business_trips',
            link.business_trip_id == null ? null : tripById.get(link.business_trip_id),
          ),
        }) as IGetBusinessTripsByChargeIdsResult,
    );
  },
);

/** SELECT charge_id, business_trip_id FROM business_trip_charges WHERE business_trip_id IN $$businessTripsIds */
export const getChargeIdsByBusinessTripId = port<IGetChargeIdsByBusinessTripIdQuery>(
  async ({ businessTripsIds }, db) =>
    (await db.whereIn('business_trip_charges', 'business_trip_id', businessTripsIds)).map(
      ({ charge_id, business_trip_id }) => ({ charge_id, business_trip_id }),
    ),
);

/**
 * WITH business_trips_dates AS (
 *   SELECT business_trip_id AS id, min(arrival) AS from_date, max(departure) AS to_date
 *   FROM business_trips_attendees GROUP BY business_trip_id)
 * SELECT DISTINCT ON (bt.id) bt.*, btc.charge_id, business_trips_dates.from_date, business_trips_dates.to_date
 * FROM business_trips bt
 * LEFT JOIN business_trip_charges btc ON bt.id = btc.business_trip_id
 * LEFT JOIN business_trips_dates ON business_trips_dates.id = bt.id
 * WHERE business_trips_dates.from_date >= $fromDate AND business_trips_dates.to_date < $toDate
 *
 * DISTINCT ON without ORDER BY: for a trip with several charges, Postgres keeps an arbitrary one.
 * The port keeps the lowest charge id, which is one of the rows Postgres may return.
 */
export const getBusinessTripsByDates = port<IGetBusinessTripsByDatesQuery>(
  async ({ fromDate, toDate }, db) => {
    if (fromDate == null || toDate == null) return [];
    const from = toDateString(fromDate);
    const to = toDateString(toDate);
    const attendees = groupBy(await db.rows('business_trips_attendees'), a => a.business_trip_id);
    const links = groupBy(await db.rows('business_trip_charges'), l => l.business_trip_id);
    const result: IGetBusinessTripsByDatesResult[] = [];
    for (const trip of await db.rows('business_trips')) {
      const group = attendees.get(trip.id);
      if (!group) continue;
      const fromDateOfTrip = minOf(
        group.map(a => a.arrival),
        'date',
      );
      const toDateOfTrip = maxOf(
        group.map(a => a.departure),
        'date',
      );
      if (fromDateOfTrip == null || toDateOfTrip == null) continue;
      if (!(fromDateOfTrip >= from && toDateOfTrip < to)) continue;
      const chargeIds = (links.get(trip.id) ?? []).map(l => l.charge_id).sort();
      result.push({
        ...trip,
        // NULL for a trip without charges (LEFT JOIN), though pgTyped types it as a string
        charge_id: (chargeIds[0] ?? null) as string,
        from_date: fromDateOfTrip as IGetBusinessTripsByDatesResult['from_date'],
        to_date: toDateOfTrip as IGetBusinessTripsByDatesResult['to_date'],
      });
    }
    return result;
  },
);

/**
 * INSERT INTO business_trip_charges (charge_id, business_trip_id, owner_id)
 * VALUES ($chargeId, $businessTripId, $ownerId)
 * ON CONFLICT (charge_id) DO UPDATE SET business_trip_id = $businessTripId
 * RETURNING *
 */
export const updateChargeBusinessTrip = port<IUpdateChargeBusinessTripQuery>(
  async ({ chargeId, businessTripId, ownerId }, db) => {
    const row = await db.insert(
      'business_trip_charges',
      {
        charge_id: chargeId ?? null,
        business_trip_id: businessTripId ?? null,
        owner_id: ownerId ?? null,
      } as never,
      { target: ['charge_id'], action: () => ({ business_trip_id: businessTripId ?? null }) },
    );
    return row ? [row] : [];
  },
);

/** DELETE FROM business_trip_charges WHERE charge_id = $chargeId */
export const deleteChargeBusinessTrip = port<IDeleteChargeBusinessTripQuery>(
  async ({ chargeId }, db) => {
    if (chargeId == null) return [];
    for (const row of await db.where('business_trip_charges', { charge_id: chargeId })) {
      await db.delete('business_trip_charges', row);
    }
    return [];
  },
);

/**
 * UPDATE business_trips SET name = COALESCE($name, name), destination = COALESCE($destinationCode, destination),
 *   trip_purpose = COALESCE($tripPurpose, trip_purpose), accountant_status = COALESCE($accountantStatus, accountant_status)
 * WHERE id = $businessTripId
 * RETURNING id
 */
export const updateBusinessTrip = port<IUpdateBusinessTripQuery>(
  async ({ businessTripId, name, destinationCode, tripPurpose, accountantStatus }, db) => {
    if (businessTripId == null) return [];
    const result = [];
    for (const trip of await db.where('business_trips', { id: businessTripId })) {
      const updated = await db.update(
        'business_trips',
        trip,
        coalescePatch({
          name,
          destination: destinationCode,
          trip_purpose: tripPurpose,
          accountant_status: accountantStatus,
        }) as never,
      );
      result.push({ id: updated.id });
    }
    return result;
  },
);

/**
 * INSERT INTO business_trips (name, destination, trip_purpose, owner_id)
 * VALUES ($name, $destinationCode, $tripPurpose, $ownerId)
 * RETURNING id
 */
export const insertBusinessTrip = port<IInsertBusinessTripQuery>(
  async ({ name, destinationCode, tripPurpose, ownerId }, db) => {
    const row = await db.insert('business_trips', {
      name: name ?? null,
      destination: destinationCode ?? null,
      trip_purpose: tripPurpose ?? null,
      owner_id: ownerId ?? null,
    } as never);
    return row ? [{ id: row.id }] : [];
  },
);

/**
 * UPDATE business_trips SET accountant_status = $accountantStatus WHERE id = $businessTripId
 * RETURNING *
 */
export const updateAccountantApproval = port<IUpdateAccountantApprovalQuery>(
  async ({ businessTripId, accountantStatus }, db) => {
    if (businessTripId == null) return [];
    const result = [];
    for (const trip of await db.where('business_trips', { id: businessTripId })) {
      result.push(
        await db.update('business_trips', trip, {
          accountant_status: (accountantStatus ?? null) as never,
        }),
      );
    }
    return result;
  },
);
