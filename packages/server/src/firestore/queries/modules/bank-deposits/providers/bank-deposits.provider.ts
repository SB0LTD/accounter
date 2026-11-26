import type {
  IGetAllBankDepositsQuery,
  IGetAllBankDepositsResult,
  IGetAllOpenBankDepositsQuery,
  IGetBankDepositsByIdsQuery,
  IInsertBankDepositQuery,
  IUpdateBankDepositQuery,
} from '../../../../../modules/bank-deposits/__generated__/bank-deposits.types.js';
import type { TimelessDateString } from '../../../../../shared/types/index.js';
import type { Row } from '../../../../catalog.js';
import { coalesce, toDateString } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';

const date = (value: string | null | void) => (value == null ? null : toDateString(value));

/** SELECT id, name, currency, account_id, open_date, close_date, owner_id */
const depositColumns = (d: Row<'bank_deposits'>): IGetAllBankDepositsResult => ({
  id: d.id,
  name: d.name,
  currency: d.currency,
  account_id: d.account_id,
  open_date: d.open_date as TimelessDateString | null,
  close_date: d.close_date as TimelessDateString | null,
  owner_id: d.owner_id,
});

/** SELECT id, name, currency, account_id, open_date, close_date, owner_id FROM bank_deposits */
export const getAllBankDeposits = port<IGetAllBankDepositsQuery>(async (_params, db) =>
  (await db.rows('bank_deposits')).map(depositColumns),
);

/** SELECT (the same columns) FROM bank_deposits WHERE close_date IS NULL */
export const getAllOpenBankDeposits = port<IGetAllOpenBankDepositsQuery>(async (_params, db) =>
  (await db.rows('bank_deposits')).filter(d => d.close_date == null).map(depositColumns),
);

/** SELECT (the same columns) FROM bank_deposits WHERE id IN $$depositIds */
export const getBankDepositsByIds = port<IGetBankDepositsByIdsQuery>(async ({ depositIds }, db) =>
  (await db.whereIn('bank_deposits', 'id', depositIds)).map(depositColumns),
);

/**
 * INSERT INTO bank_deposits (name, currency, account_id, open_date, close_date, owner_id)
 * VALUES ($name, $currency, $accountId, $openDate, $closeDate, $ownerId)
 * RETURNING id, name, currency, account_id, open_date, close_date, owner_id
 */
export const insertBankDeposit = port<IInsertBankDepositQuery>(async (p, db) => {
  const row = await db.insert('bank_deposits', {
    name: (p.name ?? null) as never,
    currency: p.currency ?? null,
    account_id: p.accountId ?? null,
    open_date: date(p.openDate),
    close_date: date(p.closeDate),
    owner_id: (p.ownerId ?? null) as never,
  });
  return row ? [depositColumns(row)] : [];
});

/**
 * UPDATE bank_deposits SET name = $name, currency = COALESCE($currency, currency),
 *   open_date = $openDate, close_date = $closeDate, account_id = $accountId
 * WHERE id = $depositId RETURNING id, name, currency, account_id, open_date, close_date, owner_id
 */
export const updateBankDeposit = port<IUpdateBankDepositQuery>(async (p, db) => {
  if (p.depositId == null) return [];
  const result = [];
  for (const d of await db.where('bank_deposits', { id: p.depositId })) {
    const updated = await db.update('bank_deposits', d, {
      name: (p.name ?? null) as never,
      currency: coalesce(p.currency ?? null, d.currency),
      open_date: date(p.openDate),
      close_date: date(p.closeDate),
      account_id: p.accountId ?? null,
    });
    result.push(depositColumns(updated));
  }
  return result;
});
