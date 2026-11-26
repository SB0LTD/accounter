import type {
  ICalculateCreditcardDebitDateQuery,
  IFlagForeignFeeTransactionsQuery,
  IGetReferenceMergeCandidatesQuery,
} from '../../../../../modules/manual-automations/__generated__/manual-automations.types.js';
import type { Row } from '../../../../catalog.js';
import { addToDate, coalesce, like, Numeric, orderBy } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';
import { groupByKey, minDate } from '../../charges/_helpers.js';

type Transaction = Row<'transactions'>;

/** `LTRIM(text, '0')` */
const ltrimZeros = (text: string) => text.replace(/^0+/, '');

/**
 * The owner's transactions grouped by source reference:
 *   SELECT COUNT(et.*) AS counter, array_agg(DISTINCT et.charge_id) AS charge_ids, et.source_reference
 *   FROM transactions et WHERE et.owner_id = $ownerId GROUP BY source_reference
 */
function referenceGroups(transactions: readonly Transaction[], ownerId: string | null) {
  const groups = new Map<string, { counter: number; charges: number }>();
  const owned = transactions.filter(t => ownerId != null && t.owner_id === ownerId);
  for (const [reference, rows] of groupByKey(owned, t => t.source_reference)) {
    groups.set(reference, {
      counter: rows.length,
      charges: new Set(rows.map(t => t.charge_id)).size,
    });
  }
  return groups;
}

/**
 * Transactions that look like parts of one movement split over several charges: the owner's
 * transactions whose source reference recurs across charges, plus (Poalim only) foreign-securities
 * transactions linked by a zero-padded reference in their description and same-day transactions
 * carrying that reference. Card accounts' numbers and the customs/VAT reference are left out.
 *
 *   WITH transactions_origin_user_description AS (
 *     SELECT t.id, COALESCE(p_ils.beneficiary_details_data_message_detail, p_foreign.event_details)
 *     FROM transactions t JOIN transactions_raw_list trl ON t.source_id = trl.id
 *     LEFT JOIN poalim_ils_account_transactions p_ils ON trl.poalim_ils_id = p_ils.id
 *     LEFT JOIN poalim_foreign_account_transactions p_foreign ON trl.poalim_foreign_id = p_foreign.id),
 *   transactions_with_descriptions AS (SELECT t.*, ud.user_source_description AS origin_user_description ...),
 *   poalim_foreign_securities_reference_aliases AS (
 *     SELECT t.id, t.event_date, LTRIM((embedded.match)[1], '0') AS normalized_reference
 *     FROM transactions_with_descriptions t CROSS JOIN LATERAL regexp_matches(
 *       COALESCE(source_description, '') || ' ' || COALESCE(origin_user_description, ''), '(0[0-9]{7,})', 'g')
 *     WHERE t.owner_id = $ownerId AND t.source_origin = 'POALIM'
 *       AND (LOWER(text) LIKE '%fsec%' OR regexp_replace(LOWER(text), '["''׳״]', '', 'g') LIKE '%ניעז%')
 *       AND LENGTH(normalized_reference) >= 6),
 *   poalim_foreign_securities_related_transactions AS (SELECT DISTINCT t.id ... JOIN aliases ON t.id = alias.transaction_id
 *     OR (t.source_origin = 'POALIM' AND LTRIM(t.source_reference, '0') = normalized_reference AND t.event_date = alias_event_date))
 *   SELECT t.* FROM transactions_with_descriptions t LEFT JOIN (reference groups) g ON g.source_reference = t.source_reference
 *   WHERE t.owner_id = $ownerId
 *     AND ((g.counter > 1 AND array_length(g.charge_ids, 1) > 1) OR t.id IN (related))
 *     AND t.source_reference NOT IN (SELECT account_number FROM financial_accounts WHERE owner = $ownerId AND type = 'CREDIT_CARD')
 *     AND t.source_reference <> '15997109'
 *   ORDER BY t.source_reference
 *
 * Rows sharing a source reference have no defined order in Postgres; here they keep table order.
 */
