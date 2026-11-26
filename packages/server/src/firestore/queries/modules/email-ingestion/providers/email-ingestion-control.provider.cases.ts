import { F080 } from '../_fixture-ids.js';
import type {
  IConsumeGrantByJtiQuery,
  IGetActiveAliasesForTenantQuery,
  IGetAliasByAliasQuery,
  IGetBusinessByEmailForIngestQuery,
  IGetGrantByJtiForValidationQuery,
  IGetTenantOwnBusinessForIngestQuery,
  IInsertIngestGrantQuery,
} from '../../../../../modules/email-ingestion/__generated__/email-ingestion-control.types.js';
import { caseFor, type Cases } from '../../../cases.js';

export const cases: Cases = {
  getAliasByAlias: caseFor<IGetAliasByAliasQuery>(() => [
    { alias: 'billing080' },
    { alias: 'zz-sister080' },
    // Inactive
    { alias: 'old080' },
    // The parameter is compared as given, to lower(alias)
    { alias: 'bILLING080' },
    { alias: null },
  ]),
  insertIngestGrant: caseFor<IInsertIngestGrantQuery>(s => {
    const base = {
      jti: 'jti080-new',
      ownerId: s.businessId,
      messageId: 'msg080-new',
      rawMessageHash: 'raw080-new',
      action: 'ingest',
      expiresAt: new Date('2099-02-01T00:00:00Z'),
      businessId: F080.vendor,
      classification: 'receipt',
    };
    return [
      base,
      { ...base, businessId: null, classification: null },
      // Duplicate jti
      { ...base, jti: 'jti080-open' },
      // Another tenant's grant
      { ...base, ownerId: F080.sister },
      // NOT NULL action (listed, so no default)
      { ...base, action: null },
    ];
  }),
  getBusinessByEmailForIngest: caseFor<IGetBusinessByEmailForIngestQuery>(() => [
    { email: 'BILLING@sister080.example' },
    // `*` is a wildcard
    { email: 'someone@WILD080.example' },
    // `%` and `_` in a candidate are literal
    { email: 'pct%_080@vendor.example' },
    { email: 'pctXY080@vendor.example' },
    { email: 'hash#080@vendor.example' },
    // A non-string element matches by its text
    { email: '42' },
    // `emails` is not an array
    { email: 'notalist080@odd.example' },
    { email: null },
  ]),
  getActiveAliasesForTenant: caseFor<IGetActiveAliasesForTenantQuery>(s => [
    { ownerId: s.businessId },
    { ownerId: F080.sister },
    { ownerId: s.missingId },
  ]),
  getTenantOwnBusinessForIngest: caseFor<IGetTenantOwnBusinessForIngestQuery>(s => [
    { tenantId: s.businessId },
    { tenantId: F080.sister },
    { tenantId: s.missingId },
  ]),
  getGrantByJtiForValidation: caseFor<IGetGrantByJtiForValidationQuery>(() => [
    { jti: 'jti080-open' },
    { jti: 'jti080-consumed' },
    // Another tenant's grant
    { jti: 'jti080-sister' },
    { jti: 'no-such-jti' },
  ]),
  consumeGrantByJti: caseFor<IConsumeGrantByJtiQuery>(() => [
    { jti: 'jti080-open' },
    { jti: 'jti080-consumed' },
    { jti: 'jti080-sister' },
  ]),
};
