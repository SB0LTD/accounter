/**
 * Raw SQL statements the server sends with `client.query('...')` rather than through pgTyped, and
 * their ports. Matched by the statement text with whitespace collapsed.
 */
import type { QueryDb } from '../query-db.js';

export interface RawStatement {
  /** The statement, whitespace-collapsed, or a pattern for statements built at run time. */
  match: string | RegExp;
  command: string;
  run: (values: unknown[], db: QueryDb) => Promise<Record<string, unknown>[]>;
}

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim().replace(/;$/, '');

const STATEMENTS: RawStatement[] = [];

export function registerRaw(statement: RawStatement) {
  STATEMENTS.push(statement);
}

export function findRawStatement(text: string): RawStatement | null {
  const normalized = normalize(text);
  for (const statement of STATEMENTS) {
    if (
      typeof statement.match === 'string'
        ? normalize(statement.match) === normalized
        : statement.match.test(normalized)
    ) {
      return statement;
    }
  }
  return null;
}
