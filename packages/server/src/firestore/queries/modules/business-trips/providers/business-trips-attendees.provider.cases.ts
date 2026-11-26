import type {
  IAddBusinessTripAttendeesQuery,
  IGetBusinessTripsAttendeesByBusinessTripIdsQuery,
  IGetBusinessTripsByAttendeeIdQuery,
  IGetLastFlightByDateAndAttendeeIdQuery,
  IRemoveBusinessTripAttendeesQuery,
  IUpdateBusinessTripAttendeeQuery,
} from '../../../../../modules/business-trips/__generated__/business-trips-attendees.types.js';
import { caseFor, type Cases } from '../../../cases.js';
import { EMPLOYEE, TRIP } from '../_fixture-ids.js';

export const cases: Cases = {
  getBusinessTripsAttendeesByBusinessTripIds: caseFor<IGetBusinessTripsAttendeesByBusinessTripIdsQuery>(
    s => [
      { businessTripIds: [TRIP.berlin, TRIP.paris, TRIP.empty] },
      { businessTripIds: s.ids('business_trips', 10) },
      { businessTripIds: [s.missingId, null] },
    ],
  ),
  getBusinessTripsByAttendeeId: caseFor<IGetBusinessTripsByAttendeeIdQuery>(s => [
    { attendeeId: EMPLOYEE.dana },
    { attendeeId: EMPLOYEE.omer },
    { attendeeId: s.businessId },
    { attendeeId: null },
  ]),
  getLastFlightByDateAndAttendeeId: caseFor<IGetLastFlightByDateAndAttendeeIdQuery>(() => [
    // Dana: Berlin (03-10..03-15), New York (05-01..05-08), Paris (no dates)
    { attendeeBusinessId: EMPLOYEE.dana, date: '2024-03-20' },
    { attendeeBusinessId: EMPLOYEE.dana, date: '2024-05-10' },
    // the 14-day window is inclusive: 03-29 - 14 days = 03-15
    { attendeeBusinessId: EMPLOYEE.dana, date: '2024-03-29' },
    { attendeeBusinessId: EMPLOYEE.dana, date: '2024-03-30' },
    // departure <= date (inclusive), arrival < date
    { attendeeBusinessId: EMPLOYEE.dana, date: '2024-03-15' },
    { attendeeBusinessId: EMPLOYEE.dana, date: '2024-03-10' },
    // Omer: Berlin (03-11..03-14), Paris (no departure), London (09-01..09-05)
    { attendeeBusinessId: EMPLOYEE.omer, date: '2024-09-10' },
    { attendeeBusinessId: EMPLOYEE.omer, date: '2024-03-14' },
    { attendeeBusinessId: EMPLOYEE.dana, date: null },
    { attendeeBusinessId: null, date: '2024-03-20' },
  ]),
  addBusinessTripAttendees: caseFor<IAddBusinessTripAttendeesQuery>(s => [
    {
      businessTripId: TRIP.empty,
      businessId: EMPLOYEE.dana,
      arrival: '2024-10-01',
      departure: '2024-10-04',
      ownerId: s.businessId,
    },
    {
      businessTripId: TRIP.newYork,
      businessId: EMPLOYEE.omer,
      arrival: null,
      departure: null,
      ownerId: s.businessId,
    },
    // already attending: DO NOTHING, no row returned
    {
      businessTripId: TRIP.berlin,
      businessId: EMPLOYEE.dana,
      arrival: '2025-01-01',
      departure: '2025-01-02',
      ownerId: s.businessId,
    },
    // unknown trip / business: foreign key
    {
      businessTripId: s.missingId,
      businessId: EMPLOYEE.dana,
      arrival: null,
      departure: null,
      ownerId: s.businessId,
    },
    {
      businessTripId: TRIP.empty,
      businessId: s.missingId,
      arrival: null,
      departure: null,
      ownerId: s.businessId,
    },
    // NOT NULL trip
    {
      businessTripId: null,
      businessId: EMPLOYEE.dana,
      arrival: null,
      departure: null,
      ownerId: s.businessId,
    },
  ]),
  updateBusinessTripAttendee: caseFor<IUpdateBusinessTripAttendeeQuery>(s => [
    {
      businessTripId: TRIP.berlin,
      attendeeBusinessId: EMPLOYEE.dana,
      arrival: '2024-03-09',
      departure: '2024-03-16',
    },
    // COALESCE keeps the old values
    { businessTripId: TRIP.berlin, attendeeBusinessId: EMPLOYEE.omer, arrival: '2024-03-12' },
    { businessTripId: TRIP.paris, attendeeBusinessId: EMPLOYEE.dana, departure: '2024-07-05' },
    { businessTripId: TRIP.berlin, attendeeBusinessId: s.missingId, arrival: '2024-03-12' },
    { businessTripId: null, attendeeBusinessId: EMPLOYEE.dana, arrival: '2024-03-12' },
  ]),
  removeBusinessTripAttendees: caseFor<IRemoveBusinessTripAttendeesQuery>(s => [
    { businessTripId: TRIP.berlin, businessId: EMPLOYEE.omer },
    { businessTripId: TRIP.empty, businessId: EMPLOYEE.omer },
    { businessTripId: TRIP.berlin, businessId: s.missingId },
    { businessTripId: TRIP.berlin, businessId: null },
  ]),
};
