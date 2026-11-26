import type {
  IGetAllDepositsWithTransactionsQuery,
  IGetBankDepositsByChargeIdsQuery,
  IGetDepositTransactionsByChargeIdQuery,
  IGetTransactionsByBankDepositsQuery,
  IUnlinkChargesFromBankDepositsByChargeIdsQuery,
  IUpsertBankDepositChargeQuery,
} from '../../../../../modules/bank-deposits/__generated__/bank-deposit-charges.types.js';
import { port } from '../../../port.js';
import { compareUuid, deletable, groupByKey } from '../../charges/_helpers.js';
import { nullRowOf } from '../../charges/_rows.js';

/**
 * SELECT cbd.new_deposit_id, t.* FROM charges_bank_deposits cbd
 * INNER JOIN transactions t ON cbd.id = t.charge_id WHERE new_deposit_id IN $$depositIds
 */
export const getTransactionsByBankDeposits = port<IGetTransactionsByBankDepositsQuery>(
  async ({ depositIds }, db) => {
    const result = [];
    for (const cbd of await db.whereIn('charges_bank_deposits', 'new_deposit_id', depositIds)) {
      for (const t of await db.where('transactions', { charge_id: cbd.id })) {
        result.push({ new_deposit_id: cbd.new_deposit_id, ...t });
      }
    }
    return result as never;
  },
);

/**
 * SELECT bd.id, bd.name, bd.currency, bd.account_id, bd.open_date, bd.close_date, bd.owner_id,
 *        cbd.id AS charge_id
 * FROM charges_bank_deposits cbd INNER JOIN bank_deposits bd ON cbd.new_deposit_id = bd.id
 * WHERE cbd.id IN $$chargeIds
 */
export const getBankDepositsByChargeIds = port<IGetBankDepositsByChargeIdsQuery>(
  async ({ chargeIds }, db) => {
    const result = [];
    for (const cbd of await db.whereIn('charges_bank_deposits', 'id', chargeIds)) {
      if (cbd.new_deposit_id == null) continue;
      for (const bd of await db.where('bank_deposits', { id: cbd.new_deposit_id })) {
        result.push({
          id: bd.id,
          name: bd.name,
          currency: bd.currency,
          account_id: bd.account_id,
          open_date: bd.open_date,
          close_date: bd.close_date,
          owner_id: bd.owner_id,
          charge_id: cbd.id,
        });
      }
    }
    return result as never;
  },
);

/**
 * SELECT cbd.new_deposit_id, t.* FROM charges_bank_deposits cbd
 * LEFT JOIN transactions t ON cbd.id = t.charge_id
 * WHERE new_deposit_id IN (SELECT cbd2.new_deposit_id FROM charges_bank_deposits cbd2 WHERE cbd2.id = $chargeId)
 *   AND ($includeCharge OR t.charge_id <> $chargeId)
 */
export const getDepositTransactionsByChargeId = port<IGetDepositTransactionsByChargeIdQuery>(
  async ({ chargeId, includeCharge }, db) => {
    if (chargeId == null) return [];
    const deposits = (await db.where('charges_bank_deposits', { id: chargeId }))
      .map(cbd => cbd.new_deposit_id)
      .filter(id => id != null);
    const result = [];
    for (const cbd of await db.whereIn('charges_bank_deposits', 'new_deposit_id', deposits)) {
      const transactions = await db.where('transactions', { charge_id: cbd.id });
      const joined = transactions.length ? transactions : [nullRowOf('transactions')];
      for (const t of joined) {
        // $includeCharge OR t.charge_id <> $chargeId (NULL charge id: unknown)
        const otherCharge = t.charge_id == null ? null : t.charge_id !== chargeId;
        if (includeCharge === true || otherCharge === true) {
          result.push({ new_deposit_id: cbd.new_deposit_id, ...t });
        }
      }
    }
    return result as never;
  },
);

/**
 * INSERT INTO charges_bank_deposits (id, new_deposit_id, owner_id, account_id)
 * VALUES ($chargeId, $depositId, $ownerId, $accountId)
 * ON CONFLICT (id) DO UPDATE SET new_deposit_id = EXCLUDED.new_deposit_id,
 *   owner_id = EXCLUDED.owner_id, account_id = EXCLUDED.account_id
 */
export const upsertBankDepositCharge = port<IUpsertBankDepositChargeQuery>(async (p, db) => {
  await db.insert(
    'charges_bank_deposits',
    {
      id: (p.chargeId ?? null) as never,
      new_deposit_id: p.depositId ?? null,
      owner_id: (p.ownerId ?? null) as never,
      account_id: (p.accountId ?? null) as never,
    },
    {
      target: ['id'],
      action: (_existing, excluded) => ({
        new_deposit_id: excluded.new_deposit_id,
        owner_id: excluded.owner_id,
        account_id: excluded.account_id,
      }),
    },
  );
  return [];
});

/** DELETE FROM charges_bank_deposits WHERE id IN $$chargeIds */
export const unlinkChargesFromBankDepositsByChargeIds =
  port<IUnlinkChargesFromBankDepositsByChargeIdsQuery>(async ({ chargeIds }, db) => {
    for (const cbd of deletable(db, await db.whereIn('charges_bank_deposits', 'id', chargeIds))) {
      await db.delete('charges_bank_deposits', cbd);
    }
    return [];
  });

/**
 * SELECT bd.id AS new_deposit_id, bd.name AS deposit_name, bd.currency AS deposit_currency,
 *        bd.open_date, bd.close_date, t.*
 * FROM bank_deposits bd
 * LEFT JOIN charges_bank_deposits cbd ON cbd.new_deposit_id = bd.id
 * LEFT JOIN transactions t ON cbd.id = t.charge_id
 * ORDER BY bd.id, COALESCE(t.debit_date, t.event_date)
 */
export const getAllDepositsWithTransactions = port<IGetAllDepositsWithTransactionsQuery>(
  async (_params, db) => {
    const links = groupByKey(await db.rows('charges_bank_deposits'), cbd => cbd.new_deposit_id);
    const transactionsByCharge = groupByKey(await db.rows('transactions'), t => t.charge_id);
    const rows: Record<string, unknown>[] = [];
    for (const bd of await db.rows('bank_deposits')) {
      const deposit = {
        new_deposit_id: bd.id,
        deposit_name: bd.name,
        deposit_currency: bd.currency,
        open_date: bd.open_date,
        close_date: bd.close_date,
      };
      const cbds = links.get(bd.id) ?? [null];
      for (const cbd of cbds) {
        const transactions = cbd ? (transactionsByCharge.get(cbd.id) ?? [null]) : [null];
        for (const t of transactions)
          rows.push({ ...deposit, ...(t ?? nullRowOf('transactions')) });
      }
    }
    const day = (r: Record<string, unknown>) =>
      (r.debit_date ?? r.event_date ?? null) as string | null;
    return rows.sort((a, b) => {
      const byDeposit = compareUuid(a.new_deposit_id as string, b.new_deposit_id as string);
      if (byDeposit !== 0) return byDeposit;
      const x = day(a);
      const y = day(b);
      if (x == null || y == null) return x == null && y == null ? 0 : x == null ? 1 : -1;
      return x < y ? -1 : x > y ? 1 : 0;
    }) as never;
  },
);
