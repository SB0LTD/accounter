import type {
  IDeleteBusinessTripAccommodationsExpenseQuery,
  IGetBusinessTripsAccommodationsExpensesByBusinessTripIdsQuery,
  IGetBusinessTripsAccommodationsExpensesByIdsQuery,
  IInsertBusinessTripAccommodationsExpenseQuery,
  IUpdateBusinessTripAccommodationsExpenseQuery,
} from '../../../../../modules/business-trips/__generated__/business-trips-expenses-accommodations.types.js';
import { caseFor, type Cases } from '../../../cases.js';
import { EMPLOYEE, EXPENSE, FRESH, TRIP } from '../_fixture-ids.js';

export const cases: Cases = {
  getBusinessTripsAccommodationsExpensesByBusinessTripIds:
    caseFor<IGetBusinessTripsAccommodationsExpensesByBusinessTripIdsQuery>(s => [
      { businessTripIds: [TRIP.berlin, TRIP.london] },
      { businessTripIds: [TRIP.newYork, TRIP.empty] },
      { businessTripIds: [s.missingId, null] },
    ]),
  getBusinessTripsAccommodationsExpensesByIds:
    caseFor<IGetBusinessTripsAccommodationsExpensesByIdsQuery>(s => [
      { expenseIds: [EXPENSE.accommodation, EXPENSE.accommodationPaid, EXPENSE.flight] },
      { expenseIds: [s.missingId, null] },
    ]),
  updateBusinessTripAccommodationsExpense:
    caseFor<IUpdateBusinessTripAccommodationsExpenseQuery>(s => [
      {
        businessTripExpenseId: EXPENSE.accommodation,
        country: 'FRA',
        nightsCount: 2,
        attendeesStay: [{ attendeeId: EMPLOYEE.omer, nightsCount: 2 }],
      },
      // COALESCE keeps the others
      { businessTripExpenseId: EXPENSE.accommodationPaid, nightsCount: 7 },
      { businessTripExpenseId: EXPENSE.accommodationPaid, attendeesStay: [] },
      { businessTripExpenseId: EXPENSE.accommodation },
      { businessTripExpenseId: s.missingId, country: 'FRA' },
      { businessTripExpenseId: null, country: 'FRA' },
    ]),
  insertBusinessTripAccommodationsExpense:
    caseFor<IInsertBusinessTripAccommodationsExpenseQuery>(s => [
      {
        id: EXPENSE.flightBare,
        country: 'GBR',
        nightsCount: 3,
        attendeesStay: [
          { attendeeId: EMPLOYEE.dana, nightsCount: 3, note: 'late check-in', nested: [1, [2]] },
        ],
        ownerId: s.businessId,
      },
      { id: EXPENSE.other, country: null, nightsCount: null, attendeesStay: [], ownerId: s.businessId },
      // explicit NULL does not take the column default: NOT NULL
      { id: EXPENSE.other, country: null, nightsCount: null, attendeesStay: null, ownerId: s.businessId },
      // primary key
      { id: EXPENSE.accommodation, country: null, nightsCount: 1, attendeesStay: [], ownerId: s.businessId },
      // no such expense: foreign key
      { id: FRESH.a, country: null, nightsCount: 1, attendeesStay: [], ownerId: s.businessId },
    ]),
  deleteBusinessTripAccommodationsExpense:
    caseFor<IDeleteBusinessTripAccommodationsExpenseQuery>(s => [
      { businessTripExpenseId: EXPENSE.accommodation },
      { businessTripExpenseId: EXPENSE.flight },
      { businessTripExpenseId: s.missingId },
      { businessTripExpenseId: null },
    ]),
};
