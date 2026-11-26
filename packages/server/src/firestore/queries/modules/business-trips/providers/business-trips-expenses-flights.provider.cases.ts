import type {
  IDeleteBusinessTripFlightsExpenseQuery,
  IGetBusinessTripsFlightsExpensesByBusinessTripIdsQuery,
  IGetBusinessTripsFlightsExpensesByIdsQuery,
  IInsertBusinessTripFlightsExpenseQuery,
  IUpdateBusinessTripFlightsExpenseQuery,
} from '../../../../../modules/business-trips/__generated__/business-trips-expenses-flights.types.js';
import { caseFor, type Cases } from '../../../cases.js';
import { EMPLOYEE, EXPENSE, FRESH, TRIP } from '../_fixture-ids.js';

export const cases: Cases = {
  getBusinessTripsFlightsExpensesByBusinessTripIds:
    caseFor<IGetBusinessTripsFlightsExpensesByBusinessTripIdsQuery>(s => [
      { businessTripIds: [TRIP.berlin, TRIP.london] },
      { businessTripIds: [TRIP.newYork] },
      { businessTripIds: [s.missingId, null] },
    ]),
  getBusinessTripsFlightsExpensesByIds: caseFor<IGetBusinessTripsFlightsExpensesByIdsQuery>(
    s => [
      { expenseIds: [EXPENSE.flight, EXPENSE.flightBare, EXPENSE.accommodation] },
      { expenseIds: [s.missingId, null] },
    ],
  ),
  updateBusinessTripFlightsExpense: caseFor<IUpdateBusinessTripFlightsExpenseQuery>(s => [
    {
      businessTripExpenseId: EXPENSE.flight,
      path: ['TLV', 'MUC', 'BER'],
      class: 'BUSINESS',
      attendeeIds: [EMPLOYEE.omer],
    },
    { businessTripExpenseId: EXPENSE.flightBare, class: 'FIRST_CLASS' },
    { businessTripExpenseId: EXPENSE.flightBare, path: [], attendeeIds: [] },
    { businessTripExpenseId: EXPENSE.flight },
    { businessTripExpenseId: s.missingId, class: 'ECONOMY' },
    { businessTripExpenseId: null, class: 'ECONOMY' },
  ]),
  insertBusinessTripFlightsExpense: caseFor<IInsertBusinessTripFlightsExpenseQuery>(s => [
    {
      id: EXPENSE.other,
      path: ['JFK', 'TLV'],
      class: 'PREMIUM_ECONOMY',
      attendeeIds: [EMPLOYEE.dana, EMPLOYEE.omer],
      ownerId: s.businessId,
    },
    { id: EXPENSE.carRental, path: null, class: null, attendeeIds: [], ownerId: s.businessId },
    // explicit NULL does not take the default: NOT NULL
    { id: EXPENSE.carRental, path: null, class: null, attendeeIds: null, ownerId: s.businessId },
    // primary key
    { id: EXPENSE.flight, path: null, class: null, attendeeIds: [], ownerId: s.businessId },
    // no such expense: foreign key
    { id: FRESH.a, path: null, class: null, attendeeIds: [], ownerId: s.businessId },
  ]),
  deleteBusinessTripFlightsExpense: caseFor<IDeleteBusinessTripFlightsExpenseQuery>(s => [
    { businessTripExpenseId: EXPENSE.flight },
    { businessTripExpenseId: EXPENSE.accommodation },
    { businessTripExpenseId: s.missingId },
    { businessTripExpenseId: null },
  ]),
};
