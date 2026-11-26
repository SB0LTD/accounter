import type {
  IDeleteChargeBusinessTripQuery,
  IGetBusinessTripsByChargeIdsQuery,
  IGetBusinessTripsByDatesQuery,
  IGetBusinessTripsByIdsQuery,
  IGetChargeIdsByBusinessTripIdQuery,
  IInsertBusinessTripQuery,
  IUpdateAccountantApprovalQuery,
  IUpdateBusinessTripQuery,
  IUpdateChargeBusinessTripQuery,
} from '../../../../../modules/business-trips/__generated__/business-trips.types.js';
import { caseFor, type Cases } from '../../../cases.js';
import { TRIP, tripCharges, unlinkedCharge } from '../_fixture-ids.js';

export const cases: Cases = {
  getBusinessTripsByIds: caseFor<IGetBusinessTripsByIdsQuery>(s => [
    { businessTripsIds: [TRIP.berlin, TRIP.empty, TRIP.london] },
    { businessTripsIds: s.ids('business_trips', 10) },
    { businessTripsIds: [s.missingId, null] },
  ]),
  getBusinessTripsByChargeIds: caseFor<IGetBusinessTripsByChargeIdsQuery>(s => [
    // linked to a trip, linked to two charges' trip, linked to no trip (NULL trip id), unlinked
    {
      chargeIds: [
        ...tripCharges(s, TRIP.berlin),
        ...tripCharges(s, TRIP.london),
        ...tripCharges(s, null),
        unlinkedCharge(s),
      ],
    },
    { chargeIds: s.ids('charges', 20) },
    { chargeIds: [s.missingId] },
  ]),
  getChargeIdsByBusinessTripId: caseFor<IGetChargeIdsByBusinessTripIdQuery>(s => [
    { businessTripsIds: [TRIP.berlin, TRIP.newYork, TRIP.london, TRIP.empty] },
    { businessTripsIds: [s.missingId, null] },
  ]),
  getBusinessTripsByDates: caseFor<IGetBusinessTripsByDatesQuery>(() => [
    // Berlin (03-10..03-15) and New York (05-01..05-08), one charge each; Paris (07-01..07-04, one
    // attendee without dates) has no charge. London (09-01..09-05) has two charges and stays out of
    // range: DISTINCT ON without ORDER BY picks an arbitrary one.
    { fromDate: '2024-01-01', toDate: '2024-06-01' },
    { fromDate: '2024-01-01', toDate: '2024-08-01' },
    { fromDate: '2024-07-01', toDate: '2024-07-04' },
    { fromDate: '2024-07-01', toDate: '2024-07-05' },
    // bounds: from is inclusive, to exclusive
    { fromDate: '2024-03-10', toDate: '2024-05-08' },
    { fromDate: '2024-03-11', toDate: '2024-05-09' },
    { fromDate: '2024-03-10', toDate: '2024-03-15' },
    { fromDate: '2024-03-10', toDate: '2024-03-16' },
    { fromDate: '2025-01-01', toDate: '2026-01-01' },
    { fromDate: null, toDate: '2026-01-01' },
    { fromDate: '2024-01-01', toDate: null },
  ]),
  updateChargeBusinessTrip: caseFor<IUpdateChargeBusinessTripQuery>(s => [
    // conflict on charge_id: moves the charge to another trip
    { chargeId: tripCharges(s, TRIP.berlin)[0], businessTripId: TRIP.newYork, ownerId: s.businessId },
    // conflict, trip cleared
    { chargeId: tripCharges(s, TRIP.berlin)[0], businessTripId: null, ownerId: s.businessId },
    // a charge with a NULL trip gets one
    { chargeId: tripCharges(s, null)[0], businessTripId: TRIP.empty, ownerId: s.businessId },
    // new link
    { chargeId: unlinkedCharge(s), businessTripId: TRIP.paris, ownerId: s.businessId },
    // unknown trip: foreign key
    { chargeId: unlinkedCharge(s), businessTripId: s.missingId, ownerId: s.businessId },
    // unknown charge: foreign key
    { chargeId: s.missingId, businessTripId: TRIP.paris, ownerId: s.businessId },
    // conflict with an unknown trip: foreign key on the update
    { chargeId: tripCharges(s, TRIP.berlin)[0], businessTripId: s.missingId, ownerId: s.businessId },
  ]),
  deleteChargeBusinessTrip: caseFor<IDeleteChargeBusinessTripQuery>(s => [
    { chargeId: tripCharges(s, TRIP.london)[0] },
    { chargeId: s.missingId },
    { chargeId: null },
  ]),
  updateBusinessTrip: caseFor<IUpdateBusinessTripQuery>(s => [
    {
      businessTripId: TRIP.empty,
      name: 'BT Renamed',
      destinationCode: 'DEU',
      tripPurpose: 'Planning',
      accountantStatus: 'PENDING',
    },
    // all NULL: nothing changes, the id still returns
    { businessTripId: TRIP.berlin },
    { businessTripId: TRIP.berlin, tripPurpose: 'Keynote' },
    // unique name
    { businessTripId: TRIP.empty, name: 'BT Berlin Conference' },
    // unknown destination: foreign key
    { businessTripId: TRIP.empty, destinationCode: 'XXX' },
    { businessTripId: s.missingId, name: 'nobody' },
    { businessTripId: null, name: 'nobody' },
  ]),
  insertBusinessTrip: caseFor<IInsertBusinessTripQuery>(s => [
    { name: 'BT Tokyo', destinationCode: 'JPN', tripPurpose: 'Expo', ownerId: s.businessId },
    { name: 'BT Nowhere', destinationCode: null, tripPurpose: null, ownerId: s.businessId },
    // unique name
    { name: 'BT Berlin Conference', destinationCode: null, tripPurpose: null, ownerId: s.businessId },
    // NOT NULL name
    { name: null, destinationCode: 'DEU', tripPurpose: null, ownerId: s.businessId },
    // unknown destination
    { name: 'BT Atlantis', destinationCode: 'ATL', tripPurpose: null, ownerId: s.businessId },
    // another tenant: row-level security
    { name: 'BT Elsewhere', destinationCode: null, tripPurpose: null, ownerId: s.missingId },
  ]),
  updateAccountantApproval: caseFor<IUpdateAccountantApprovalQuery>(s => [
    { businessTripId: TRIP.berlin, accountantStatus: 'UNAPPROVED' },
    { businessTripId: TRIP.empty, accountantStatus: 'APPROVED' },
    // NOT NULL
    { businessTripId: TRIP.empty, accountantStatus: null },
    { businessTripId: s.missingId, accountantStatus: 'APPROVED' },
  ]),
};
