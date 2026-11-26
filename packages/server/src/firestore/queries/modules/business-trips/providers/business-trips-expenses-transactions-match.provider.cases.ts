import type {
  IDeleteBusinessTripExpenseMatchQuery,
  IDeleteSpecificBusinessTripExpenseMatchQuery,
  IGetBusinessTripsExpenseMatchesByExpenseIdsQuery,
  IGetBusinessTripsExpenseMatchesByTransactionIdsQuery,
  IInsertBusinessTripExpenseMatchQuery,
} from '../../../../../modules/business-trips/__generated__/business-trips-expenses-transactions-match.types.js';
import { caseFor, type Cases, type Snapshot } from '../../../cases.js';
import { EUR_TRANSACTION, EXPENSE } from '../_fixture-ids.js';

const matchedTransactions = (s: Snapshot, expenseId: string) =>
  s
    .rows('business_trips_transactions_match')
    .filter(r => r.business_trip_transaction_id === expenseId)
    .map(r => r.transaction_id as string);

export const cases: Cases = {
  getBusinessTripsExpenseMatchesByTransactionIds:
    caseFor<IGetBusinessTripsExpenseMatchesByTransactionIdsQuery>(s => [
      // the flight's transaction is matched twice
      { transactionIds: [...matchedTransactions(s, EXPENSE.flight), EUR_TRANSACTION] },
      { transactionIds: s.ids('transactions', 20) },
      { transactionIds: [s.missingId, null] },
    ]),
  getBusinessTripsExpenseMatchesByExpenseIds:
    caseFor<IGetBusinessTripsExpenseMatchesByExpenseIdsQuery>(s => [
      { expenseIds: [EXPENSE.flight, EXPENSE.carRental, EXPENSE.tns] },
      { expenseIds: Object.values(EXPENSE) },
      { expenseIds: [s.missingId, null] },
    ]),
  insertBusinessTripExpenseMatch: caseFor<IInsertBusinessTripExpenseMatchQuery>(s => [
    {
      businessTripExpenseId: EXPENSE.other,
      transactionId: EUR_TRANSACTION,
      amount: 12.345,
      ownerId: s.businessId,
    },
    // no key: the same match again
    {
      businessTripExpenseId: EXPENSE.flight,
      transactionId: matchedTransactions(s, EXPENSE.flight)[0],
      amount: '450.50',
      ownerId: s.businessId,
    },
    {
      businessTripExpenseId: EXPENSE.other,
      transactionId: EUR_TRANSACTION,
      amount: 0.1 + 0.2,
      ownerId: s.businessId,
    },
    // foreign keys
    {
      businessTripExpenseId: s.missingId,
      transactionId: EUR_TRANSACTION,
      amount: 1,
      ownerId: s.businessId,
    },
    {
      businessTripExpenseId: EXPENSE.other,
      transactionId: s.missingId,
      amount: 1,
      ownerId: s.businessId,
    },
    // NOT NULL amount
    {
      businessTripExpenseId: EXPENSE.other,
      transactionId: EUR_TRANSACTION,
      amount: null,
      ownerId: s.businessId,
    },
  ]),
  deleteBusinessTripExpenseMatch: caseFor<IDeleteBusinessTripExpenseMatchQuery>(s => [
    { businessTripExpenseId: EXPENSE.flight },
    { businessTripExpenseId: EXPENSE.carRental },
    { businessTripExpenseId: EXPENSE.tns },
    { businessTripExpenseId: s.missingId },
    { businessTripExpenseId: null },
  ]),
  deleteSpecificBusinessTripExpenseMatch:
    caseFor<IDeleteSpecificBusinessTripExpenseMatchQuery>(s => [
      // both rows of the doubly matched transaction
      {
        businessTripExpenseId: EXPENSE.flight,
        transactionId: matchedTransactions(s, EXPENSE.flight)[0],
      },
      {
        businessTripExpenseId: EXPENSE.carRental,
        transactionId: matchedTransactions(s, EXPENSE.carRental)[0],
      },
      { businessTripExpenseId: EXPENSE.carRental, transactionId: EUR_TRANSACTION },
      { businessTripExpenseId: EXPENSE.flight, transactionId: null },
      { businessTripExpenseId: null, transactionId: EUR_TRANSACTION },
    ]),
};
