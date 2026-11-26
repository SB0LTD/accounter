import type {
  IGetCreditCardTransactionsByChargeIdsQuery,
  IValidateCreditCardTransactionsAmountByChargeIdsQuery,
} from '../../../../../modules/transactions/__generated__/creditcard-transactions.types.js';
import type { Row } from '../../../../catalog.js';
import type { QueryDb } from '../../../../query-db.js';
import { like, Numeric } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';
import { groupByKey } from '../../charges/_helpers.js';
import { nullRowOf } from '../../charges/_rows.js';

type Transaction = Row<'transactions'>;
type Account = Row<'financial_accounts'>;

/**
 * The lateral join both queries share: for each transaction of the charges (the "origin", a bank
 * debit of a card), the card transactions it pays.
 *
 *   FROM transactions origin_transaction LEFT JOIN LATERAL (
 *     SELECT t.*, a.type, a.account_number, a.account_name
 *     FROM transactions t LEFT JOIN financial_accounts a ON a.id = t.account_id) t
 *   ON (t.account_number = origin_transaction.source_reference
 *       OR (t.account_name IS NOT NULL AND t.account_name <> ''
 *           AND origin_transaction.source_description LIKE '%' || t.account_name || '%'))
 *     AND t.type = 'CREDIT_CARD' AND t.currency = origin_transaction.currency
 *     AND COALESCE(t.debit_date_override, t.debit_date) = COALESCE(origin's override, origin's debit_date)
 *   WHERE origin_transaction.charge_id IN $$chargeIds
 */
async function cardMatches(db: QueryDb, chargeIds: readonly (string | null | void)[]) {
  // Only transactions of credit-card accounts can match (t.type = 'CREDIT_CARD').
  const cards = (await db.rows('financial_accounts')).filter(a => a.type === 'CREDIT_CARD');
  const cardTransactions = new Map<string, readonly Transaction[]>();
  for (const card of cards)
    cardTransactions.set(card.id, await db.where('transactions', { account_id: card.id }));
  const origins = await db.whereIn('transactions', 'charge_id', chargeIds);
  const debit = (t: Transaction) => t.debit_date_override ?? t.debit_date;
  const result: { origin: Transaction; t: Transaction | null; account: Account | null }[] = [];
  for (const origin of origins) {
    const originDebit = debit(origin);
    let found = false;
    for (const account of cards) {
      const byNumber = account.account_number === origin.source_reference;
      const byName =
        account.account_name != null &&
        account.account_name !== '' &&
        like(origin.source_description, `%${account.account_name}%`);
      if (!(byNumber || byName) || originDebit == null) continue;
      for (const t of cardTransactions.get(account.id) ?? []) {
        if (t.currency === origin.currency && debit(t) === originDebit) {
          result.push({ origin, t, account });
          found = true;
        }
      }
    }
    if (!found) result.push({ origin, t: null, account: null });
  }
  return result;
}

/**
 * SELECT t.* FROM (the join above) -- the card transaction's columns, origin_transaction_id,
 * origin_charge_id, and the card account's type, account_number and account_name; all NULL for an
 * origin that pays no card transaction.
 */
export const getCreditCardTransactionsByChargeIds =
  port<IGetCreditCardTransactionsByChargeIdsQuery>(
    async ({ chargeIds }, db) =>
      (await cardMatches(db, chargeIds)).map(({ origin, t, account }) =>
        t && account
          ? {
              ...t,
              origin_transaction_id: origin.id,
              origin_charge_id: origin.charge_id,
              type: account.type,
              account_number: account.account_number,
              account_name: account.account_name,
            }
          : {
              ...nullRowOf('transactions'),
              origin_transaction_id: null,
              origin_charge_id: null,
              type: null,
              account_number: null,
              account_name: null,
            },
      ) as never,
  );

/**
 * SELECT origin_transaction.charge_id AS origin_charge_id,
 *        (sum(t.amount) = origin_transaction.amount) AS is_amount_match
 * FROM (the join above) WHERE origin_transaction.charge_id IN $$chargeIds
 * GROUP BY (origin_transaction.charge_id, origin_transaction.amount)
 */
export const validateCreditCardTransactionsAmountByChargeIds =
  port<IValidateCreditCardTransactionsAmountByChargeIdsQuery>(async ({ chargeIds }, db) => {
    const matches = await cardMatches(db, chargeIds);
    const groups = groupByKey(
      matches,
      m => `${m.origin.charge_id}|${Numeric.of(m.origin.amount).key()}`,
    );
    return [...groups.values()].map(rows => {
      let sum: Numeric | null = null;
      for (const { t } of rows) if (t) sum = sum ? sum.add(t.amount) : Numeric.of(t.amount);
      return {
        origin_charge_id: rows[0]!.origin.charge_id,
        is_amount_match: sum === null ? null : sum.eq(rows[0]!.origin.amount),
      };
    });
  });
