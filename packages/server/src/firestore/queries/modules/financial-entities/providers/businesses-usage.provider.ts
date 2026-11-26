import { uuidList } from '../_helpers.js';
import type { IGetUsageCountsByBusinessIdsQuery } from '../../../../../modules/financial-entities/__generated__/businesses-usage.types.js';
import type { TableName } from '../../../../catalog.js';
import { countText } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';

/** The UNION ALL branches: (table, id column, source label). */
const BRANCHES: [TableName, string, string][] = [
  ['transactions', 'business_id', 'transactions'],
  ['documents', 'debtor_id', 'documents'],
  ['documents', 'creditor_id', 'documents'],
  ['misc_expenses', 'debtor_id', 'misc_expenses'],
  ['misc_expenses', 'creditor_id', 'misc_expenses'],
  ['ledger_records', 'debit_entity1', 'ledger'],
  ['ledger_records', 'debit_entity2', 'ledger'],
  ['ledger_records', 'credit_entity1', 'ledger'],
  ['ledger_records', 'credit_entity2', 'ledger'],
];

/**
 * SELECT business_id, source, COUNT(*) AS count
 * FROM (
 *   SELECT business_id, 'transactions' AS source FROM transactions WHERE business_id IN $$businessIds
 *   UNION ALL SELECT debtor_id, 'documents' FROM documents WHERE debtor_id IN $$businessIds
 *   UNION ALL SELECT creditor_id, 'documents' FROM documents WHERE creditor_id IN $$businessIds
 *   UNION ALL SELECT debtor_id, 'misc_expenses' FROM misc_expenses WHERE debtor_id IN $$businessIds
 *   UNION ALL SELECT creditor_id, 'misc_expenses' FROM misc_expenses WHERE creditor_id IN $$businessIds
 *   UNION ALL SELECT debit_entity1, 'ledger' FROM ledger_records WHERE debit_entity1 IN $$businessIds
 *   UNION ALL ... debit_entity2 / credit_entity1 / credit_entity2 likewise
 * ) AS usage
 * GROUP BY business_id, source
 */
export const getUsageCountsByBusinessIds = port<IGetUsageCountsByBusinessIdsQuery>(
  async ({ businessIds }, db) => {
    const ids = uuidList(businessIds);
    const counts = new Map<string, { business_id: string; source: string; n: number }>();
    for (const [table, column, source] of BRANCHES) {
      for (const row of await db.whereIn(table, column as never, ids)) {
        const businessId = (row as unknown as Record<string, unknown>)[column] as string;
        const key = `${businessId}|${source}`;
        const entry = counts.get(key);
        if (entry) entry.n++;
        else counts.set(key, { business_id: businessId, source, n: 1 });
      }
    }
    return [...counts.values()].map(({ business_id, source, n }) => ({
      business_id,
      source,
      count: countText(n),
    }));
  },
);
