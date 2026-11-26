import { isIP } from 'node:net';
import type { IInsertAuditLogQuery } from '../../../../../modules/common/__generated__/audit-logs.types.js';
import { DbError } from '../../../../errors.js';
import { port } from '../../../port.js';

/** `$details::jsonb`: the provider sends JSON text; Postgres parses it (invalid text is 22P02). */
function jsonbParam(value: unknown): unknown {
  if (value == null) return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    throw new DbError('invalid input syntax for type json', '22P02');
  }
}

/** An `inet` parameter: an IPv4/IPv6 address with an optional prefix length, else 22P02. */
function inetParam(value: string | null | undefined | void): string | null {
  if (value == null) return null;
  const [address, prefix, ...rest] = value.split('/');
  const family = isIP(address ?? '');
  const max = family === 4 ? 32 : 128;
  const validPrefix =
    prefix === undefined || (/^\d+$/.test(prefix) && Number(prefix) <= max && rest.length === 0);
  if (family === 0 || !validPrefix) {
    throw new DbError(`invalid input syntax for type inet: "${value}"`, '22P02');
  }
  // inet prints a full-length prefix without the mask.
  return prefix !== undefined && Number(prefix) === max ? address! : value;
}

/**
 * INSERT INTO audit_logs (business_id, user_id, auth0_user_id, action, entity, entity_id, details,
 *   ip_address)
 * VALUES ($ownerId, $userId, $auth0UserId, $action, $entity, $entityId, $details::jsonb, $ipAddress);
 */
export const insertAuditLog = port<IInsertAuditLogQuery>(async (params, db) => {
  const details = jsonbParam(params.details);
  const ipAddress = inetParam(params.ipAddress);
  await db.insert('audit_logs', {
    business_id: params.ownerId ?? null,
    user_id: params.userId ?? null,
    auth0_user_id: params.auth0UserId ?? null,
    action: params.action ?? (null as never),
    entity: params.entity ?? null,
    entity_id: params.entityId ?? null,
    details: details as never,
    ip_address: ipAddress,
  });
  return [];
});
