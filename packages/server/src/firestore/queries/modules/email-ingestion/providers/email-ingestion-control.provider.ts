import { emailMatchesCandidate, jsonbElementText } from '../_helpers.js';
import type {
  IConsumeGrantByJtiQuery,
  IGetActiveAliasesForTenantQuery,
  IGetAliasByAliasQuery,
  IGetBusinessByEmailForIngestQuery,
  IGetGrantByJtiForValidationQuery,
  IGetTenantOwnBusinessForIngestQuery,
  IInsertIngestGrantQuery,
} from '../../../../../modules/email-ingestion/__generated__/email-ingestion-control.types.js';
import { port } from '../../../port.js';

/**
 * SELECT owner_id FROM email_ingestion_alias_routing WHERE lower(alias) = $alias AND is_active =
 * TRUE LIMIT 1
 *
 * At most one active alias per lower(alias) (unique index), so LIMIT 1 picks no favourite.
 */
export const getAliasByAlias = port<IGetAliasByAliasQuery>(async ({ alias }, db) => {
  if (alias == null) return [];
  return (await db.rows('email_ingestion_alias_routing'))
    .filter(row => row.is_active === true && row.alias.toLowerCase() === alias)
    .slice(0, 1)
    .map(row => ({ owner_id: row.owner_id }));
});

/**
 * INSERT INTO email_ingestion_grants (jti, owner_id, message_id, raw_message_hash, action,
 * expires_at, business_id, classification) VALUES (...) RETURNING id, jti, owner_id, action,
 * expires_at, business_id, classification
 */
export const insertIngestGrant = port<IInsertIngestGrantQuery>(async (params, db) => {
  const row = await db.insert('email_ingestion_grants', {
    jti: (params.jti ?? null) as string,
    owner_id: (params.ownerId ?? null) as string,
    message_id: (params.messageId ?? null) as string,
    raw_message_hash: (params.rawMessageHash ?? null) as string,
    action: (params.action ?? null) as string,
    expires_at: (params.expiresAt ?? null) as Date,
    business_id: params.businessId ?? null,
    classification: params.classification ?? null,
  });
  if (!row) return [];
  return [
    {
      id: row.id,
      jti: row.jti,
      owner_id: row.owner_id,
      action: row.action,
      expires_at: row.expires_at,
      business_id: row.business_id,
      classification: row.classification,
    },
  ];
});

/**
 * SELECT id, suggestion_data FROM businesses
 * WHERE EXISTS (
 *   SELECT 1 FROM jsonb_array_elements_text(
 *     CASE WHEN jsonb_typeof(suggestion_data->'emails') = 'array' THEN suggestion_data->'emails'
 *          ELSE '[]'::jsonb END) AS candidate
 *   WHERE lower($email) LIKE replace(replace(replace(replace(lower(candidate), '#', '##'), '%',
 *         '#%'), '_', '#_'), '*', '%') ESCAPE '#')
 * LIMIT 1
 *
 * LIMIT without ORDER BY: when several businesses match, Postgres returns whichever it reads first.
 */
export const getBusinessByEmailForIngest = port<IGetBusinessByEmailForIngestQuery>(
  async ({ email }, db) => {
    if (email == null) return [];
    for (const business of await db.rows('businesses')) {
      const data = business.suggestion_data as Record<string, unknown> | null;
      const emails =
        data && typeof data === 'object' && !Array.isArray(data) && Array.isArray(data.emails)
          ? data.emails
          : [];
      const match = emails.some(element => {
        const candidate = jsonbElementText(element);
        return candidate != null && emailMatchesCandidate(email, candidate);
      });
      if (match) return [{ id: business.id, suggestion_data: business.suggestion_data }];
    }
    return [];
  },
);

/**
 * SELECT alias FROM email_ingestion_alias_routing WHERE owner_id = $ownerId AND is_active = TRUE
 */
export const getActiveAliasesForTenant = port<IGetActiveAliasesForTenantQuery>(
  async ({ ownerId }, db) => {
    if (ownerId == null) return [];
    return (await db.where('email_ingestion_alias_routing', { owner_id: ownerId }))
      .filter(row => row.is_active === true)
      .map(row => ({ alias: row.alias }));
  },
);

/**
 * SELECT fe.name, b.hebrew_name, b.suggestion_data FROM businesses b INNER JOIN financial_entities
 * fe ON fe.id = b.id WHERE b.id = $tenantId LIMIT 1
 */
export const getTenantOwnBusinessForIngest = port<IGetTenantOwnBusinessForIngestQuery>(
  async ({ tenantId }, db) => {
    if (tenantId == null) return [];
    for (const b of await db.where('businesses', { id: tenantId })) {
      for (const fe of await db.where('financial_entities', { id: b.id })) {
        return [{ name: fe.name, hebrew_name: b.hebrew_name, suggestion_data: b.suggestion_data }];
      }
    }
    return [];
  },
);

/**
 * SELECT id, jti, owner_id, message_id, raw_message_hash, action, expires_at, consumed_at,
 * business_id, classification FROM email_ingestion_grants WHERE jti = $jti LIMIT 1
 */
export const getGrantByJtiForValidation = port<IGetGrantByJtiForValidationQuery>(
  async ({ jti }, db) => {
    if (jti == null) return [];
    return (await db.where('email_ingestion_grants', { jti })).slice(0, 1).map(row => ({
      id: row.id,
      jti: row.jti,
      owner_id: row.owner_id,
      message_id: row.message_id,
      raw_message_hash: row.raw_message_hash,
      action: row.action,
      expires_at: row.expires_at,
      consumed_at: row.consumed_at,
      business_id: row.business_id,
      classification: row.classification,
    }));
  },
);

/**
 * UPDATE email_ingestion_grants SET consumed_at = NOW() WHERE jti = $jti AND consumed_at IS NULL
 * RETURNING id
 */
export const consumeGrantByJti = port<IConsumeGrantByJtiQuery>(async ({ jti }, db) => {
  if (jti == null) return [];
  const result: { id: string }[] = [];
  for (const row of await db.where('email_ingestion_grants', { jti })) {
    if (row.consumed_at != null) continue;
    const updated = await db.update('email_ingestion_grants', row, { consumed_at: db.ctx.now });
    result.push({ id: updated.id });
  }
  return result;
});
