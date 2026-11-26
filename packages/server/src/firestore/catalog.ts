import type { ColumnMeta, TableMeta } from './schema/catalog-types.js';
import { catalog } from './schema/catalog.generated.js';
import type { TableName, Tables } from './schema/rows.generated.js';

export type { TableName, Tables };
export type Row<T extends TableName = TableName> = Tables[T];
/** A row of any table, as stored and handed to query code. */
export type AnyRow = Record<string, unknown>;

export interface TableInfo extends TableMeta {
  columnByName: Map<string, ColumnMeta>;
  /** Foreign keys of other tables that point at this one. */
  referencedBy: { table: string; fk: TableMeta['foreignKeys'][number] }[];
}

const tables = new Map<string, TableInfo>();
for (const table of catalog.tables) {
  tables.set(table.name, {
    ...table,
    columnByName: new Map(table.columns.map(column => [column.name, column])),
    referencedBy: [],
  });
}
for (const table of catalog.tables) {
  for (const fk of table.foreignKeys) {
    tables.get(fk.refTable)?.referencedBy.push({ table: table.name, fk });
  }
}

export const schemaVersion = catalog.schemaVersion;
export const enums = catalog.enums;

export function tableInfo(name: string): TableInfo {
  const info = tables.get(name);
  if (!info) throw new Error(`relation "accounter_schema.${name}" does not exist`);
  return info;
}

export function allTables(): TableInfo[] {
  return [...tables.values()];
}
