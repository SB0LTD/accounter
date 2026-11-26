/**
 * Test cases for ported queries: parameter sets the verification harness runs against both
 * Postgres and the Firestore store (scripts/firestore/verify.ts).
 *
 * A port file `queries/<path>.ts` gets a sibling `queries/<path>.cases.ts`:
 *
 *   export const cases: Cases = {
 *     getChargesByIds: caseFor<IGetChargesByIdsQuery>(s => [
 *       { chargeIds: s.ids('charges') },
 *       { chargeIds: [s.missingId] },
 *     ]),
 *   };
 *
 * Cases files are not part of the production build.
 */
import type { AnyRow, TableName } from '../catalog.js';
import type { QueryShape } from './run.js';

/** The dataset the harness loaded, for picking realistic parameters. */
export interface Snapshot {
  /** All rows of a table, every tenant included, in primary-key order. */
  rows(table: TableName): readonly AnyRow[];
  /** Up to `n` ids of the table (column `id`), in id order. */
  ids(table: TableName, n?: number): string[];
  /** Up to `n` distinct non-null values of a column, in order. */
  values(table: TableName, column: string, n?: number): unknown[];
  /** The tenant the case runs as. */
  businessId: string;
  /** A user of that tenant. */
  userId: string | null;
  /** A well-formed UUID that matches no row. */
  missingId: string;
}

export type CaseFn = (s: Snapshot) => unknown[];
export type Cases = Record<string, CaseFn>;

/** Types a case function by the pgTyped query it feeds. */
export const caseFor =
  <Q extends QueryShape>(fn: (s: Snapshot) => Q['params'][]): CaseFn =>
  s =>
    fn(s);
