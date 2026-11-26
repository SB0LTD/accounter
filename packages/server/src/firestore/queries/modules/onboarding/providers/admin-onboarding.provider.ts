import type {
  IExpireActiveInvitationsQuery,
  IGetBootstrapBusinessQuery,
  IGetBootstrapContextQuery,
  ISetRlsContextQuery,
  ISetSelfOwnerQuery,
} from '../../../../../modules/onboarding/__generated__/admin-onboarding.types.js';
import { port } from '../../../port.js';

/**
 * SELECT set_config('app.current_business_id', $businessId, true) as "current_business_id",
 *        set_config('app.current_business_scope', ARRAY[$businessId]::text, true) as
 *        "current_business_scope"
 *
 * Sets the request session's tenant through `db.setConfig` (transaction-local, as `true` asks), so
 * the rest of the bootstrap runs as the new business. set_config with NULL sets (and returns) '',
 * and `ARRAY[NULL]::text` is '{NULL}'.
 */
export const setRlsContext = port<ISetRlsContextQuery>(async ({ businessId }, db) => {
  // `ARRAY[$businessId]::text`: '{<id>}', or '{NULL}' for NULL.
  const scope = `{${businessId ?? 'NULL'}}`;
  return [
    {
      current_business_id: db.setConfig('app.current_business_id', businessId ?? null, true),
      current_business_scope: db.setConfig('app.current_business_scope', scope, true),
    },
  ];
});

/**
 * UPDATE financial_entities SET owner_id = $id WHERE id = $id
 *
 * RLS: the row must be readable (owner in scope, or `id = current business`) and the new row must
 * be owned by, or be, the current business: the store raises 42501 for any other id, as Postgres
 * does.
 */
export const setSelfOwner = port<ISetSelfOwnerQuery>(async ({ id }, db) => {
  if (id == null) return [];
  for (const entity of await db.where('financial_entities', { id })) {
    await db.update('financial_entities', entity, { owner_id: id });
  }
  return [];
});

/**
 * SELECT fe.*, b.vat_number, b.hebrew_name, b.address, b.address_hebrew, b.email, b.website,
 *        b.phone_number, b.country, b.no_invoices_required, b.suggestion_data,
 *        b.can_settle_with_receipt, b.exempt_dealer, b.optional_vat, b.pcn874_record_type_override,
 *        b.city, b.zip_code
 * FROM businesses b INNER JOIN financial_entities fe USING (id) WHERE b.id = $id
 */
export const getBootstrapBusiness = port<IGetBootstrapBusinessQuery>(async ({ id }, db) => {
  if (id == null) return [];
  const result = [];
  for (const b of await db.where('businesses', { id })) {
    for (const fe of await db.where('financial_entities', { id: b.id })) {
      result.push({
        ...fe,
        vat_number: b.vat_number,
        hebrew_name: b.hebrew_name,
        address: b.address,
        address_hebrew: b.address_hebrew,
        email: b.email,
        website: b.website,
        phone_number: b.phone_number,
        country: b.country,
        no_invoices_required: b.no_invoices_required,
        suggestion_data: b.suggestion_data,
        can_settle_with_receipt: b.can_settle_with_receipt,
        exempt_dealer: b.exempt_dealer,
        optional_vat: b.optional_vat,
        pcn874_record_type_override: b.pcn874_record_type_override,
        city: b.city,
        zip_code: b.zip_code,
      });
    }
  }
  return result as never;
});

/** SELECT * FROM user_context WHERE owner_id = $ownerId */
export const getBootstrapContext = port<IGetBootstrapContextQuery>(async ({ ownerId }, db) => {
  if (ownerId == null) return [];
  return (await db.where('user_context', { owner_id: ownerId })) as never;
});

/**
 * UPDATE invitations SET expires_at = NOW(), accepted_at = NOW() WHERE business_id = $businessId
 *   AND lower(email) = lower($email) AND accepted_at IS NULL AND expires_at > NOW()
 */
export const expireActiveInvitations = port<IExpireActiveInvitationsQuery>(
  async ({ businessId, email }, db) => {
    if (businessId == null || email == null) return [];
    const now = db.ctx.now;
    const wanted = email.toLowerCase();
    for (const invitation of await db.where('invitations', { business_id: businessId })) {
      if (
        invitation.email.toLowerCase() === wanted &&
        invitation.accepted_at == null &&
        invitation.expires_at.getTime() > now.getTime()
      ) {
        await db.update('invitations', invitation, { expires_at: now, accepted_at: now });
      }
    }
    return [];
  },
);
