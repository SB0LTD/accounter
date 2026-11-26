import type { Row } from '../../../../catalog.js';
import type {
  IDeleteFinancialAccountQuery,
  IGetAllFinancialAccountsQuery,
  IGetFinancialAccountsByAccountIDsQuery,
  IGetFinancialAccountsByAccountNumbersQuery,
  IGetFinancialAccountsByOwnerIdsQuery,
  IInsertFinancialAccountsQuery,
  IUpdateFinancialAccountQuery,
} from '../../../../../modules/financial-accounts/__generated__/financial-accounts.types.js';
import { coalescePatch } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';
import { deletable, typed } from '../../salaries/_helpers.js';

/** SELECT id, account_number, account_name, private_business, owner, type */
const summary = (row: Row<'financial_accounts'>) => ({
  id: row.id,
  account_number: row.account_number,
  account_name: row.account_name,
  private_business: row.private_business,
  owner: row.owner,
  type: row.type,
});

/**
 * SELECT id, account_number, account_name, private_business, owner, type
 * FROM financial_accounts WHERE owner IN $$ownerIds
 */
export const getFinancialAccountsByOwnerIds = port<IGetFinancialAccountsByOwnerIdsQuery>(
  async ({ ownerIds }, db) =>
    (await db.whereIn('financial_accounts', 'owner', ownerIds)).map(summary),
);

/**
 * SELECT id, account_number, account_name, private_business, owner, type
 * FROM financial_accounts WHERE account_number IN $$accountNumbers
 */
export const getFinancialAccountsByAccountNumbers =
  port<IGetFinancialAccountsByAccountNumbersQuery>(async ({ accountNumbers }, db) =>
    (await db.whereIn('financial_accounts', 'account_number', accountNumbers)).map(summary),
  );

/**
 * SELECT id, account_number, account_name, private_business, owner, type
 * FROM financial_accounts WHERE id IN $$accountIDs
 */
export const getFinancialAccountsByAccountIDs = port<IGetFinancialAccountsByAccountIDsQuery>(
  async ({ accountIDs }, db) =>
    (await db.whereIn('financial_accounts', 'id', accountIDs)).map(summary),
);

/** SELECT id, account_number, account_name, private_business, owner, type FROM financial_accounts */
export const getAllFinancialAccounts = port<IGetAllFinancialAccountsQuery>(async (_params, db) =>
  (await db.rows('financial_accounts')).map(summary),
);

/**
 * UPDATE financial_accounts SET
 *   account_number = COALESCE($accountNumber, account_number),
 *   account_name = COALESCE($name, account_name),
 *   private_business = COALESCE($privateBusiness, private_business),
 *   owner = COALESCE($ownerId, owner),
 *   type = COALESCE($type, type)
 * WHERE id = $financialAccountId
 * RETURNING *
 */
export const updateFinancialAccount = port<IUpdateFinancialAccountQuery>(
  async ({ financialAccountId, accountNumber, name, privateBusiness, ownerId, type }, db) => {
    if (financialAccountId == null) return [];
    const patch = typed(
      'financial_accounts',
      coalescePatch({
        account_number: accountNumber,
        account_name: name,
        private_business: privateBusiness,
        owner: ownerId,
        type,
      }),
    );
    const updated: Row<'financial_accounts'>[] = [];
    for (const row of await db.where('financial_accounts', { id: financialAccountId })) {
      updated.push(await db.update('financial_accounts', row, patch));
    }
    return updated;
  },
);

/**
 * INSERT INTO financial_accounts (account_number, account_name, private_business, owner, type, owner_id)
 * VALUES $$bankAccounts(accountNumber, name, privateBusiness, ownerId, type, ownerId)
 * RETURNING *
 */
export const insertFinancialAccounts = port<IInsertFinancialAccountsQuery>(
  async ({ bankAccounts }, db) => {
    const inserted: Row<'financial_accounts'>[] = [];
    for (const account of bankAccounts) {
      const row = await db.insert(
        'financial_accounts',
        typed('financial_accounts', {
          account_number: account.accountNumber ?? null,
          account_name: account.name ?? null,
          private_business: account.privateBusiness ?? null,
          owner: account.ownerId ?? null,
          type: account.type ?? null,
          owner_id: account.ownerId ?? null,
        }),
      );
      if (row) inserted.push(row);
    }
    return inserted;
  },
);

/** DELETE FROM financial_accounts WHERE id = $financialAccountId RETURNING id */
export const deleteFinancialAccount = port<IDeleteFinancialAccountQuery>(
  async ({ financialAccountId }, db) => {
    if (financialAccountId == null) return [];
    const rows = await db.where('financial_accounts', { id: financialAccountId });
    const deleted: { id: string }[] = [];
    for (const row of deletable(rows, db.ctx.businessId)) {
      await db.delete('financial_accounts', row);
      deleted.push({ id: row.id });
    }
    return deleted;
  },
);
