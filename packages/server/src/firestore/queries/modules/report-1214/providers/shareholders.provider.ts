import type {
  ICopyShareholdersQuery,
  IDeleteShareholdersByOwnerAndYearQuery,
  IGetShareholdersByOwnerAndYearsQuery,
  IInsertShareholdersQuery,
  ILockShareholdersOfOwnerAndYearQuery,
} from '../../../../../modules/report-1214/__generated__/shareholders.types.js';
import type { Row } from '../../../../catalog.js';
import type { QueryDb } from '../../../../query-db.js';
import { orderBy, sqlEquals, unnestZip } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';
import { uuidOrder } from '../../reports/_helpers.js';
import { intParam, numericParam, numericTypmod, varcharParam } from '../../reports/_params.js';

type Shareholder = Row<'shareholders'>;

const bySortOrderThenId = (rows: readonly Shareholder[]) =>
  orderBy(rows, [{ value: r => r.sort_order }, { value: r => uuidOrder(r.id) }]);

/** `WHERE owner_id = $ownerId AND year = $year` */
async function shareholdersOf(db: QueryDb, ownerId: unknown, year: number | null) {
  if (ownerId == null || year == null) return [];
  return (await db.where('shareholders', { owner_id: ownerId as string })).filter(s =>
    sqlEquals(s.year, year),
  );
}

/**
 * SELECT s.* FROM shareholders s
 * WHERE (s.owner_id, s.year) IN (
 *   SELECT k.owner_id, k.year FROM unnest($ownerIds::uuid[], $years::smallint[]) AS k(owner_id, year))
 * ORDER BY s.sort_order, s.id
 */
export const getShareholdersByOwnerAndYears = port<IGetShareholdersByOwnerAndYearsQuery>(
  async ({ ownerIds, years }, db) => {
    const yearValues = (years ?? []).map(y => intParam(y, 'smallint'));
    const pairs = unnestZip(ownerIds ?? [], yearValues).filter(
      ([owner, year]) => owner != null && year != null,
    );
    if (pairs.length === 0) return [];
    const rows = (
      await db.whereIn(
        'shareholders',
        'owner_id',
        pairs.map(([owner]) => owner),
      )
    ).filter(row =>
      pairs.some(([owner, year]) => sqlEquals(row.owner_id, owner) && sqlEquals(row.year, year)),
    );
    return bySortOrderThenId(rows);
  },
);

/**
 * SELECT pg_advisory_xact_lock(hashtextextended(format('shareholders:%s:%s', $ownerId::uuid,
 * $year::int), 0)) AS locked
 *
 * One row whose `locked` is the void result, which pg returns as ''. The lock has no counterpart:
 * the store's writes go through one process and commit with preconditions on what they read.
 */
export const lockShareholdersOfOwnerAndYear = port<ILockShareholdersOfOwnerAndYearQuery>(
  async ({ year }) => {
    intParam(year, 'integer');
    return [{ locked: '' as never }];
  },
);

/** DELETE FROM shareholders WHERE owner_id = $ownerId AND year = $year */
export const deleteShareholdersByOwnerAndYear = port<IDeleteShareholdersByOwnerAndYearQuery>(
  async ({ ownerId, year }, db) => {
    for (const row of await shareholdersOf(db, ownerId, intParam(year, 'smallint'))) {
      await db.delete('shareholders', row);
    }
    return [];
  },
);

/**
 * INSERT INTO shareholders (owner_id, year, business_id, id_number, full_name, is_controlling,
 *   dividend_rights_percent, voting_rights_percent, other_rights_percent, is_material,
 *   salary_months_1_to_9, salary_months_10_to_12, other_payments, sort_order)
 * VALUES $$shareholders(ownerId, year, businessId, idNumber, fullName, isControlling,
 *   dividendRightsPercent, votingRightsPercent, otherRightsPercent, isMaterial, salaryMonths1To9,
 *   salaryMonths10To12, otherPayments, sortOrder)
 * RETURNING *
 *
 * Rows go in one by one, in order, each formed as Postgres forms it: id_number is varchar(9), the
 * three percents numeric(7,4) (rounded to 4 places, 22003 past 999.9999), sort_order an integer.
 */
export const insertShareholders = port<IInsertShareholdersQuery>(async ({ shareholders }, db) => {
  const result: Shareholder[] = [];
  for (const s of shareholders) {
    const values = {
      owner_id: s.ownerId ?? null,
      year: intParam(s.year, 'smallint'),
      business_id: s.businessId ?? null,
      id_number: varcharParam(s.idNumber, 9),
      full_name: s.fullName ?? null,
      is_controlling: s.isControlling ?? null,
      dividend_rights_percent: numericTypmod(s.dividendRightsPercent, 7, 4),
      voting_rights_percent: numericTypmod(s.votingRightsPercent, 7, 4),
      other_rights_percent: numericTypmod(s.otherRightsPercent, 7, 4),
      is_material: s.isMaterial ?? null,
      salary_months_1_to_9: numericParam(s.salaryMonths1To9),
      salary_months_10_to_12: numericParam(s.salaryMonths10To12),
      other_payments: numericParam(s.otherPayments),
      sort_order: intParam(s.sortOrder, 'integer'),
    };
    const row = await db.insert('shareholders', values as Partial<Shareholder>);
    if (row) result.push(row);
  }
  return result;
});

/**
 * INSERT INTO shareholders (owner_id, year, business_id, ..., sort_order)
 * SELECT s.owner_id, $toYear, s.business_id, ..., s.sort_order
 * FROM shareholders s WHERE s.owner_id = $ownerId AND s.year = $fromYear
 * ORDER BY s.sort_order, s.id
 * RETURNING *
 *
 * Rows are inserted, and returned, in the SELECT's order.
 */
export const copyShareholders = port<ICopyShareholdersQuery>(
  async ({ ownerId, fromYear, toYear }, db) => {
    const targetYear = intParam(toYear, 'smallint');
    const source = bySortOrderThenId(
      await shareholdersOf(db, ownerId, intParam(fromYear, 'smallint')),
    );
    const result: Shareholder[] = [];
    for (const s of source) {
      const row = await db.insert('shareholders', {
        owner_id: s.owner_id,
        year: targetYear as never,
        business_id: s.business_id,
        id_number: s.id_number,
        full_name: s.full_name,
        is_controlling: s.is_controlling,
        dividend_rights_percent: s.dividend_rights_percent,
        voting_rights_percent: s.voting_rights_percent,
        other_rights_percent: s.other_rights_percent,
        is_material: s.is_material,
        salary_months_1_to_9: s.salary_months_1_to_9,
        salary_months_10_to_12: s.salary_months_10_to_12,
        other_payments: s.other_payments,
        sort_order: s.sort_order,
      });
      if (row) result.push(row);
    }
    return result;
  },
);
