import type {
  IDeleteBusinessTripCarRentalExpenseQuery,
  IGetBusinessTripsCarRentalExpensesByBusinessTripIdsQuery,
  IGetBusinessTripsCarRentalExpensesByIdsQuery,
  IInsertBusinessTripCarRentalExpenseQuery,
  IUpdateBusinessTripCarRentalExpenseQuery,
} from '../../../../../modules/business-trips/__generated__/business-trips-expenses-car-rental.types.js';
import { caseFor, type Cases } from '../../../cases.js';
import { EXPENSE, FRESH, ORPHAN, TRIP } from '../_fixture-ids.js';

export const cases: Cases = {
  getBusinessTripsCarRentalExpensesByBusinessTripIds:
    caseFor<IGetBusinessTripsCarRentalExpensesByBusinessTripIdsQuery>(s => [
      { isBusinessTripIds: 1, businessTripIds: [TRIP.newYork, TRIP.berlin] },
      { isBusinessTripIds: 1, businessTripIds: [TRIP.berlin] },
      // 0: every car rental, the one without an expense row included
      { isBusinessTripIds: 0, businessTripIds: [TRIP.berlin] },
      { isBusinessTripIds: null, businessTripIds: [TRIP.newYork] },
      { isBusinessTripIds: null, businessTripIds: [s.missingId] },
    ]),
  getBusinessTripsCarRentalExpensesByIds: caseFor<IGetBusinessTripsCarRentalExpensesByIdsQuery>(
    s => [
      { isIds: 1, expenseIds: [EXPENSE.carRental, EXPENSE.other] },
      // the view has no row for the orphan, so t.id is NULL and it never matches
      { isIds: 1, expenseIds: [ORPHAN.carRental] },
      { isIds: 0, expenseIds: [s.missingId] },
      { isIds: null, expenseIds: [EXPENSE.carRental] },
      { isIds: 1, expenseIds: [s.missingId, null] },
    ],
  ),
  updateBusinessTripCarRentalExpense: caseFor<IUpdateBusinessTripCarRentalExpenseQuery>(s => [
    { businessTripExpenseId: EXPENSE.carRental, days: 6, isFuelExpense: true },
    { businessTripExpenseId: ORPHAN.carRental, isFuelExpense: false },
    { businessTripExpenseId: EXPENSE.carRental },
    { businessTripExpenseId: s.missingId, days: 1 },
    { businessTripExpenseId: null, days: 1 },
  ]),
  insertBusinessTripCarRentalExpense: caseFor<IInsertBusinessTripCarRentalExpenseQuery>(s => [
    { id: EXPENSE.flightBare, days: 3, isFuelExpense: false, ownerId: s.businessId },
    // no foreign key to the expenses table
    { id: FRESH.a, days: 0, isFuelExpense: true, ownerId: s.businessId },
    // explicit NULLs do not take the defaults: NOT NULL
    { id: FRESH.b, days: null, isFuelExpense: false, ownerId: s.businessId },
    { id: FRESH.b, days: 2, isFuelExpense: null, ownerId: s.businessId },
    // primary key
    { id: EXPENSE.carRental, days: 2, isFuelExpense: false, ownerId: s.businessId },
  ]),
  deleteBusinessTripCarRentalExpense: caseFor<IDeleteBusinessTripCarRentalExpenseQuery>(s => [
    { businessTripExpenseId: EXPENSE.carRental },
    { businessTripExpenseId: ORPHAN.carRental },
    { businessTripExpenseId: s.missingId },
    { businessTripExpenseId: null },
  ]),
};
