import { byTradeDateThenId, type Execution } from '../_helpers.js';
import type {
  IGetChargeIdsByExecutionIdsQuery,
  IGetExecutionIdsByChargeIdsQuery,
  IGetUnlinkedDistributionsQuery,
  IInsertChargeSecurityExecutionQuery,
  IReplaceChargeSecurityExecutionsChargeIdQuery,
} from '../../../../../modules/foreign-securities/__generated__/security-execution-charges.types.js';
import { coalesce, notDistinct, num, sqlEquals, toDateString } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';

/** SELECT execution_id, charge_id FROM charges_securities_executions WHERE charge_id = ANY($chargeIds!) */
export const getExecutionIdsByChargeIds = port<IGetExecutionIdsByChargeIdsQuery>(
  async ({ chargeIds }, db) =>
    chargeIds == null
      ? []
      : (await db.whereIn('charges_securities_executions', 'charge_id', chargeIds)).map(l => ({
          execution_id: l.execution_id,
          charge_id: l.charge_id,
        })),
);

/** SELECT execution_id, charge_id FROM charges_securities_executions WHERE execution_id = ANY($executionIds!) */
export const getChargeIdsByExecutionIds = port<IGetChargeIdsByExecutionIdsQuery>(
  async ({ executionIds }, db) =>
    executionIds == null
      ? []
      : (await db.whereIn('charges_securities_executions', 'execution_id', executionIds)).map(
          l => ({ execution_id: l.execution_id, charge_id: l.charge_id }),
        ),
);

/**
 * UPDATE charges_securities_executions SET charge_id = $assertChargeID
 * WHERE charge_id = $replaceChargeID
 * RETURNING execution_id, charge_id
 */
export const replaceChargeSecurityExecutionsChargeId =
  port<IReplaceChargeSecurityExecutionsChargeIdQuery>(
    async ({ assertChargeID, replaceChargeID }, db) => {
      if (replaceChargeID == null) return [];
      const result: { execution_id: string; charge_id: string | null }[] = [];
      for (const l of await db.where('charges_securities_executions', {
        charge_id: replaceChargeID,
      })) {
        const updated = await db.update('charges_securities_executions', l, {
          charge_id: assertChargeID ?? null,
        });
        result.push({ execution_id: updated.execution_id, charge_id: updated.charge_id });
      }
      return result;
    },
  );

/** Same owner, account, security, trade type and payment type (IS NOT DISTINCT FROM). */
const sameSeries = (a: Execution, b: Execution) =>
  a.owner_id === b.owner_id &&
  a.bank_number === b.bank_number &&
  a.branch_number === b.branch_number &&
  a.account_number === b.account_number &&
  a.security === b.security &&
  a.trade_type === b.trade_type &&
  notDistinct(a.payment_type, b.payment_type);

/** `abs(a.nv) = abs(b.nv)`: never true when either is NULL. */
const sameSize = (a: Execution, b: Execution) =>
  a.nv != null && b.nv != null && num(a.nv).abs().eq(num(b.nv).abs());

/** `LEAST(a, b)` of two non-null dates. */
const earlierDate = (a: string, b: string) => (a <= b ? a : b);

/** `(a.trade_date, a.id) > (b.trade_date, b.id)` (uuids compare as their lowercase text). */
const laterThan = (a: Execution, b: Execution) =>
  a.trade_date > b.trade_date || (a.trade_date === b.trade_date && a.id > b.id);

