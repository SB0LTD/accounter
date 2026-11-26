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
import type { Row } from '../../../../catalog.js';
import { sqlEquals } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';

const idempotencyColumns = (row: Row<'email_ingestion_idempotency_keys'>) => ({
  id: row.id,
  idempotency_key: row.idempotency_key,
  owner_id: row.owner_id,
  outcome: row.outcome,
  ingest_id: row.ingest_id,
  audit_id: row.audit_id,
  created_at: row.created_at,
});

const dedupColumns = (row: Row<'email_ingestion_dedup_fingerprints'>) => ({
  id: row.id,
  owner_id: row.owner_id,
  fingerprint: row.fingerprint,
  outcome: row.outcome,
  ingest_id: row.ingest_id,
  correlation_id: row.correlation_id,
  created_at: row.created_at,
});

/**
 * SELECT id, idempotency_key, owner_id, outcome, ingest_id, audit_id, created_at FROM
 * email_ingestion_idempotency_keys WHERE idempotency_key = $idempotencyKey AND owner_id = $ownerId
 * LIMIT 1
 */
export const checkIdempotencyKeyForIngest = port<ICheckIdempotencyKeyForIngestQuery>(
  async ({ idempotencyKey, ownerId }, db) => {
    if (idempotencyKey == null || ownerId == null) return [];
    return (
      await db.where('email_ingestion_idempotency_keys', {
        idempotency_key: idempotencyKey,
        owner_id: ownerId,
      })
    )
      .slice(0, 1)
      .map(idempotencyColumns);
  },
);

/**
 * INSERT INTO email_ingestion_idempotency_keys (idempotency_key, owner_id, outcome, ingest_id,
 * audit_id) VALUES (...) ON CONFLICT (idempotency_key, owner_id) DO NOTHING RETURNING id,
 * idempotency_key, owner_id, outcome, ingest_id, audit_id, created_at
 */
export const insertIdempotencyKeyForIngest = port<IInsertIdempotencyKeyForIngestQuery>(
  async ({ idempotencyKey, ownerId, outcome, ingestId, auditId }, db) => {
    const row = await db.insert(
      'email_ingestion_idempotency_keys',
      {
        idempotency_key: (idempotencyKey ?? null) as string,
        owner_id: (ownerId ?? null) as string,
        outcome: (outcome ?? null) as string,
        ingest_id: ingestId ?? null,
        audit_id: (auditId ?? null) as string,
      },
      { target: ['idempotency_key', 'owner_id'], action: 'nothing' },
    );
    return row ? [idempotencyColumns(row)] : [];
  },
);

/**
 * SELECT id, owner_id, fingerprint, outcome, ingest_id, correlation_id, created_at FROM
 * email_ingestion_dedup_fingerprints WHERE owner_id = $ownerId AND fingerprint = $fingerprint LIMIT 1
 */
export const checkDedupFingerprintForIngest = port<ICheckDedupFingerprintForIngestQuery>(
  async ({ ownerId, fingerprint }, db) => {
    if (ownerId == null || fingerprint == null) return [];
    return (
      await db.where('email_ingestion_dedup_fingerprints', { owner_id: ownerId, fingerprint })
    )
      .slice(0, 1)
      .map(dedupColumns);
  },
);

/**
 * INSERT INTO email_ingestion_dedup_fingerprints (owner_id, fingerprint, outcome, ingest_id,
 * correlation_id) VALUES (...) ON CONFLICT (owner_id, fingerprint) DO NOTHING RETURNING id,
 * owner_id, fingerprint, outcome, ingest_id, correlation_id, created_at
 */
export const insertDedupFingerprintForIngest = port<IInsertDedupFingerprintForIngestQuery>(
  async ({ ownerId, fingerprint, outcome, ingestId, correlationId }, db) => {
    const row = await db.insert(
      'email_ingestion_dedup_fingerprints',
      {
        owner_id: (ownerId ?? null) as string,
        fingerprint: (fingerprint ?? null) as string,
        outcome: (outcome ?? null) as string,
        ingest_id: ingestId ?? null,
        correlation_id: correlationId ?? null,
      },
      { target: ['owner_id', 'fingerprint'], action: 'nothing' },
    );
    return row ? [dedupColumns(row)] : [];
  },
);

/**
 * INSERT INTO email_ingestion_quarantine (reason_code, tenant_candidate, message_id,
 * raw_message_hash, correlation_id) VALUES (...) RETURNING id
 *
 * The policy is `tenant_candidate = get_current_business_id()`; the store enforces it on the
 * guard column (42501 otherwise).
 */
export const insertQuarantineForIngest = port<IInsertQuarantineForIngestQuery>(
  async ({ reasonCode, tenantCandidate, messageId, rawMessageHash, correlationId }, db) => {
    const row = await db.insert('email_ingestion_quarantine', {
      reason_code: (reasonCode ?? null) as string,
      tenant_candidate: tenantCandidate ?? null,
      message_id: messageId ?? null,
      raw_message_hash: rawMessageHash ?? null,
      correlation_id: (correlationId ?? null) as string,
    });
    return row ? [{ id: row.id }] : [];
  },
);

