import { pick } from '../_helpers.js';
import type {
  IInsertApiKeyQuery,
  IListApiKeysQuery,
  IRevokeApiKeyQuery,
} from '../../../../../modules/auth/__generated__/api-keys.types.js';
import { orderBy } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';

const API_KEY_COLUMNS = ['id', 'name', 'role_id', 'last_used_at', 'created_at'] as const;

/**
 * INSERT INTO api_keys (business_id, role_id, key_hash, name) VALUES ($ownerId, $roleId, $keyHash,
 * $name) RETURNING id, name, role_id, last_used_at, created_at
 */
export const insertApiKey = port<IInsertApiKeyQuery>(
  async ({ ownerId, roleId, keyHash, name }, db) => {
    const row = await db.insert('api_keys', {
      business_id: (ownerId ?? null) as string,
      role_id: (roleId ?? null) as string,
      key_hash: (keyHash ?? null) as string,
      name: (name ?? null) as string,
    });
    return row ? [pick(row, API_KEY_COLUMNS)] : [];
  },
);

/**
 * SELECT id, name, role_id, last_used_at, created_at FROM api_keys WHERE business_id = $ownerId AND
 * revoked_at IS NULL ORDER BY created_at DESC
 */
export const listApiKeys = port<IListApiKeysQuery>(async ({ ownerId }, db) => {
  if (ownerId == null) return [];
  const rows = (await db.where('api_keys', { business_id: ownerId })).filter(
    key => key.revoked_at == null,
  );
  return orderBy(rows, [{ value: key => key.created_at, desc: true }]).map(key =>
    pick(key, API_KEY_COLUMNS),
  );
});

/**
 * UPDATE api_keys SET revoked_at = NOW() WHERE id = $id AND business_id = $ownerId AND revoked_at IS
 * NULL RETURNING id
 */
export const revokeApiKey = port<IRevokeApiKeyQuery>(async ({ id, ownerId }, db) => {
  if (id == null || ownerId == null) return [];
  const result: { id: string }[] = [];
  for (const key of await db.where('api_keys', { id, business_id: ownerId })) {
    if (key.revoked_at != null) continue;
    const updated = await db.update('api_keys', key, { revoked_at: db.ctx.now });
    result.push({ id: updated.id });
  }
  return result;
});