/**
 * SELECT t.id, t.symbol, t.eng_name, t.security, t.nv
 * FROM poalim_securities_transactions t
 * LEFT JOIN charges_securities_executions l ON l.execution_id = t.id
 * WHERE l.execution_id IS NULL
 *   AND t.owner_id = $ownerId! AND t.trade_type = $tradeType! AND t.payment_type = $paymentType!
 *   AND t.is_cancel_transaction IS DISTINCT FROM $cancelledFlag!
 *   AND ($ledgerLock::DATE IS NULL OR LEAST(t.trade_date, COALESCE(t.value_date, t.trade_date)) > $ledgerLock::DATE)
 *   AND NOT EXISTS (
 *     SELECT 1 FROM poalim_securities_transactions c
 *     WHERE c.owner_id = t.owner_id AND c.bank_number = t.bank_number
 *       AND c.branch_number = t.branch_number AND c.account_number = t.account_number
 *       AND c.security = t.security AND c.trade_type = t.trade_type
 *       AND c.payment_type IS NOT DISTINCT FROM t.payment_type
 *       AND c.is_cancel_transaction = $cancelledFlag!
 *       AND abs(c.nv) = abs(t.nv) AND c.trade_date >= t.trade_date
 *       AND NOT EXISTS (
 *         SELECT 1 FROM poalim_securities_transactions o
 *         WHERE o.owner_id = t.owner_id AND ... (same account, security, trade type)
 *           AND o.payment_type IS NOT DISTINCT FROM t.payment_type
 *           AND o.is_cancel_transaction IS DISTINCT FROM $cancelledFlag!
 *           AND abs(o.nv) = abs(t.nv)
 *           AND (o.trade_date, o.id) > (t.trade_date, t.id)
 *           AND o.trade_date <= c.trade_date))
 * ORDER BY t.trade_date, t.id
 *
 * Every table is read under RLS, as the subqueries are in Postgres.
 */
export const getUnlinkedDistributions = port<IGetUnlinkedDistributionsQuery>(
  async ({ ownerId, tradeType, paymentType, cancelledFlag, ledgerLock }, db) => {
    if (ownerId == null) return [];
    const lock = ledgerLock == null ? null : toDateString(ledgerLock);
    const linked = new Set(
      (await db.rows('charges_securities_executions')).map(l => l.execution_id),
    );
    // c and o share t's owner, so the owner's executions are all the subqueries can see
    const executions = await db.where('poalim_securities_transactions', { owner_id: ownerId });
    const cancelled = (e: Execution) => sqlEquals(e.is_cancel_transaction, cancelledFlag);
    const live = (e: Execution) => !notDistinct(e.is_cancel_transaction, cancelledFlag);

    const isCancelledBy = (t: Execution, c: Execution) =>
      sameSeries(c, t) &&
      cancelled(c) &&
      sameSize(c, t) &&
      c.trade_date >= t.trade_date &&
      !executions.some(
        o =>
          sameSeries(o, t) &&
          live(o) &&
          sameSize(o, t) &&
          laterThan(o, t) &&
          o.trade_date <= c.trade_date,
      );

    const distributions = executions.filter(
      t =>
        !linked.has(t.id) &&
        sqlEquals(t.trade_type, tradeType) &&
        sqlEquals(t.payment_type, paymentType) &&
        live(t) &&
        (lock == null || earlierDate(t.trade_date, coalesce(t.value_date, t.trade_date)!) > lock) &&
        !executions.some(c => isCancelledBy(t, c)),
    );
    return byTradeDateThenId(distributions, t => t).map(t => ({
      id: t.id,
      symbol: t.symbol,
      eng_name: t.eng_name,
      security: t.security,
      nv: t.nv,
    }));
  },
);

/**
 * INSERT INTO charges_securities_executions (execution_id, charge_id, owner_id)
 * VALUES ($executionId!, $chargeId!, $ownerId!)
 * ON CONFLICT (execution_id) DO NOTHING
 * RETURNING execution_id
 */
export const insertChargeSecurityExecution = port<IInsertChargeSecurityExecutionQuery>(
  async ({ executionId, chargeId, ownerId }, db) => {
    const row = await db.insert(
      'charges_securities_executions',
      {
        execution_id: (executionId ?? null) as never,
        charge_id: chargeId ?? null,
        owner_id: (ownerId ?? null) as never,
      },
      { target: ['execution_id'], action: 'nothing' },
    );
    return row ? [{ execution_id: row.execution_id }] : [];
  },
);
