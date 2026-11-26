import type {
  IAddBusinessTripAttendeesQuery,
  IAddBusinessTripAttendeesResult,
  IGetBusinessTripsAttendeesByBusinessTripIdsQuery,
  IGetBusinessTripsAttendeesByBusinessTripIdsResult,
  IGetBusinessTripsByAttendeeIdQuery,
  IGetBusinessTripsByAttendeeIdResult,
  IGetLastFlightByDateAndAttendeeIdQuery,
  IGetLastFlightByDateAndAttendeeIdResult,
  IRemoveBusinessTripAttendeesQuery,
  IRemoveBusinessTripAttendeesResult,
  IUpdateBusinessTripAttendeeQuery,
  IUpdateBusinessTripAttendeeResult,
} from '../../../../../modules/business-trips/__generated__/business-trips-attendees.types.js';
import {
  addToDate,
  coalescePatch,
  distinctRows,
  orderBy,
  toDateString,
} from '../../../../sql-helpers.js';
import { port } from '../../../port.js';
import { leftJoined } from '../_helpers.js';

/** The businesses columns the attendees query selects (`b.vat_number, ..., b.zip_code`). */
const BUSINESS_COLUMNS = [
  'vat_number',
  'hebrew_name',
  'address',
  'address_hebrew',
  'email',
  'website',
  'phone_number',
  'country',
  'no_invoices_required',
  'suggestion_data',
  'can_settle_with_receipt',
  'exempt_dealer',
  'optional_vat',
  'pcn874_record_type_override',
  'city',
  'zip_code',
] as const;

/**
 * SELECT bta.business_trip_id, bta.arrival, bta.departure, fe.*, b.vat_number, b.hebrew_name, b.address,
 *   b.address_hebrew, b.email, b.website, b.phone_number, b.country, b.no_invoices_required, b.suggestion_data,
 *   b.can_settle_with_receipt, b.exempt_dealer, b.optional_vat, b.pcn874_record_type_override, b.city, b.zip_code
 * FROM financial_entities fe
 * LEFT JOIN business_trips_attendees bta ON bta.attendee_business_id = fe.id
 * LEFT JOIN businesses b ON bta.attendee_business_id = b.id
 * WHERE bta.business_trip_id IN $$businessTripIds
 *
 * The WHERE clause drops the entities without an attendee row, so this is an inner join on bta.
 */
export const getBusinessTripsAttendeesByBusinessTripIds =
  port<IGetBusinessTripsAttendeesByBusinessTripIdsQuery>(async ({ businessTripIds }, db) => {
    const attendees = await db.whereIn('business_trips_attendees', 'business_trip_id', businessTripIds);
    const attendeeIds = attendees.map(a => a.attendee_business_id);
    const entities = new Map(
      (await db.whereIn('financial_entities', 'id', attendeeIds)).map(fe => [fe.id, fe]),
    );
    const businesses = new Map(
      (await db.whereIn('businesses', 'id', attendeeIds)).map(b => [b.id, b]),
    );
    const result: IGetBusinessTripsAttendeesByBusinessTripIdsResult[] = [];
    for (const bta of attendees) {
      const fe = entities.get(bta.attendee_business_id);
      if (!fe) continue;
      const b = businesses.get(bta.attendee_business_id) ?? null;
      const businessColumns = Object.fromEntries(
        BUSINESS_COLUMNS.map(column => [column, b ? b[column] : null]),
      );
      result.push({
        business_trip_id: bta.business_trip_id,
        arrival: bta.arrival,
        departure: bta.departure,
        ...leftJoined('financial_entities', fe),
        ...businessColumns,
      } as IGetBusinessTripsAttendeesByBusinessTripIdsResult);
    }
    return result;
  });

/**
 * SELECT DISTINCT bt.*
 * FROM business_trips_attendees bta LEFT JOIN business_trips bt ON bt.id = bta.business_trip_id
 * WHERE bta.attendee_business_id = $attendeeId
 */
