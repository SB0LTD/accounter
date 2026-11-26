/**
 * Helpers shared by the email-ingestion module's ports.
 */
import type { Row } from '../../../catalog.js';
import { DbError } from '../../../errors.js';
import type { QueryDb } from '../../../query-db.js';

type AliasRow = Row<'email_ingestion_alias_routing'>;

/** `RETURNING id, alias, owner_id, is_active, created_at, updated_at` */
export function aliasColumns(row: AliasRow) {
  return {
    id: row.id,
    alias: row.alias,
    owner_id: row.owner_id,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * The rows an UPDATE or DELETE may touch: policy `tenant_isolation_write` is
 * `USING (owner_id = get_current_business_id())`, so other tenants' aliases are skipped. The
 * policy calls get_current_business_id(), which raises without a business context.
 */
export function writableAliases(db: QueryDb, rows: readonly AliasRow[]): AliasRow[] {
  if (rows.length === 0) return [];
  const businessId = db.ctx.businessId;
  if (!businessId) {
    throw new DbError('No business context set - authentication required', 'P0001');
  }
  return rows.filter(row => row.owner_id === businessId);
}

/**
 * `jsonb_array_elements_text(...)` of one element: strings as they are, JSON null as SQL NULL,
 * anything else as its jsonb text.
 */
export function jsonbElementText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  return jsonbText(value);
}

/** jsonb's text output: `{"a": 1, "b": [1, 2]}` (a space after `:` and `,`). */
function jsonbText(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `[${value.map(jsonbText).join(', ')}]`;
  if (typeof value === 'object') {
    // jsonb keeps object keys sorted by length, then bytewise.
    const keys = Object.keys(value as object).sort((a, b) =>
      a.length !== b.length ? a.length - b.length : a < b ? -1 : a > b ? 1 : 0,
    );
    return `{${keys
      .map(k => `${JSON.stringify(k)}: ${jsonbText((value as Record<string, unknown>)[k])}`)
      .join(', ')}}`;
  }
  return JSON.stringify(value);
}

/**
 * `lower($email) LIKE replace(replace(replace(replace(lower(candidate), '#', '##'), '%', '#%'),
 * '_', '#_'), '*', '%') ESCAPE '#'`: the candidate matches literally, except that `*` matches any
 * run of characters.
 */
export function emailMatchesCandidate(email: string, candidate: string): boolean {
  const source = [...candidate.toLowerCase()]
    .map(ch => (ch === '*' ? '[\\s\\S]*' : ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('');
  return new RegExp(`^${source}$`, 'u').test(email.toLowerCase());
}
