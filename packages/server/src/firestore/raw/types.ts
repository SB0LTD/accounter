import type { QueryDb } from '../query-db.js';

export interface RawStatement {
  /** The statement, or a pattern over its whitespace-collapsed text (trailing `;` removed). */
  match: string | RegExp;
  /** The command tag pg reports (`SELECT`, `DELETE`, ...). */
  command: string;
  /** Runs the port with the positional parameters ($1 = values[0]). */
  run: (values: unknown[], db: QueryDb) => Promise<Record<string, unknown>[]>;
}
