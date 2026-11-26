import {
  amountUsd,
  cryptoRateLookup,
  dateToTimestamp,
  exchangeRateLookup,
  negate,
} from '../_helpers.js';
import type { IGetNormalizedRevenueRecordsQuery } from '../../../../../modules/reports/__generated__/annual-revenue-report.types.js';
import { equalityKey, inList, sqlEquals, toDateString } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';

type RevenueRow = Omit<IGetNormalizedRevenueRecordsQuery['result'], 'amount_usd'>;

/**
 * WITH normalizedLedgerRevenue AS (
 *   WITH ChargeBusinessID AS (
 *     -- per charge: the one distinct counterparty of its non-fee transactions (business_id) and
 *     -- its documents (creditor_id / debtor_id other than $ownerId), else NULL
 *     SELECT charge_id, CASE WHEN array_length(ARRAY_AGG(DISTINCT potential_id), 1) = 1
 *       THEN ARRAY_AGG(DISTINCT potential_id) END AS entity_id FROM (...) GROUP BY charge_id
 *   )
 *   -- 1. credit_entity1/2 IN $$incomeTaxCategoriesIDs, value_date BETWEEN: debit amounts, debit_entity1
 *   SELECT id, charge_id, owner_id, debit_local_amount1 AS amount_local, debit_foreign_amount1 AS
 *     amount_foreign, currency, value_date AS date, reference1 AS reference, description,
 *     debit_entity1 AS business_id, b.country FROM ledger_records LEFT JOIN businesses b ...
 *   UNION
 *   -- 2. debit_entity1/2 IN $$incomeTaxCategoriesIDs, value_date BETWEEN: credit amounts * -1, credit_entity1
 *   UNION
 *   -- 3. credit_entity1/2 = $incomeToCollectId, invoice_date = $fromDate: debit amounts * -1, cbi.entity_id[1]
 *   UNION
 *   -- 4. debit_entity1/2 = $incomeToCollectId, invoice_date = $toDate: credit amounts, cbi.entity_id[1]
 *   (every branch: AND ledger_records.owner_id = $ownerId)
 * )
 * SELECT nlr.*, CASE currency ... END AS amount_usd   -- see amountUsd in ../_helpers.ts
 * FROM normalizedLedgerRevenue nlr
 * LEFT JOIN LATERAL (latest exchange_rates with exchange_date <= nlr.date) lr ON TRUE
 * LEFT JOIN LATERAL (latest crypto_exchange_rates with date <= nlr.date, coin_symbol::currency =
 *   nlr.currency, against = 'USD') lr2 ON nlr.date IS NOT NULL
 *
 * No ORDER BY: row order is not defined.
 *
 * `cer.coin_symbol::accounter_schema.currency` raises in Postgres for a symbol that is not a
 * currency label, but only for rows the plan happens to evaluate; the port treats such a symbol as
 * never equal (crypto_currencies holds currency labels in practice).
 */
