import type {
  IDeleteProviderCredentialsQuery,
  IGetProviderCredentialPayloadQuery,
  IIsOwnBusinessQuery,
  ISetProviderBusinessQuery,
  IUpsertProviderCredentialsQuery,
} from '../../../../../modules/provider-credentials/__generated__/provider-credentials.types.js';
import { caseFor, type Cases } from '../../../cases.js';

/** Fixture rows of scripts/firestore/fixtures/080-auth-email.sql. */
const VENDOR = '0f080000-0000-4000-8000-000000000002';
const SECURITY = '0f080000-0000-4000-8000-000000000004';
/** A business owned by the sister business: outside the demo tenant's scope. */
const SISTER_SECURITY = '0f080000-0000-4000-8000-000000000005';

export const cases: Cases = {
  upsertProviderCredentials: caseFor<IUpsertProviderCredentialsQuery>(s => [
    // New
    { provider: 'deel', encrypted: 'enc080-deel', businessId: null },
    // Existing: payload replaced, business kept (COALESCE)
    { provider: 'green_invoice', encrypted: 'enc080-new', businessId: null },
    { provider: 'green_invoice', encrypted: 'enc080-new', businessId: SECURITY },
    // Unknown business
    { provider: 'deel', encrypted: 'enc080-deel', businessId: s.missingId },
    // NOT NULL payload
    { provider: 'deel', encrypted: null, businessId: null },
  ]),
  isOwnBusiness: caseFor<IIsOwnBusinessQuery>(s => [
    { businessId: VENDOR },
    { businessId: s.businessId },
    { businessId: SISTER_SECURITY },
    { businessId: s.missingId },
    { businessId: null },
  ]),
  setProviderBusiness: caseFor<ISetProviderBusinessQuery>(s => [
    { businessId: SECURITY, provider: 'green_invoice' },
    { businessId: null, provider: 'green_invoice' },
    // Not the tenant's business: no row
    { businessId: SISTER_SECURITY, provider: 'green_invoice' },
    { businessId: s.missingId, provider: 'green_invoice' },
    // Not connected
    { businessId: VENDOR, provider: 'deel' },
    // Not a uuid: the cast fails
    { businessId: 'not-a-uuid', provider: 'green_invoice' },
  ]),
  deleteProviderCredentials: caseFor<IDeleteProviderCredentialsQuery>(() => [
    { provider: 'green_invoice' },
    { provider: 'deel' },
  ]),
  getProviderCredentialPayload: caseFor<IGetProviderCredentialPayloadQuery>(() => [
    { provider: 'green_invoice' },
    { provider: 'deel' },
  ]),
};
