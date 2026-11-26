/**
 * Helpers shared by the auth module's ports.
 */
import { DbError } from '../../../errors.js';
import type { QueryDb } from '../../../query-db.js';

/** A new object with only the named columns of a row (`SELECT a, b ...`). */
export function pick<T extends object, K extends keyof T>(
  row: T,
  columns: readonly K[],
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const column of columns) result[column] = row[column];
  return result;
}

const UUID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

/** `$param::uuid`: the value, or Postgres's 22P02 for text that is not a uuid. */
export function castUuid(value: string | null | undefined | void): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim().replace(/^\{(.*)\}$/, '$1');
  if (!UUID.test(text)) {
    throw new DbError(`invalid input syntax for type uuid: "${value}"`, '22P02');
  }
  return text.toLowerCase();
}

/** `col > NOW()` for a timestamp column (NULL is never greater). */
export function afterNow(value: Date | null | undefined, db: QueryDb): boolean {
  return value != null && value.getTime() > db.ctx.now.getTime();
}

/**
 * The newest invitation email of a membership:
 * `(SELECT i.email FROM invitations i WHERE i.user_id = bu.user_id AND i.business_id = bu.business_id
 *   ORDER BY i.created_at DESC LIMIT 1)`.
 */
export async function fallbackEmail(
  db: QueryDb,
  userId: string,
  businessId: string,
): Promise<string | null> {
  let newest: { email: string; created_at: Date } | null = null;
  for (const invitation of await db.where('invitations', {
    user_id: userId,
    business_id: businessId,
  })) {
    if (!newest || invitation.created_at.getTime() > newest.created_at.getTime()) {
      newest = invitation;
    }
  }
  return newest?.email ?? null;
}