export const getNormalizedRevenueRecords = port<IGetNormalizedRevenueRecordsQuery>(
  async ({ fromDate, toDate, incomeTaxCategoriesIDs, incomeToCollectId, ownerId }, db) => {
    if (ownerId == null) return [];
    const from = fromDate == null ? null : toDateString(fromDate);
    const to = toDate == null ? null : toDateString(toDate);
    const isIncomeCategory = inList(incomeTaxCategoriesIDs);
    const isToCollect = (value: unknown) => sqlEquals(value, incomeToCollectId);
    const inRange = (date: string) => from !== null && to !== null && date >= from && date <= to;

    const ledger = (await db.where('ledger_records', { owner_id: ownerId })).filter(r =>
      sqlEquals(r.owner_id, ownerId),
    );
    const businesses = new Map((await db.rows('businesses')).map(b => [b.id, b]));
    const countryOf = (id: string | null) =>
      id == null ? null : (businesses.get(id)?.country ?? null);

    // ChargeBusinessID, computed only when an income-to-collect branch needs it
    let chargeEntity: Map<string, string | null> | null = null;
    const entityOfCharge = async (chargeId: string): Promise<string | null> => {
      if (!chargeEntity) {
        const potentials = new Map<string, Set<string>>();
        const add = (chargeId: string | null, id: string) => {
          if (chargeId == null) return;
          let set = potentials.get(chargeId);
          if (!set) potentials.set(chargeId, (set = new Set()));
          set.add(id);
        };
        for (const t of await db.rows('transactions')) {
          if (t.is_fee === false && t.business_id != null) add(t.charge_id, t.business_id);
        }
        for (const d of await db.rows('documents')) {
          if (d.creditor_id != null && d.creditor_id !== ownerId) add(d.charge_id, d.creditor_id);
          if (d.debtor_id != null && d.debtor_id !== ownerId) add(d.charge_id, d.debtor_id);
        }
        chargeEntity = new Map(
          [...potentials].map(([charge, ids]) => [charge, ids.size === 1 ? [...ids][0]! : null]),
        );
      }
      return chargeEntity.get(chargeId) ?? null;
    };

    const branches: RevenueRow[] = [];
    const push = (
      r: (typeof ledger)[number],
      amountLocal: string | null,
      amountForeign: string | null,
      date: string,
      businessId: string | null,
    ) =>
      branches.push({
        id: r.id,
        charge_id: r.charge_id,
        owner_id: r.owner_id,
        amount_local: amountLocal,
        amount_foreign: amountForeign,
        currency: r.currency,
        date: date as RevenueRow['date'],
        reference: r.reference1,
        description: r.description,
        business_id: businessId,
        country: countryOf(businessId),
      });

    // 1.
    for (const r of ledger) {
      if (
        (isIncomeCategory(r.credit_entity1) || isIncomeCategory(r.credit_entity2)) &&
        inRange(r.value_date)
      ) {
        push(r, r.debit_local_amount1, r.debit_foreign_amount1, r.value_date, r.debit_entity1);
      }
    }
    // 2.
    for (const r of ledger) {
      if (
        (isIncomeCategory(r.debit_entity1) || isIncomeCategory(r.debit_entity2)) &&
        inRange(r.value_date)
      ) {
        push(
          r,
          negate(r.credit_local_amount1),
          negate(r.credit_foreign_amount1),
          r.value_date,
          r.credit_entity1,
        );
      }
    }
    // 3.
    for (const r of ledger) {
      if (
        (isToCollect(r.credit_entity1) || isToCollect(r.credit_entity2)) &&
        r.invoice_date === from
      ) {
        push(
          r,
          negate(r.debit_local_amount1),
          negate(r.debit_foreign_amount1),
          r.invoice_date,
          await entityOfCharge(r.charge_id),
        );
      }
    }
    // 4.
    for (const r of ledger) {
      if ((isToCollect(r.debit_entity1) || isToCollect(r.debit_entity2)) && r.invoice_date === to) {
        push(
          r,
          r.credit_local_amount1,
          r.credit_foreign_amount1,
          r.invoice_date,
          await entityOfCharge(r.charge_id),
        );
      }
    }

    // UNION: drop duplicate rows (numeric values compare by value)
    const seen = new Set<string>();
    const unique = branches.filter(row => {
      const key = JSON.stringify([
        row.id,
        row.charge_id,
        row.owner_id,
        equalityKey(row.amount_local, 'decimal'),
        equalityKey(row.amount_foreign, 'decimal'),
        row.currency,
        row.date,
        row.reference,
        row.description,
        row.business_id,
        row.country,
      ]);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (unique.length === 0) return [];

    const rateOn = exchangeRateLookup(await db.rows('exchange_rates'));
    const cryptoRateAt = cryptoRateLookup(await db.rows('crypto_exchange_rates'));
    return unique.map(row => {
      const lr = rateOn(row.date);
      const lr2 = row.date == null ? null : cryptoRateAt(row.currency!, dateToTimestamp(row.date));
      return {
        ...row,
        amount_usd: amountUsd(
          row.currency!,
          { usd: row.amount_foreign, ils: row.amount_local, foreign: row.amount_foreign },
          lr,
          lr2,
        ),
      };
    });
  },
);
