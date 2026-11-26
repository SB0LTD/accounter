import type {
  IDeleteProviderCredentialsQuery,
  IGetProviderCredentialPayloadQuery,
  IGetProviderStatusesQuery,
  IIsOwnBusinessQuery,
  ISetProviderBusinessQuery,
  IUpsertProviderCredentialsQuery,
} from '../../../../../modules/provider-credentials/__generated__/provider-credentials.types.js';
import { DbError } from '../../../../errors.js';
import type { QueryDb } from '../../../../query-db.js';
import { coalesce } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';

/** `accounter_schema.get_current_business_id()`: raises when no business context is set. */
function currentBusinessId(db: QueryDb): string {
  const businessId = db.ctx.businessId;
  if (!businessId) {
    throw new DbError('No business context set - authentication required', 'P0001');
  }
  return businessId;
}

const UUID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

/** `$param::uuid`: Postgres refuses text that is not a uuid (22P02). */
function assertUuid(value: string | null | undefined | void) {
  if (typeof value === 'string' && !UUID.test(value.trim().replace(/^\{(.*)\}$/, '$1'))) {
    throw new DbError(`invalid input syntax for type uuid: "${value}"`, '22P02');
  }
}

/** The current business's credentials for one provider (`owner_id = current AND provider = $p`). */
async function credentialsOf(db: QueryDb, provider: string | null | undefined | void) {
  const ownerId = currentBusinessId(db);
  if (typeof provider !== 'string') return [];
  return db.where('provider_credentials', { owner_id: ownerId, provider: provider as never });
}

/**
 * INSERT INTO provider_credentials (owner_id, provider, payload, business_id)
 * VALUES (get_current_business_id(), $provider, $encrypted, $businessId)
 * ON CONFLICT (owner_id, provider) DO UPDATE SET payload = EXCLUDED.payload,
 *   business_id = COALESCE(EXCLUDED.business_id, provider_credentials.business_id),
 *   updated_at = now()
 * RETURNING updated_at
 */
export const upsertProviderCredentials = port<IUpsertProviderCredentialsQuery>(
  async ({ provider, encrypted, businessId }, db) => {
    const row = await db.insert(
      'provider_credentials',
      {
        owner_id: currentBusinessId(db),
        provider: (provider ?? null) as never,
        payload: (encrypted ?? null) as string,
        business_id: businessId ?? null,
      },
      {
        target: ['owner_id', 'provider'],
        action: (existing, excluded) => ({
          payload: excluded.payload,
          business_id: coalesce(excluded.business_id, existing.business_id),
          updated_at: db.ctx.now,
        }),
      },
    );
    return row ? [{ updated_at: row.updated_at }] : [];
  },
);

/**
 * SELECT EXISTS (SELECT 1 FROM businesses WHERE id = $businessId AND owner_id =
 * get_current_business_id()) AS "isOwn!"
 *
 * pgTyped strips the `!` hint from the column name, so the row's key is `isOwn`.
 */
export const isOwnBusiness = port<IIsOwnBusinessQuery>(async ({ businessId }, db) => {
  const ownerId = currentBusinessId(db);
  if (businessId == null) return [{ isOwn: false }];
  const rows = await db.where('businesses', { id: businessId });
  return [{ isOwn: rows.some(b => b.owner_id === ownerId) }];
});

/**
 * UPDATE provider_credentials SET business_id = $businessId
 * WHERE owner_id = get_current_business_id() AND provider = $provider
 *   AND ($businessId::uuid IS NULL OR EXISTS (SELECT 1 FROM businesses WHERE id = $businessId
 *        AND owner_id = get_current_business_id()))
 * RETURNING updated_at
 */
export const setProviderBusiness = port<ISetProviderBusinessQuery>(
  async ({ businessId, provider }, db) => {
    assertUuid(businessId);
    const ownerId = currentBusinessId(db);
    const rows = await credentialsOf(db, provider);
    if (rows.length === 0) return [];
    if (businessId != null) {
      const own = (await db.where('businesses', { id: businessId })).some(
        b => b.owner_id === ownerId,
      );
      if (!own) return [];
    }
    const result = [];
    for (const row of rows) {
      const updated = await db.update('provider_credentials', row, {
        business_id: businessId ?? null,
      });
      result.push({ updated_at: updated.updated_at });
    }
    return result;
  },
);

/** DELETE FROM provider_credentials WHERE owner_id = get_current_business_id() AND provider = $provider */
export const deleteProviderCredentials = port<IDeleteProviderCredentialsQuery>(
  async ({ provider }, db) => {
    for (const row of await credentialsOf(db, provider)) {
      await db.delete('provider_credentials', row);
    }
    return [];
  },
);

/**
 * SELECT provider, updated_at, business_id FROM provider_credentials WHERE owner_id =
 * get_current_business_id()
 */
export const getProviderStatuses = port<IGetProviderStatusesQuery>(async (_params, db) =>
  (await db.where('provider_credentials', { owner_id: currentBusinessId(db) })).map(row => ({
    provider: row.provider,
    updated_at: row.updated_at,
    business_id: row.business_id,
  })),
);

/**
 * SELECT payload FROM provider_credentials WHERE owner_id = get_current_business_id() AND provider
 * = $provider
 */
export const getProviderCredentialPayload = port<IGetProviderCredentialPayloadQuery>(
  async ({ provider }, db) =>
    (await credentialsOf(db, provider)).map(row => ({ payload: row.payload })),
);
