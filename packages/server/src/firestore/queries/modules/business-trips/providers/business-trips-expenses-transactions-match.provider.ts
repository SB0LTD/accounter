import type {
  IDeleteBusinessTripExpenseMatchQuery,
  IDeleteSpecificBusinessTripExpenseMatchQuery,
  IGetBusinessTripsExpenseMatchesByExpenseIdsQuery,
  IGetBusinessTripsExpenseMatchesByTransactionIdsQuery,
  IInsertBusinessTripExpenseMatchQuery,
} from '../../../../../modules/business-trips/__generated__/business-trips-expenses-transactions-match.types.js';
import { port } from '../../../port.js';
import { numericParam } from '../_helpers.js';

/** SELECT * FROM business_trips_transactions_match WHERE transaction_id IN $$transactionIds */
export const getBusinessTripsExpenseMatchesByTransactionIds =
  port<IGetBusinessTripsExpenseMatchesByTransactionIdsQuery>(async ({ transactionIds }, db) =>
    db.whereIn('business_trips_transactions_match', 'transaction_id', transactionIds),
  );

/** SELECT * FROM business_trips_transactions_match WHERE business_trip_transaction_id IN $$expenseIds */
export const getBusinessTripsExpenseMatchesByExpenseIds =
  port<IGetBusinessTripsExpenseMatchesByExpenseIdsQuery>(async ({ expenseIds }, db) =>
    db.whereIn('business_trips_transactions_match', 'business_trip_transaction_id', expenseIds),
  );

/**
 * INSERT INTO business_trips_transactions_match (business_trip_transaction_id, transaction_id, amount, owner_id)
 * VALUES ($businessTripExpenseId, $transactionId, $amount, $ownerId)
 * RETURNING *
 *
 * The table has no key: the same match can be inserted twice.
 */
export const insertBusinessTripExpenseMatch = port<IInsertBusinessTripExpenseMatchQuery>(
  async ({ businessTripExpenseId, transactionId, amount, ownerId }, db) => {
    const row = await db.insert('business_trips_transactions_match', {
      business_trip_transaction_id: businessTripExpenseId ?? null,
      transaction_id: transactionId ?? null,
      amount: numericParam(amount),
      owner_id: ownerId ?? null,
    } as never);
    return row ? [row] : [];
  },
);

/**
 * DELETE FROM business_trips_transactions_match WHERE business_trip_transaction_id = $businessTripExpenseId
 * RETURNING *
 */
export const deleteBusinessTripExpenseMatch = port<IDeleteBusinessTripExpenseMatchQuery>(
  async ({ businessTripExpenseId }, db) => {
    if (businessTripExpenseId == null) return [];
    const result = [];
    for (const row of await db.where('business_trips_transactions_match', {
      business_trip_transaction_id: businessTripExpenseId,
    })) {
      result.push(await db.delete('business_trips_transactions_match', row));
    }
    return result;
  },
);

/**
 * DELETE FROM business_trips_transactions_match
 * WHERE business_trip_transaction_id = $businessTripExpenseId AND transaction_id = $transactionId
 * RETURNING *
 */
export const deleteSpecificBusinessTripExpenseMatch =
  port<IDeleteSpecificBusinessTripExpenseMatchQuery>(
    async ({ businessTripExpenseId, transactionId }, db) => {
      if (businessTripExpenseId == null || transactionId == null) return [];
      const result = [];
      for (const row of await db.where('business_trips_transactions_match', {
        business_trip_transaction_id: businessTripExpenseId,
        transaction_id: transactionId,
      })) {
        result.push(await db.delete('business_trips_transactions_match', row));
      }
      return result;
    },
  );
