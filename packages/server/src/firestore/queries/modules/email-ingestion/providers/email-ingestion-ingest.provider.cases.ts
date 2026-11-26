import { F080 } from '../_fixture-ids.js';
import type {
  ICheckDedupFingerprintForIngestQuery,
  ICheckDocumentByHashForIngestQuery,
  ICheckIdempotencyKeyForIngestQuery,
  IGetBusinessesForIngestMatchingQuery,
  IGetOwnerLocalityForIngestQuery,
  IInsertDedupFingerprintForIngestQuery,
  IInsertIdempotencyKeyForIngestQuery,
  IInsertIngestChargeQuery,
  IInsertIngestDocumentFullQuery,
  IInsertQuarantineForIngestQuery,
} from '../../../../../modules/email-ingestion/__generated__/email-ingestion-ingest.types.js';
import { caseFor, type Cases } from '../../../cases.js';

export const cases: Cases = {
  checkIdempotencyKeyForIngest: caseFor<ICheckIdempotencyKeyForIngestQuery>(s => [
    { idempotencyKey: 'idem080-1', ownerId: s.businessId },
    // Another tenant's key
    { idempotencyKey: 'idem080-1', ownerId: F080.sister },
    { idempotencyKey: 'no-such-key', ownerId: s.businessId },
  ]),
  insertIdempotencyKeyForIngest: caseFor<IInsertIdempotencyKeyForIngestQuery>(s => [
    {
      idempotencyKey: 'idem080-new',
      ownerId: s.businessId,
      outcome: 'INGESTED',
      ingestId: null,
      auditId: 'audit080-new',
    },
    // Exists: DO NOTHING
    {
      idempotencyKey: 'idem080-1',
      ownerId: s.businessId,
      outcome: 'DUPLICATE',
      ingestId: null,
      auditId: 'audit080-dup',
    },
    // Another tenant's row
    {
      idempotencyKey: 'idem080-1',
      ownerId: F080.sister,
      outcome: 'DUPLICATE',
      ingestId: null,
      auditId: 'audit080-x',
    },
    // NOT NULL outcome
    { idempotencyKey: 'idem080-new-2', ownerId: s.businessId, outcome: null, auditId: 'a' },
  ]),
  checkDedupFingerprintForIngest: caseFor<ICheckDedupFingerprintForIngestQuery>(s => [
    { ownerId: s.businessId, fingerprint: 'fp080-1' },
    { ownerId: F080.sister, fingerprint: 'fp080-1' },
    { ownerId: s.businessId, fingerprint: 'no-such-fp' },
  ]),
  insertDedupFingerprintForIngest: caseFor<IInsertDedupFingerprintForIngestQuery>(s => [
    {
      ownerId: s.businessId,
      fingerprint: 'fp080-new',
      outcome: 'QUARANTINED',
      ingestId: null,
      correlationId: 'corr080-new',
    },
    // Exists: DO NOTHING
    {
      ownerId: s.businessId,
      fingerprint: 'fp080-1',
      outcome: 'DUPLICATE',
      ingestId: null,
      correlationId: null,
    },
    {
      ownerId: F080.sister,
      fingerprint: 'fp080-new',
      outcome: 'INGESTED',
      ingestId: null,
      correlationId: null,
    },
  ]),
  insertQuarantineForIngest: caseFor<IInsertQuarantineForIngestQuery>(s => [
    {
      reasonCode: 'UNKNOWN_ALIAS',
      tenantCandidate: s.businessId,
      messageId: 'msg080-q',
      rawMessageHash: null,
      correlationId: 'corr080-q',
    },
    // The policy needs tenant_candidate = the current business
    {
      reasonCode: 'UNKNOWN_ALIAS',
      tenantCandidate: null,
      messageId: null,
      rawMessageHash: null,
      correlationId: 'corr080-q2',
    },
    {
      reasonCode: 'UNKNOWN_ALIAS',
      tenantCandidate: F080.sister,
      messageId: null,
      rawMessageHash: null,
      correlationId: 'corr080-q3',
    },
    // NOT NULL correlation_id
    {
      reasonCode: 'UNKNOWN_ALIAS',
      tenantCandidate: s.businessId,
      messageId: null,
      rawMessageHash: null,
      correlationId: null,
    },
  ]),
  getBusinessesForIngestMatching: caseFor<IGetBusinessesForIngestMatchingQuery>(s => [
    { ownerId: s.businessId },
    // The sister's own row is readable; the businesses it owns are not
    { ownerId: F080.sister },
    { ownerId: s.missingId },
  ]),
  getOwnerLocalityForIngest: caseFor<IGetOwnerLocalityForIngestQuery>(s => [
    { ownerId: s.businessId },
    { ownerId: s.missingId },
  ]),
  checkDocumentByHashForIngest: caseFor<ICheckDocumentByHashForIngestQuery>(s => [
    { ownerId: s.businessId, fileHash: 'hash080-doc' },
    { ownerId: s.businessId, fileHash: 'no-such-hash' },
  ]),
  insertIngestCharge: caseFor<IInsertIngestChargeQuery>(s => [
    { ownerId: s.businessId, accountantStatus: 'UNAPPROVED', userDescription: 'Email 080' },
    { ownerId: s.businessId, accountantStatus: null, userDescription: 'Email 080' },
    { ownerId: F080.sister, accountantStatus: 'UNAPPROVED', userDescription: null },
  ]),
  insertIngestDocumentFull: caseFor<IInsertIngestDocumentFullQuery>(s => {
    const full = {
      ownerId: s.businessId,
      chargeId: s.ids('charges', 1)[0] ?? null,
      documentType: 'INVOICE' as const,
      fileUrl: 'https://files.example/080.pdf',
      imageUrl: 'https://files.example/080.png',
      fileHash: 'hash080-new-doc',
      serialNumber: 'INV-080',
      date: '2026-01-15' as const,
      amount: 117.5,
      currencyCode: 'USD' as const,
      vat: 17.07,
      vatReportDateOverride: '2026-02-01' as const,
      noVatAmount: '100.43',
      allocationNumber: '123456789',
      exchangeRateOverride: '3.712',
      description: 'From email',
      remarks: 'fixture 080',
      creditorId: F080.vendor,
      debtorId: s.businessId,
    };
    return [
      full,
      { ownerId: s.businessId, chargeId: null, documentType: 'UNPROCESSED' as const },
      // NOT NULL type (listed, so no default)
      { ...full, documentType: null },
      // Unknown charge
      { ...full, chargeId: s.missingId },
    ];
  }),
};
