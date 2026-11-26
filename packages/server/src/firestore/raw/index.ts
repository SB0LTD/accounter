/**
 * Raw SQL statements the server sends with `client.query('...')` rather than through pgTyped, and
 * their ports (statements.ts). Matched by the statement text with whitespace collapsed.
 */
import { RAW_STATEMENTS } from './statements.js';
import type { RawStatement } from './types.js';

export type { RawStatement } from './types.js';

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim().replace(/;$/, '');

export function findRawStatement(text: string): RawStatement | null {
  const normalized = normalize(text);
  for (const statement of RAW_STATEMENTS) {
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
