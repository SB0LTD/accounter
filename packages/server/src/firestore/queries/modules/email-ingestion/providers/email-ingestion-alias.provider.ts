import { aliasColumns, writableAliases } from '../_helpers.js';
import type {
  IGetAliasesQuery,
  IInsertAliasQuery,
  IUpdateAliasActiveQuery,
} from '../../../../../modules/email-ingestion/__generated__/email-ingestion-alias.types.js';
import { inList, orderBy } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';

/**
 * SELECT id, alias, owner_id, is_active, created_at, updated_at FROM email_ingestion_alias_routing
 * WHERE owner_id = ANY($ownerIds) ORDER BY alias ASC
 *
 * Every alias is readable (policy `alias_resolution_select USING (true)`).
 */
export const getAliases = port<IGetAliasesQuery>(async ({ ownerIds }, db) => {
  if (ownerIds == null) return [];
  const owned = inList(ownerIds);
  const rows = (await db.rows('email_ingestion_alias_routing')).filter(row => owned(row.owner_id));
  return orderBy(rows, [{ value: row => row.alias }]).map(aliasColumns);
});

/**
 * INSERT INTO email_ingestion_alias_routing (alias, owner_id) VALUES ($alias, $ownerId) RETURNING
 * id, alias, owner_id, is_active, created_at, updated_at
 */
export const insertAlias = port<IInsertAliasQuery>(async ({ alias, ownerId }, db) => {
  const row = await db.insert('email_ingestion_alias_routing', {
    alias: (alias ?? null) as string,
    owner_id: (ownerId ?? null) as string,
  });
  return row ? [aliasColumns(row)] : [];
});

/**
 * UPDATE email_ingestion_alias_routing SET is_active = $isActive WHERE id = $id RETURNING id, alias,
 * owner_id, is_active, created_at, updated_at
 *
 * Only the current business's aliases are updatable (policy `tenant_isolation_write`); another
 * tenant's alias is skipped, not an error, as in Postgres.
 */
export const updateAliasActive = port<IUpdateAliasActiveQuery>(async ({ id, isActive }, db) => {
  if (id == null) return [];
  const result = [];
  for (const row of writableAliases(db, await db.where('email_ingestion_alias_routing', { id }))) {
    const updated = await db.update('email_ingestion_alias_routing', row, {
      is_active: (isActive ?? null) as boolean,
    });
    result.push(aliasColumns(updated));
  }
  return result;
});
