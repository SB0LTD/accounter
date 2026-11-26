import type {
  IDeleteBusinessTripEmployeePaymentQuery,
  IGetBusinessTripEmployeePaymentByIdQuery,
  IGetBusinessTripEmployeePaymentByIdResult,
  IGetBusinessTripEmployeePaymentsByChargeIdsQuery,
  IGetBusinessTripEmployeePaymentsByChargeIdsResult,
  IInsertBusinessTripEmployeePaymentQuery,
  IReplaceBusinessTripsEmployeePaymentsChargeIdQuery,
  IUpdateBusinessTripEmployeePaymentQuery,
} from '../../../../../modules/business-trips/__generated__/business-trips-employee-payments.types.js';
import type { Row } from '../../../../catalog.js';
import { coalescePatch } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';
import { numericTypmod } from '../_helpers.js';

/** business_trips_employee_payments.amount is numeric(9,2). */
const amountValue = (amount: number | string | null | undefined | void) =>
  numericTypmod(amount, 9, 2);

/** A stored row as the pgTyped result (`RETURNING *` / `SELECT *`): dates typed as date strings. */
type PaymentResult = IGetBusinessTripEmployeePaymentByIdResult;
const asResult = (row: Row<'business_trips_employee_payments'>) => row as PaymentResult;

/**
 * SELECT btep.*, btt.business_trip_id, btt.category
 * FROM business_trips_employee_payments btep
 * LEFT JOIN business_trips_transactions btt ON btt.id = btep.id
 * WHERE btep.charge_id IN $$chargeIds
 */
export const getBusinessTripEmployeePaymentsByChargeIds =
  port<IGetBusinessTripEmployeePaymentsByChargeIdsQuery>(async ({ chargeIds }, db) => {
    const payments = await db.whereIn('business_trips_employee_payments', 'charge_id', chargeIds);
    const expenses = new Map(
      (
        await db.whereIn(
          'business_trips_transactions',
          'id',
          payments.map(p => p.id),
        )
      ).map(btt => [btt.id, btt]),
    );
    return payments.map(payment => {
      const btt = expenses.get(payment.id);
      return {
        ...payment,
        business_trip_id: btt?.business_trip_id ?? null,
        category: btt?.category ?? null,
      } as IGetBusinessTripEmployeePaymentsByChargeIdsResult;
    });
  });

/** SELECT * FROM business_trips_employee_payments WHERE id = $businessTripExpenseId */
export const getBusinessTripEmployeePaymentById = port<IGetBusinessTripEmployeePaymentByIdQuery>(
  async ({ businessTripExpenseId }, db) => {
    if (businessTripExpenseId == null) return [];
    return (await db.where('business_trips_employee_payments', { id: businessTripExpenseId })).map(
      asResult,
    );
  },
);

/**
 * UPDATE business_trips_employee_payments
 * SET charge_id = COALESCE($chargeId, charge_id), date = COALESCE($date, date),
 *   value_date = COALESCE($valueDate, value_date), amount = COALESCE($amount, amount),
 *   currency = COALESCE($currency, currency),
 *   employee_business_id = COALESCE($employeeBusinessId, employee_business_id)
 * WHERE id = $businessTripExpenseId
 * RETURNING *
 */
export const updateBusinessTripEmployeePayment = port<IUpdateBusinessTripEmployeePaymentQuery>(
  async (
    { businessTripExpenseId, chargeId, date, valueDate, amount, currency, employeeBusinessId },
    db,
  ) => {
    // Postgres coerces the parameter to numeric(9,2) while planning, so an overflow raises even
    // when no row matches.
    const newAmount = amountValue(amount);
    if (businessTripExpenseId == null) return [];
    const result: PaymentResult[] = [];
    for (const row of await db.where('business_trips_employee_payments', {
      id: businessTripExpenseId,
    })) {
      const updated = await db.update(
        'business_trips_employee_payments',
        row,
        coalescePatch({
          charge_id: chargeId,
          date,
          value_date: valueDate,
          amount: newAmount,
          currency,
          employee_business_id: employeeBusinessId,
        }) as never,
      );
      result.push(asResult(updated));
    }
    return result;
  },
);

/**
 * INSERT INTO business_trips_employee_payments (id, charge_id, date, value_date, amount, currency, employee_business_id, owner_id)
 * VALUES ($businessTripExpenseId, $chargeId, $date, $valueDate, $amount, $currency, $employeeBusinessId, $ownerId)
 * RETURNING *
 */
export const insertBusinessTripEmployeePayment = port<IInsertBusinessTripEmployeePaymentQuery>(
  async (
    {
      businessTripExpenseId,
      chargeId,
      date,
      valueDate,
      amount,
      currency,
      employeeBusinessId,
      ownerId,
    },
    db,
  ) => {
    const row = await db.insert('business_trips_employee_payments', {
      id: businessTripExpenseId ?? null,
      charge_id: chargeId ?? null,
      date: date ?? null,
      value_date: valueDate ?? null,
      amount: amountValue(amount),
      currency: currency ?? null,
      employee_business_id: employeeBusinessId ?? null,
      owner_id: ownerId ?? null,
    } as never);
    return row ? [asResult(row)] : [];
  },
);

/** DELETE FROM business_trips_employee_payments WHERE id = $businessTripExpenseId RETURNING id */
export const deleteBusinessTripEmployeePayment = port<IDeleteBusinessTripEmployeePaymentQuery>(
  async ({ businessTripExpenseId }, db) => {
    if (businessTripExpenseId == null) return [];
    const result = [];
    for (const row of await db.where('business_trips_employee_payments', {
      id: businessTripExpenseId,
    })) {
      result.push({ id: (await db.delete('business_trips_employee_payments', row)).id });
    }
    return result;
  },
);

/**
 * UPDATE business_trips_employee_payments SET charge_id = $assertChargeID
 * WHERE charge_id = $replaceChargeID
 * RETURNING *
 */
export const replaceBusinessTripsEmployeePaymentsChargeId =
  port<IReplaceBusinessTripsEmployeePaymentsChargeIdQuery>(
    async ({ assertChargeID, replaceChargeID }, db) => {
      if (replaceChargeID == null) return [];
      const result: PaymentResult[] = [];
      for (const row of await db.where('business_trips_employee_payments', {
        charge_id: replaceChargeID,
      })) {
        const updated = await db.update('business_trips_employee_payments', row, {
          charge_id: (assertChargeID ?? null) as never,
        });
        result.push(asResult(updated));
      }
      return result;
    },
  );
