import type {
  IDeleteBusinessTripExpenseQuery,
  IGetBusinessTripsExpensesByBusinessTripIdsQuery,
  IGetBusinessTripsExpensesByIdsQuery,
  IInsertBusinessTripExpenseQuery,
  IUpdateBusinessTripExpenseQuery,
} from '../../../../../modules/business-trips/__generated__/business-trips-expenses.types.js';
import { caseFor, type Cases } from '../../../cases.js';
import { EXPENSE, TRIP } from '../_fixture-ids.js';

export const cases: Cases = {
  // These two read extended_business_trip_transactions as it is: every kind of view row.
  getBusinessTripsExpensesByBusinessTripIds: caseFor<IGetBusinessTripsExpensesByBusinessTripIdsQuery>(
    s => [
      { businessTripIds: Object.values(TRIP) },
      { businessTripIds: [TRIP.newYork] },
      { businessTripIds: [TRIP.empty, s.missingId, null] },
    ],
  ),
  getBusinessTripsExpensesByIds: caseFor<IGetBusinessTripsExpensesByIdsQuery>(s => [
    { expenseIds: Object.values(EXPENSE) },
    { expenseIds: [EXPENSE.otherPaid, EXPENSE.flightBare] },
    { expenseIds: [s.missingId, null] },
  ]),
  updateBusinessTripExpense: caseFor<IUpdateBusinessTripExpenseQuery>(s => [
    { businessTripExpenseId: EXPENSE.other, businessTripId: TRIP.empty, category: 'FLIGHT' },
    { businessTripExpenseId: EXPENSE.flight, category: 'OTHER' },
    { businessTripExpenseId: EXPENSE.flight },
    // unknown trip: foreign key
    { businessTripExpenseId: EXPENSE.flight, businessTripId: s.missingId },
    { businessTripExpenseId: s.missingId, category: 'OTHER' },
    { businessTripExpenseId: null, category: 'OTHER' },
  ]),
  insertBusinessTripExpense: caseFor<IInsertBusinessTripExpenseQuery>(s => [
    { businessTripId: TRIP.empty, category: 'CAR_RENTAL', ownerId: s.businessId },
    { businessTripId: TRIP.berlin, category: 'TRAVEL_AND_SUBSISTENCE', ownerId: s.businessId },
    // NOT NULL category
    { businessTripId: TRIP.berlin, category: null, ownerId: s.businessId },
    // unknown trip: foreign key
    { businessTripId: s.missingId, category: 'OTHER', ownerId: s.businessId },
    // another tenant: row-level security
    { businessTripId: TRIP.berlin, category: 'OTHER', ownerId: s.missingId },
  ]),
  deleteBusinessTripExpense: caseFor<IDeleteBusinessTripExpenseQuery>(s => [
    { businessTripExpenseId: EXPENSE.unreferenced },
    // a car rental row has no foreign key, its matches do
    { businessTripExpenseId: EXPENSE.carRental },
    // referenced by a flight / an employee payment: foreign key
    { businessTripExpenseId: EXPENSE.flightBare },
    { businessTripExpenseId: EXPENSE.accommodationPaid },
    { businessTripExpenseId: s.missingId },
    { businessTripExpenseId: null },
  ]),
};