export const getBusinessTripsByAttendeeId = port<IGetBusinessTripsByAttendeeIdQuery>(
  async ({ attendeeId }, db) => {
    if (attendeeId == null) return [];
    const attendees = await db.where('business_trips_attendees', {
      attendee_business_id: attendeeId,
    });
    const trips = new Map(
      (
        await db.whereIn(
          'business_trips',
          'id',
          attendees.map(a => a.business_trip_id),
        )
      ).map(trip => [trip.id, trip]),
    );
    return distinctRows(
      attendees.map(
        a =>
          leftJoined('business_trips', trips.get(a.business_trip_id)) as unknown as Record<
            string,
            unknown
          >,
      ),
    ) as unknown as IGetBusinessTripsByAttendeeIdResult[];
  },
);

/**
 * SELECT * FROM business_trips_attendees
 * WHERE attendee_business_id = $attendeeBusinessId
 *   AND arrival < $date AND departure <= $date AND departure >= $date - INTERVAL '14 DAY'
 * ORDER BY departure DESC
 * FETCH FIRST 1 ROWS ONLY
 *
 * `$date` is a date (from `arrival < $date`); `date - interval` is a timestamp at midnight, so the
 * last condition is `departure >= $date - 14 days`, inclusive.
 */
export const getLastFlightByDateAndAttendeeId = port<IGetLastFlightByDateAndAttendeeIdQuery>(
  async ({ attendeeBusinessId, date }, db) => {
    if (attendeeBusinessId == null || date == null) return [];
    const day = toDateString(date);
    const earliest = addToDate(day, -14, 'day');
    const rows = (
      await db.where('business_trips_attendees', { attendee_business_id: attendeeBusinessId })
    ).filter(
      a =>
        a.arrival != null &&
        a.departure != null &&
        a.arrival < day &&
        a.departure <= day &&
        a.departure >= earliest,
    );
    return orderBy(rows, [{ value: a => a.departure, desc: true, kind: 'date' }]).slice(
      0,
      1,
    ) as IGetLastFlightByDateAndAttendeeIdResult[];
  },
);

/**
 * INSERT INTO business_trips_attendees (business_trip_id, attendee_business_id, arrival, departure, owner_id)
 * VALUES ($businessTripId, $businessId, $arrival, $departure, $ownerId)
 * ON CONFLICT DO NOTHING
 * RETURNING *
 */
export const addBusinessTripAttendees = port<IAddBusinessTripAttendeesQuery>(
  async ({ businessTripId, businessId, arrival, departure, ownerId }, db) => {
    const row = await db.insert(
      'business_trips_attendees',
      {
        business_trip_id: businessTripId ?? null,
        attendee_business_id: businessId ?? null,
        arrival: arrival ?? null,
        departure: departure ?? null,
        owner_id: ownerId ?? null,
      } as never,
      { action: 'nothing' },
    );
    return row ? [row as IAddBusinessTripAttendeesResult] : [];
  },
);

/**
 * UPDATE business_trips_attendees
 * SET arrival = COALESCE($arrival, arrival), departure = COALESCE($departure, departure)
 * WHERE business_trip_id = $businessTripId AND attendee_business_id = $attendeeBusinessId
 * RETURNING *
 */
export const updateBusinessTripAttendee = port<IUpdateBusinessTripAttendeeQuery>(
  async ({ businessTripId, attendeeBusinessId, arrival, departure }, db) => {
    if (businessTripId == null || attendeeBusinessId == null) return [];
    const result: IUpdateBusinessTripAttendeeResult[] = [];
    for (const row of await db.where('business_trips_attendees', {
      business_trip_id: businessTripId,
      attendee_business_id: attendeeBusinessId,
    })) {
      const updated = await db.update(
        'business_trips_attendees',
        row,
        coalescePatch({ arrival, departure }) as never,
      );
      result.push(updated as IUpdateBusinessTripAttendeeResult);
    }
    return result;
  },
);

/**
 * DELETE FROM business_trips_attendees
 * WHERE business_trip_id = $businessTripId AND attendee_business_id = $businessId
 * RETURNING *
 */
export const removeBusinessTripAttendees = port<IRemoveBusinessTripAttendeesQuery>(
  async ({ businessTripId, businessId }, db) => {
    if (businessTripId == null || businessId == null) return [];
    const result: IRemoveBusinessTripAttendeesResult[] = [];
    for (const row of await db.where('business_trips_attendees', {
      business_trip_id: businessTripId,
      attendee_business_id: businessId,
    })) {
      result.push((await db.delete('business_trips_attendees', row)) as IRemoveBusinessTripAttendeesResult);
    }
    return result;
  },
);
