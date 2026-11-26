/** Row shapes for LEFT JOINs: every column of a table set to NULL. */
import { tableInfo, type Row, type TableName } from '../../../catalog.js';

const cache = new Map<string, Record<string, null>>();

/** `t.*` of a LEFT JOIN that found no row: each column of the table, NULL. */
export function nullRowOf<T extends TableName>(table: T): { [K in keyof Row<T>]: null } {
  let row = cache.get(table);
  if (!row) {
    row = Object.fromEntries(tableInfo(table).columns.map(c => [c.name, null]));
    cache.set(table, row);
  }
  return { ...row } as never;
}

/** The column names of a table, in table order. */
export function columnsOf(table: TableName): string[] {
  return tableInfo(table).columns.map(c => c.name);
}
