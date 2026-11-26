import type {
  IDeleteBusinessTripTravelAndSubsistenceExpenseQuery,
  IGetBusinessTripsTravelAndSubsistenceExpensesByBusinessTripIdsQuery,
  IGetBusinessTripsTravelAndSubsistenceExpensesByBusinessTripIdsResult,
  IGetBusinessTripsTravelAndSubsistenceExpensesByIdsQuery,
  IGetBusinessTripsTravelAndSubsistenceExpensesByIdsResult,
  IInsertBusinessTripTravelAndSubsistenceExpenseQuery,
  IUpdateBusinessTripTravelAndSubsistenceExpenseQuery,
} from '../../../../../modules/business-trips/__generated__/business-trips-expenses-travel-and-subsistence.types.js';
import { coalescePatch, inList } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';
import { equalsZero, orTrue, withExtended } from '../_helpers.js';

/**
 * SELECT * FROM business_trips_transactions_tns a
 * LEFT JOIN extended_business_trip_transactions t USING (id)
 * WHERE ($isBusinessTripIds = 0 OR t.business_trip_id IN $$businessTripIds)
 */
export const getBusinessTripsTravelAndSubsistenceExpensesByBusinessTripIds =
  port<IGetBusinessTripsTravelAndSubsistenceExpensesByBusinessTripIdsQuery>(
    async ({ isBusinessTripIds, businessTripIds }, db) => {
      const all = equalsZero(isBusinessTripIds);
      const inTrips = inList(businessTripIds);
      const rows = await withExtended(db, await db.rows('business_trips_transactions_tns'));
      return rows.filter(row =>
        orTrue(all, inTrips(row.business_trip_id)),
      ) as IGetBusinessTripsTravelAndSubsistenceExpensesByBusinessTripIdsResult[];
    },
  );

/**
 * SELECT * FROM business_trips_transactions_tns a
 * LEFT JOIN extended_business_trip_transactions t USING (id)
 * WHERE ($isIds = 0 OR t.id IN $$expenseIds)
 *
 * `t.id` is the view's id: NULL for a row without an expense row.
 */
export const getBusinessTripsTravelAndSubsistenceExpensesByIds =
  port<IGetBusinessTripsTravelAndSubsistenceExpensesByIdsQuery>(async ({ isIds, expenseIds }, db) => {
    const all = equalsZero(isIds);
    const inIds = inList(expenseIds);
    const rows = await withExtended(db, await db.rows('business_trips_transactions_tns'));
    return rows.filter(row =>
      orTrue(all, row.business_trip_id != null && inIds(row.id)),
    ) as IGetBusinessTripsTravelAndSubsistenceExpensesByIdsResult[];
  });

/**
 * UPDATE business_trips_transactions_tns SET expense_type = COALESCE($expenseType, expense_type)
 * WHERE id = $businessTripExpenseId
 * RETURNING *
 */
export const updateBusinessTripTravelAndSubsistenceExpense =
  port<IUpdateBusinessTripTravelAndSubsistenceExpenseQuery>(
    async ({ businessTripExpenseId, expenseType }, db) => {
      if (businessTripExpenseId == null) return [];
      const result = [];
      for (const row of await db.where('business_trips_transactions_tns', {
        id: businessTripExpenseId,
      })) {
        result.push(
          await db.update(
            'business_trips_transactions_tns',
            row,
            coalescePatch({ expense_type: expenseType }) as never,
          ),
        );
      }
      return result;
    },
  );

/**
 * INSERT INTO business_trips_transactions_tns (id, expense_type, owner_id)
 * VALUES ($id, $expenseType, $ownerId)
 * RETURNING *
 */
export const insertBusinessTripTravelAndSubsistenceExpense =
  port<IInsertBusinessTripTravelAndSubsistenceExpenseQuery>(
    async ({ id, expenseType, ownerId }, db) => {
      const row = await db.insert('business_trips_transactions_tns', {
        id: id ?? null,
        expense_type: expenseType ?? null,
        owner_id: ownerId ?? null,
      } as never);
      return row ? [row] : [];
    },
  );

/** DELETE FROM business_trips_transactions_tns WHERE id = $businessTripExpenseId RETURNING id */
export const deleteBusinessTripTravelAndSubsistenceExpense =
  port<IDeleteBusinessTripTravelAndSubsistenceExpenseQuery>(async ({ businessTripExpenseId }, db) => {
    if (businessTripExpenseId == null) return [];
    const result = [];
    for (const row of await db.where('business_trips_transactions_tns', {
      id: businessTripExpenseId,
    })) {
      result.push({ id: (await db.delete('business_trips_transactions_tns', row)).id });
    }
    return result;
  });
