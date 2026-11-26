/**
 * `extended_business_trip_transactions`: every business-trip expense with the transactions matched to
 * it (or, when none are, the employee payment that settled it).
 *
 *   WITH t AS (
 *     SELECT tm.business_trip_transaction_id,
 *       array_agg(DISTINCT t1.id) AS transaction_ids, array_agg(DISTINCT t1.charge_id) AS charge_ids,
 *       array_agg(DISTINCT t1.currency) AS currencies, sum(tm.amount) AS amount,
 *       min(t1.event_date) AS event_date,
 *       min(COALESCE(t1.debit_date_override, t1.debit_date)) AS debit_date
 *     FROM business_trips_transactions_match tm LEFT JOIN transactions t1 ON t1.id = tm.transaction_id
 *     GROUP BY tm.business_trip_transaction_id)
 *   SELECT DISTINCT ON (btt.id) btt.id, btt.business_trip_id, t.transaction_ids,
 *     CASE WHEN t.charge_ids IS NOT NULL THEN t.charge_ids
 *          WHEN ep.charge_id IS NOT NULL THEN ARRAY[ep.charge_id] END AS charge_ids,
 *     btt.category,
 *     CASE WHEN t.business_trip_transaction_id IS NULL THEN ep.date ELSE t.event_date END AS date,
 *     CASE WHEN t.business_trip_transaction_id IS NULL THEN ep.value_date ELSE t.debit_date END AS value_date,
 *     CASE WHEN t.business_trip_transaction_id IS NULL THEN ep.amount * -1
 *          WHEN array_length(t.currencies, 1) = 1 THEN t.amount END AS amount,
 *     CASE WHEN t.business_trip_transaction_id IS NULL THEN ep.currency
 *          WHEN array_length(t.currencies, 1) = 1 THEN t.currencies[1] END AS currency,
 *     ep.employee_business_id,
 *     t.business_trip_transaction_id IS NULL AS payed_by_employee
 *   FROM business_trips_transactions btt
 *   LEFT JOIN t ON t.business_trip_transaction_id = btt.id
 *   LEFT JOIN business_trips_employee_payments ep ON ep.id = btt.id
 *
 * `btt.id` is the primary key and both joins match at most one row, so DISTINCT ON keeps every row.
 * `array_agg(DISTINCT ...)` sorts, with a NULL (a match whose transaction is not visible) last;
 * `currencies` sorts by the enum's declaration order. (The view reads `currencies[1]` only when the
 * array has exactly one element, so the order never shows.)
 */
import type { TimelessDateString } from '../../shared/types/index.js';
import type { Row } from '../catalog.js';
import type { QueryDb } from '../query-db.js';
import { arrayAggDistinct, coalesce, groupBy, minOf, Numeric, sumText } from '../sql-helpers.js';

type Expense = Row<'business_trips_transactions'>;
type Payment = Row<'business_trips_employee_payments'>;

/**
 * One row of the view, typed as pgTyped types it. A type alias (not an interface), so it is a
 * `Record<string, unknown>`.
 *
 * The uuid arrays hold a NULL element only when a match points at a transaction the request cannot
 * read, which the foreign key and tenant isolation rule out; pgTyped types them `string[]` too.
 */
export type ExtendedBusinessTripTransactionRow = {
  id: string;
  business_trip_id: string;
  /** uuid[]; NULL when the expense has no matched transactions */
  transaction_ids: string[] | null;
  /** uuid[]: the matched transactions' charges, else the employee payment's charge, else NULL */
  charge_ids: string[] | null;
  category: Expense['category'];
  date: TimelessDateString | null;
  value_date: TimelessDateString | null;
  /** numeric, as `pg` returns it */
  amount: string | null;
  currency: Payment['currency'] | null;
  employee_business_id: string | null;
  payed_by_employee: boolean;
};

export async function extendedBusinessTripTransactions(
  db: QueryDb,
): Promise<readonly ExtendedBusinessTripTransactionRow[]> {
  const expenses = await db.rows('business_trips_transactions');
  if (expenses.length === 0) return [];
  const matches = await db.rows('business_trips_transactions_match');
  const transactions = await db.whereIn(
    'transactions',
    'id',
    matches.map(m => m.transaction_id),
  );
  const transactionById = new Map(transactions.map(t => [t.id, t]));
  const matchesByExpense = groupBy(matches, m => m.business_trip_transaction_id);
  const payments = await db.rows('business_trips_employee_payments');
  const paymentById = new Map(payments.map(p => [p.id, p]));

  const day = (value: string | null | undefined) => (value ?? null) as TimelessDateString | null;
  const uuids = (values: (string | null)[] | null) => values as string[] | null;

  return expenses.map((btt): ExtendedBusinessTripTransactionRow => {
    const ep = paymentById.get(btt.id) ?? null;
    const group = matchesByExpense.get(btt.id);
    if (!group) {
      // No matched transactions: the employee payment (if any) describes the expense.
      return {
        id: btt.id,
        business_trip_id: btt.business_trip_id,
        transaction_ids: null,
        charge_ids: ep?.charge_id != null ? [ep.charge_id] : null,
        category: btt.category,
        date: day(ep?.date),
        value_date: day(ep?.value_date),
        amount: ep?.amount != null ? Numeric.of(ep.amount).mul('-1').toString() : null,
        currency: ep?.currency ?? null,
        employee_business_id: ep?.employee_business_id ?? null,
        payed_by_employee: true,
      };
    }
    const joined = group.map(m => ({ match: m, t1: transactionById.get(m.transaction_id) ?? null }));
    const currencies = arrayAggDistinct(
      joined.map(j => j.t1?.currency ?? null),
      { enumType: 'currency' },
    )!;
    const singleCurrency = currencies.length === 1;
    return {
      id: btt.id,
      business_trip_id: btt.business_trip_id,
      transaction_ids: uuids(arrayAggDistinct(joined.map(j => j.t1?.id ?? null))),
      charge_ids: uuids(arrayAggDistinct(joined.map(j => j.t1?.charge_id ?? null))),
      category: btt.category,
      date: day(
        minOf(
          joined.map(j => j.t1?.event_date ?? null),
          'date',
        ),
      ),
      value_date: day(
        minOf(
          joined.map(j => coalesce(j.t1?.debit_date_override, j.t1?.debit_date)),
          'date',
        ),
      ),
      amount: singleCurrency ? sumText(joined.map(j => j.match.amount)) : null,
      currency: singleCurrency ? (currencies[0] ?? null) : null,
      employee_business_id: ep?.employee_business_id ?? null,
      payed_by_employee: false,
    };
  });
}