export const getReferenceMergeCandidates = port<IGetReferenceMergeCandidatesQuery>(
  async ({ ownerId: ownerParam }, db) => {
    const ownerId = ownerParam ?? null;
    const [transactions, rawList, ilsRows, foreignRows, accounts] = await Promise.all([
      db.rows('transactions'),
      db.rows('transactions_raw_list'),
      db.rows('poalim_ils_account_transactions'),
      db.rows('poalim_foreign_account_transactions'),
      db.rows('financial_accounts'),
    ]);
    const rawById = new Map(rawList.map(r => [r.id, r]));
    const ilsById = new Map(ilsRows.map(r => [r.id, r]));
    const foreignById = new Map(foreignRows.map(r => [r.id, r]));

    // transactions_with_descriptions
    const withDescriptions = transactions.map(t => {
      const raw = rawById.get(t.source_id);
      const origin = raw
        ? coalesce(
            raw.poalim_ils_id == null
              ? null
              : ilsById.get(raw.poalim_ils_id)?.beneficiary_details_data_message_detail,
            raw.poalim_foreign_id == null
              ? null
              : foreignById.get(raw.poalim_foreign_id)?.event_details,
          )
        : null;
      return { ...t, origin_user_description: origin };
    });

    // poalim_foreign_securities_reference_aliases
    const aliases: {
      transaction_id: string;
      alias_event_date: string;
      normalized_reference: string;
    }[] = [];
    for (const t of withDescriptions) {
      if (ownerId == null || t.owner_id !== ownerId || t.source_origin !== 'POALIM') continue;
      const text = `${t.source_description ?? ''} ${t.origin_user_description ?? ''}`;
      const lower = text.toLowerCase();
      if (!(like(lower, '%fsec%') || like(lower.replace(/["'׳״]/g, ''), '%ניעז%'))) continue;
      for (const match of text.matchAll(/(0[0-9]{7,})/g)) {
        const normalized = ltrimZeros(match[1]!);
        if (normalized.length >= 6) {
          aliases.push({
            transaction_id: t.id,
            alias_event_date: t.event_date,
            normalized_reference: normalized,
          });
        }
      }
    }

    // poalim_foreign_securities_related_transactions
    const related = new Set<string>();
    for (const t of withDescriptions) {
      for (const alias of aliases) {
        if (
          t.id === alias.transaction_id ||
          (t.source_origin === 'POALIM' &&
            ltrimZeros(t.source_reference) === alias.normalized_reference &&
            t.event_date === alias.alias_event_date)
        ) {
          related.add(t.id);
          break;
        }
      }
    }

    const groups = referenceGroups(transactions, ownerId);
    const cardNumbers = new Set(
      accounts
        .filter(a => ownerId != null && a.owner === ownerId && a.type === 'CREDIT_CARD')
        .map(a => a.account_number),
    );
    const candidates = withDescriptions.filter(t => {
      if (ownerId == null || t.owner_id !== ownerId) return false;
      const g = groups.get(t.source_reference);
      const recurring = g != null && g.counter > 1 && g.charges > 1;
      return (
        (recurring || related.has(t.id)) &&
        !cardNumbers.has(t.source_reference) &&
        t.source_reference !== '15997109'
      );
    });
    return orderBy(candidates, [{ value: t => t.source_reference }]) as never;
  },
);

/**
 * UPDATE transactions t SET is_fee = TRUE
 * FROM (SELECT t.id FROM transactions t LEFT JOIN (reference groups of the owner) g
 *         ON g.source_reference = t.source_reference
 *       WHERE t.is_fee IS FALSE AND t.owner_id = $ownerId AND g.counter > 1 AND t.currency <> 'ILS'
 *         AND t.amount <= 30 AND t.amount >= -30 AND t.source_description LIKE '%העברת מט%') matches
 * WHERE t.id = matches.id RETURNING t.id
 */
export const flagForeignFeeTransactions = port<IFlagForeignFeeTransactionsQuery>(
  async ({ ownerId: ownerParam }, db) => {
    const ownerId = ownerParam ?? null;
    const transactions = [...(await db.rows('transactions'))];
    const groups = referenceGroups(transactions, ownerId);
    const result = [];
    for (const t of transactions) {
      const g = groups.get(t.source_reference);
      const amount = Numeric.of(t.amount);
      if (
        t.is_fee === false &&
        ownerId != null &&
        t.owner_id === ownerId &&
        g != null &&
        g.counter > 1 &&
        t.currency !== 'ILS' &&
        !amount.gt(30) &&
        !amount.lt(-30) &&
        like(t.source_description, '%העברת מט%')
      ) {
        const updated = await db.update('transactions', t, { is_fee: true });
        result.push({ id: updated.id });
      }
    }
    return result;
  },
);

/**
 * WITH alt_debit_date AS (SELECT p.event_date, p.reference_number::text FROM poalim_ils_account_transactions p
 *                         WHERE p.activity_type_code = 491 ORDER BY p.event_date DESC),
 *      altered_transactions AS (SELECT DISTINCT ON (t.id) t.id, alt_debit_date.event_date AS alt_debit_date, t.owner_id
 *        FROM transactions t LEFT JOIN financial_accounts a ON a.id = t.account_id
 *        LEFT JOIN alt_debit_date ON reference_number = a.account_number
 *          AND alt.event_date > t.event_date AND alt.event_date < t.event_date + '40 days'
 *          AND alt.event_date = (the earliest such alt date for the account)
 *        WHERE t.debit_date IS NULL AND t.debit_date_override IS NULL AND currency = 'ILS'
 *          AND (t.source_origin = 'ISRACARD' OR t.source_origin = 'AMEX'))
 * UPDATE transactions t SET debit_date_override = at.alt_debit_date FROM altered_transactions at
 * WHERE at.id = t.id AND t.debit_date IS NULL AND t.debit_date_override IS NULL
 *   AND at.alt_debit_date IS NOT NULL AND at.owner_id = $ownerId
 * RETURNING t.id, t.debit_date_override
 */
export const calculateCreditcardDebitDate = port<ICalculateCreditcardDebitDateQuery>(
  async ({ ownerId: ownerParam }, db) => {
    const ownerId = ownerParam ?? null;
    const altDebitDates = (await db.rows('poalim_ils_account_transactions'))
      .filter(p => p.activity_type_code === 491)
      .map(p => ({ event_date: p.event_date, reference_number: String(p.reference_number) }));
    const accounts = new Map((await db.rows('financial_accounts')).map(a => [a.id, a]));
    const result = [];
    const transactions = await db.rows('transactions');
    for (const t of transactions) {
      if (
        t.debit_date != null ||
        t.debit_date_override != null ||
        t.currency !== 'ILS' ||
        (t.source_origin !== 'ISRACARD' && t.source_origin !== 'AMEX')
      ) {
        continue;
      }
      const account = accounts.get(t.account_id);
      if (!account) continue;
      const windowEnd = addToDate(t.event_date, 40, 'day');
      const altDate = minDate(
        altDebitDates
          .filter(
            alt =>
              alt.reference_number === account.account_number &&
              alt.event_date > t.event_date &&
              alt.event_date < windowEnd,
          )
          .map(alt => alt.event_date),
      );
      if (altDate == null || ownerId == null || t.owner_id !== ownerId) continue;
      const updated = await db.update('transactions', t, { debit_date_override: altDate });
      result.push({ id: updated.id, debit_date_override: updated.debit_date_override });
    }
    return result as never;
  },
);
