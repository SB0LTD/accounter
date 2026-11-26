import type {
  IDeleteBusinessTripOtherExpenseQuery,
  IGetBusinessTripsOtherExpensesByBusinessTripIdsQuery,
  IGetBusinessTripsOtherExpensesByIdsQuery,
  IInsertBusinessTripOtherExpenseQuery,
  IUpdateBusinessTripOtherExpenseQuery,
} from '../../../../../modules/business-trips/__generated__/business-trips-expenses-other.types.js';
import { caseFor, type Cases } from '../../../cases.js';
import { EXPENSE, FRESH, TRIP } from '../_fixture-ids.js';

export const cases: Cases = {
  getBusinessTripsOtherExpensesByBusinessTripIds:
    caseFor<IGetBusinessTripsOtherExpensesByBusinessTripIdsQuery>(s => [
      { isBusinessTripIds: 1, businessTripIds: [TRIP.newYork] },
      { isBusinessTripIds: 1, businessTripIds: [TRIP.berlin, TRIP.empty] },
      { isBusinessTripIds: 0, businessTripIds: [s.missingId] },
      { isBusinessTripIds: null, businessTripIds: [TRIP.newYork, null] },
    ]),
  getBusinessTripsOtherExpensesByIds: caseFor<IGetBusinessTripsOtherExpensesByIdsQuery>(s => [
    { isIds: 1, expenseIds: [EXPENSE.other, EXPENSE.otherPaid, EXPENSE.flight] },
    { isIds: 0, expenseIds: [s.missingId] },
    { isIds: null, expenseIds: [EXPENSE.otherPaid] },
    { isIds: 1, expenseIds: [s.missingId, null] },
  ]),
  updateBusinessTripOtherExpense: caseFor<IUpdateBusinessTripOtherExpenseQuery>(s => [
    { businessTripExpenseId: EXPENSE.other, deductibleExpense: false, description: 'Taxis' },
    { businessTripExpenseId: EXPENSE.otherPaid, deductibleExpense: true },
    { businessTripExpenseId: EXPENSE.other },
    { businessTripExpenseId: s.missingId, description: 'x' },
    { businessTripExpenseId: null, description: 'x' },
  ]),
  insertBusinessTripOtherExpense: caseFor<IInsertBusinessTripOtherExpenseQuery>(s => [
    { id: EXPENSE.flight, deductibleExpense: true, description: 'Lounge', ownerId: s.businessId },
    { id: EXPENSE.tns, deductibleExpense: null, description: null, ownerId: s.businessId },
    // primary key
    { id: EXPENSE.other, deductibleExpense: null, description: null, ownerId: s.businessId },
    // no such expense: foreign key
    { id: FRESH.a, deductibleExpense: null, description: null, ownerId: s.businessId },
    // another tenant: row-level security
    { id: EXPENSE.tns, deductibleExpense: null, description: null, ownerId: s.missingId },
  ]),
  deleteBusinessTripOtherExpense: caseFor<IDeleteBusinessTripOtherExpenseQuery>(s => [
    { businessTripExpenseId: EXPENSE.otherPaid },
    { businessTripExpenseId: EXPENSE.flight },
    { businessTripExpenseId: s.missingId },
    { businessTripExpenseId: null },
  ]),
};
