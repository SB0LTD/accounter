import type {
  IDeleteBusinessTripTravelAndSubsistenceExpenseQuery,
  IGetBusinessTripsTravelAndSubsistenceExpensesByBusinessTripIdsQuery,
  IGetBusinessTripsTravelAndSubsistenceExpensesByIdsQuery,
  IInsertBusinessTripTravelAndSubsistenceExpenseQuery,
  IUpdateBusinessTripTravelAndSubsistenceExpenseQuery,
} from '../../../../../modules/business-trips/__generated__/business-trips-expenses-travel-and-subsistence.types.js';
import { caseFor, type Cases } from '../../../cases.js';
import { EXPENSE, FRESH, ORPHAN, TRIP } from '../_fixture-ids.js';

export const cases: Cases = {
  getBusinessTripsTravelAndSubsistenceExpensesByBusinessTripIds:
    caseFor<IGetBusinessTripsTravelAndSubsistenceExpensesByBusinessTripIdsQuery>(s => [
      { isBusinessTripIds: 1, businessTripIds: [TRIP.berlin] },
      { isBusinessTripIds: 1, businessTripIds: [TRIP.newYork] },
      // 0: every row, the one without an expense row included
      { isBusinessTripIds: 0, businessTripIds: [s.missingId] },
      { isBusinessTripIds: null, businessTripIds: [TRIP.berlin] },
    ]),
  getBusinessTripsTravelAndSubsistenceExpensesByIds:
    caseFor<IGetBusinessTripsTravelAndSubsistenceExpensesByIdsQuery>(s => [
      { isIds: 1, expenseIds: [EXPENSE.tns, ORPHAN.tns] },
      { isIds: 0, expenseIds: [s.missingId] },
      { isIds: null, expenseIds: [EXPENSE.tns] },
      { isIds: 1, expenseIds: [s.missingId, null] },
    ]),
  updateBusinessTripTravelAndSubsistenceExpense:
    caseFor<IUpdateBusinessTripTravelAndSubsistenceExpenseQuery>(s => [
      { businessTripExpenseId: EXPENSE.tns, expenseType: 'meals' },
      { businessTripExpenseId: ORPHAN.tns, expenseType: 'lodging' },
      { businessTripExpenseId: EXPENSE.tns, expenseType: null },
      { businessTripExpenseId: s.missingId, expenseType: 'x' },
      { businessTripExpenseId: null, expenseType: 'x' },
    ]),
  insertBusinessTripTravelAndSubsistenceExpense:
    caseFor<IInsertBusinessTripTravelAndSubsistenceExpenseQuery>(s => [
      { id: EXPENSE.flight, expenseType: 'per diem', ownerId: s.businessId },
      // no foreign key to the expenses table
      { id: FRESH.a, expenseType: null, ownerId: s.businessId },
      // primary key
      { id: EXPENSE.tns, expenseType: null, ownerId: s.businessId },
      // another tenant: row-level security. (A NULL owner is left out: Postgres checks RLS before
      // NOT NULL and raises 42501, the store checks NOT NULL first and raises 23502.)
      { id: FRESH.b, expenseType: null, ownerId: s.missingId },
    ]),
  deleteBusinessTripTravelAndSubsistenceExpense:
    caseFor<IDeleteBusinessTripTravelAndSubsistenceExpenseQuery>(s => [
      { businessTripExpenseId: EXPENSE.tns },
      { businessTripExpenseId: ORPHAN.tns },
      { businessTripExpenseId: s.missingId },
      { businessTripExpenseId: null },
    ]),
};