/**
 * SELECT b.id, fe.name, b.hebrew_name, b.vat_number, b.suggestion_data, b.country FROM businesses b
 * INNER JOIN financial_entities fe ON fe.id = b.id WHERE b.owner_id = $ownerId OR b.id = $ownerId
 */
export const getBusinessesForIngestMatching = port<IGetBusinessesForIngestMatchingQuery>(
  async ({ ownerId }, db) => {
    const businesses = (await db.rows('businesses')).filter(
      b => sqlEquals(b.owner_id, ownerId) || sqlEquals(b.id, ownerId),
    );
    if (businesses.length === 0) return [];
    const entities = new Map(
      (
        await db.whereIn(
          'financial_entities',
          'id',
          businesses.map(b => b.id),
        )
      ).map(fe => [fe.id, fe]),
    );
    const result = [];
    for (const b of businesses) {
      const fe = entities.get(b.id);
      if (!fe) continue;
      result.push({
        id: b.id,
        name: fe.name,
        hebrew_name: b.hebrew_name,
        vat_number: b.vat_number,
        suggestion_data: b.suggestion_data,
        country: b.country,
      });
    }
    return result;
  },
);

/** SELECT locality FROM user_context WHERE owner_id = $ownerId LIMIT 1 */
export const getOwnerLocalityForIngest = port<IGetOwnerLocalityForIngestQuery>(
  async ({ ownerId }, db) => {
    if (ownerId == null) return [];
    return (await db.where('user_context', { owner_id: ownerId }))
      .slice(0, 1)
      .map(row => ({ locality: row.locality }));
  },
);

/**
 * SELECT id FROM documents WHERE owner_id = $ownerId AND file_hash = $fileHash LIMIT 1
 *
 * LIMIT without ORDER BY: with several documents of the same hash, Postgres returns whichever it
 * reads first.
 */
export const checkDocumentByHashForIngest = port<ICheckDocumentByHashForIngestQuery>(
  async ({ ownerId, fileHash }, db) => {
    if (ownerId == null || fileHash == null) return [];
    return (await db.where('documents', { owner_id: ownerId, file_hash: fileHash }))
      .slice(0, 1)
      .map(row => ({ id: row.id }));
  },
);

/**
 * INSERT INTO charges (owner_id, type, accountant_status, user_description, tax_category_id,
 * optional_vat, documents_optional_flag, is_property) VALUES ($ownerId, NULL, $accountantStatus,
 * $userDescription, NULL, FALSE, FALSE, FALSE) RETURNING id
 */
export const insertIngestCharge = port<IInsertIngestChargeQuery>(
  async ({ ownerId, accountantStatus, userDescription }, db) => {
    const row = await db.insert('charges', {
      owner_id: (ownerId ?? null) as string,
      type: null,
      accountant_status: (accountantStatus ?? null) as never,
      user_description: userDescription ?? null,
      tax_category_id: null,
      optional_vat: false,
      documents_optional_flag: false,
      is_property: false,
    });
    return row ? [{ id: row.id }] : [];
  },
);

/**
 * INSERT INTO documents (owner_id, charge_id, type, file_url, image_url, file_hash, serial_number,
 * date, total_amount, currency_code, vat_amount, vat_report_date_override, no_vat_amount,
 * allocation_number, exchange_rate_override, description, remarks, creditor_id, debtor_id) VALUES
 * ($ownerId, $chargeId, $documentType, $fileUrl, $imageUrl, $fileHash, $serialNumber, $date,
 * $amount, $currencyCode, $vat, $vatReportDateOverride, $noVatAmount, $allocationNumber,
 * $exchangeRateOverride, $description, $remarks, $creditorId, $debtorId) RETURNING id
 */
export const insertIngestDocumentFull = port<IInsertIngestDocumentFullQuery>(async (p, db) => {
  const row = await db.insert('documents', {
    owner_id: (p.ownerId ?? null) as string,
    charge_id: p.chargeId ?? null,
    type: (p.documentType ?? null) as never,
    file_url: p.fileUrl ?? null,
    image_url: p.imageUrl ?? null,
    file_hash: p.fileHash ?? null,
    serial_number: p.serialNumber ?? null,
    date: p.date ?? null,
    total_amount: p.amount ?? null,
    currency_code: (p.currencyCode ?? null) as never,
    vat_amount: p.vat ?? null,
    vat_report_date_override: p.vatReportDateOverride ?? null,
    no_vat_amount: (p.noVatAmount ?? null) as never,
    allocation_number: p.allocationNumber ?? null,
    exchange_rate_override: (p.exchangeRateOverride ?? null) as never,
    description: p.description ?? null,
    remarks: p.remarks ?? null,
    creditor_id: p.creditorId ?? null,
    debtor_id: p.debtorId ?? null,
  });
  return row ? [{ id: row.id }] : [];
});
