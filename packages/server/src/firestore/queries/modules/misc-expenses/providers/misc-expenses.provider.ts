import type {
  IDeleteExpenseQuery,
  IGetExpensesByChargeIdsQuery,
  IGetExpensesByChargeIdsResult,
  IGetExpensesByFinancialEntityIdsQuery,
  IGetExpensesByIdsQuery,
  IInsertExpenseParams,
  IInsertExpenseQuery,
  IInsertExpensesQuery,
  IReplaceMiscExpensesChargeIdQuery,
  IUpdateExpenseQuery,
} from '../../../../../modules/misc-expenses/__generated__/misc-expenses.types.js';
import type { Row } from '../../../../catalog.js';
import type { QueryDb } from '../../../../query-db.js';
import { coalescePatch } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';
import { deletableRows, enumParam } from '../../documents/_helpers.js';

/**
 * A `misc_expenses` row as the queries return it (pgTyped types invoice_date as
 * TimelessDateString, the store's row type as string: the same `YYYY-MM-DD` text).
 */
type ExpenseRow = IGetExpensesByChargeIdsResult;
type ExpensePatch = Partial<Row<'misc_expenses'>>;

const asExpenses = (rows: readonly Row<'misc_expenses'>[]) => rows as readonly ExpenseRow[];

/** `SELECT * FROM misc_expenses WHERE charge_id IN $$chargeIds` */
export const getExpensesByChargeIds = port<IGetExpensesByChargeIdsQuery>(
  async ({ chargeIds }, db) =>
    asExpenses(await db.whereIn('misc_expenses', 'charge_id', chargeIds)),
);

/** `SELECT * FROM misc_expenses WHERE id IN $$ids` */
export const getExpensesByIds = port<IGetExpensesByIdsQuery>(async ({ ids }, db) =>
  asExpenses(await db.whereIn('misc_expenses', 'id', ids)),
);

/** `SELECT * FROM misc_expenses WHERE creditor_id IN $$financialEntityIds OR debtor_id IN $$financialEntityIds` */
export const getExpensesByFinancialEntityIds = port<IGetExpensesByFinancialEntityIdsQuery>(
  async ({ financialEntityIds }, db) => {
    const byCreditor = asExpenses(
      await db.whereIn('misc_expenses', 'creditor_id', financialEntityIds),
    );
    const seen = new Set(byCreditor.map(row => row.id));
    const byDebtor = asExpenses(
      await db.whereIn('misc_expenses', 'debtor_id', financialEntityIds),
    ).filter(row => !seen.has(row.id));
    return [...byCreditor, ...byDebtor];
  },
);

/**
 * UPDATE misc_expenses SET
 *   charge_id = COALESCE($chargeId, charge_id), creditor_id = COALESCE($creditorId, creditor_id),
 *   debtor_id = COALESCE($debtorId, debtor_id), amount = COALESCE($amount, amount),
 *   currency = COALESCE($currency, currency), description = COALESCE($description, description),
 *   invoice_date = COALESCE($invoiceDate, invoice_date), value_date = COALESCE($valueDate, value_date)
 * WHERE id = $miscExpenseId
 * RETURNING *;
 */
export const updateExpense = port<IUpdateExpenseQuery>(async (params, db) => {
  const currency = enumParam('currency', params.currency);
  if (params.miscExpenseId == null) return [];
  const result: ExpenseRow[] = [];
  for (const row of await db.where('misc_expenses', { id: params.miscExpenseId })) {
    const patch = coalescePatch({
      charge_id: params.chargeId,
      creditor_id: params.creditorId,
      debtor_id: params.debtorId,
      amount: params.amount,
      currency,
      description: params.description,
      invoice_date: params.invoiceDate,
      value_date: params.valueDate,
    }) as ExpensePatch;
    result.push((await db.update('misc_expenses', row, patch)) as ExpenseRow);
  }
  return result;
});

/**
 * UPDATE misc_expenses SET charge_id = $assertChargeID
 * WHERE charge_id = $replaceChargeID
 * RETURNING *
 */
export const replaceMiscExpensesChargeId = port<IReplaceMiscExpensesChargeIdQuery>(
  async ({ assertChargeID, replaceChargeID }, db) => {
    if (replaceChargeID == null) return [];
    const result: ExpenseRow[] = [];
    for (const row of await db.where('misc_expenses', { charge_id: replaceChargeID })) {
      // charge_id is NOT NULL: a NULL $assertChargeID raises on the first row
      const patch = { charge_id: assertChargeID ?? null } as ExpensePatch;
      result.push((await db.update('misc_expenses', row, patch)) as ExpenseRow);
    }
    return result;
  },
);

/** One `(charge_id, creditor_id, ..., owner_id)` VALUES row; NULLs are explicit. */
async function insertOne(db: QueryDb, values: IInsertExpenseParams, currency: string | null) {
  const row = await db.insert('misc_expenses', {
    charge_id: values.chargeId ?? null,
    creditor_id: values.creditorId ?? null,
    debtor_id: values.debtorId ?? null,
    amount: values.amount ?? null,
    currency,
    description: values.description ?? null,
    invoice_date: values.invoiceDate ?? null,
    value_date: values.valueDate ?? null,
    owner_id: values.ownerId ?? null,
  } as ExpensePatch);
  return row as ExpenseRow | null;
}

/**
 * INSERT INTO misc_expenses (charge_id, creditor_id, debtor_id, amount, currency, description,
 *   invoice_date, value_date, owner_id)
 * VALUES ($chargeId, $creditorId, $debtorId, $amount, $currency, $description, $invoiceDate,
 *   $valueDate, $ownerId)
 * RETURNING *;
 */
export const insertExpense = port<IInsertExpenseQuery>(async (params, db) => {
  const row = await insertOne(db, params, enumParam('currency', params.currency));
  return row ? [row] : [];
});

/**
 * INSERT INTO misc_expenses (charge_id, creditor_id, debtor_id, amount, currency, description,
 *   invoice_date, value_date, owner_id)
 * VALUES $$miscExpenses(chargeId, creditorId, debtorId, amount, currency, description,
 *   invoiceDate, valueDate, ownerId)
 * RETURNING *;
 */
export const insertExpenses = port<IInsertExpensesQuery>(async ({ miscExpenses }, db) => {
  const currencies = miscExpenses.map(expense => enumParam('currency', expense.currency));
  const result: ExpenseRow[] = [];
  for (const [i, expense] of miscExpenses.entries()) {
    const row = await insertOne(db, expense, currencies[i] ?? null);
    if (row) result.push(row);
  }
  return result;
});

/** `DELETE FROM misc_expenses WHERE id = $id RETURNING id` */
export const deleteExpense = port<IDeleteExpenseQuery>(async ({ id }, db) => {
  if (id == null) return [];
  const result: { id: string }[] = [];
  for (const row of deletableRows(db, await db.where('misc_expenses', { id }))) {
    await db.delete('misc_expenses', row);
    result.push({ id: row.id });
  }
  return result;
});
