import {
  dateBound,
  deletableRows,
  enumParam,
  float8Text,
  isZero,
  varcharValue,
} from '../_helpers.js';
import type {
  IDeleteDocumentQuery,
  IFillDocumentFromOcrQuery,
  IGetAllDocumentsQuery,
  IGetAllDocumentsResult,
  IGetDocumentsByBusinessIdsQuery,
  IGetDocumentsByChargeIdQuery,
  IGetDocumentsByExtendedFiltersQuery,
  IGetDocumentsByFiltersQuery,
  IGetDocumentsByHashesQuery,
  IGetDocumentsByIdsQuery,
  IGetDocumentsByMissingRequiredInfoQuery,
  IInsertDocumentsQuery,
  IReplaceDocumentsChargeIdQuery,
  IUpdateDocumentQuery,
} from '../../../../../modules/documents/__generated__/documents.types.js';
import type { Row } from '../../../../catalog.js';
import type { QueryDb } from '../../../../query-db.js';
import { coalescePatch, containsInsensitive, inList, orderBy } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';

/**
 * A `documents` row as the queries return it. (pgTyped types date columns as TimelessDateString,
 * the store's row types as string; the values are the same `YYYY-MM-DD` text.)
 */
type DocumentRow = IGetAllDocumentsResult;
type DocumentPatch = Partial<Row<'documents'>>;

const asDocuments = (rows: readonly Row<'documents'>[]) => rows as readonly DocumentRow[];

const EMPTY_UUID = '00000000-0000-0000-0000-000000000000';

/** `ORDER BY created_at DESC` */
const newestFirst = (rows: readonly DocumentRow[]) =>
  orderBy(rows, [{ value: row => row.created_at, desc: true }]);

/** `debtor_id IN $$ids OR creditor_id IN $$ids`, index-backed, each row once. */
async function byCounterparty(db: QueryDb, ids: readonly unknown[]): Promise<DocumentRow[]> {
  const byDebtor = asDocuments(await db.whereIn('documents', 'debtor_id', ids));
  const seen = new Set(byDebtor.map(row => row.id));
  const byCreditor = asDocuments(await db.whereIn('documents', 'creditor_id', ids)).filter(
    row => !seen.has(row.id),
  );
  return [...byDebtor, ...byCreditor];
}

/**
 * `SELECT * FROM documents ORDER BY created_at DESC`
 *
 * Documents inserted in one transaction share created_at (the whole demo seed does), and their
 * relative order is undefined in Postgres too: the harness reports SOFT on such ties.
 */
export const getAllDocuments = port<IGetAllDocumentsQuery>(async (_params, db) =>
  newestFirst(asDocuments(await db.rows('documents'))),
);

/** `SELECT * FROM documents WHERE charge_id in $$chargeIds ORDER BY created_at DESC` */
export const getDocumentsByChargeId = port<IGetDocumentsByChargeIdQuery>(
  async ({ chargeIds }, db) =>
    newestFirst(asDocuments(await db.whereIn('documents', 'charge_id', chargeIds))),
);

/** `SELECT * FROM documents WHERE id IN $$Ids` */
export const getDocumentsByIds = port<IGetDocumentsByIdsQuery>(async ({ Ids }, db) =>
  asDocuments(await db.whereIn('documents', 'id', Ids)),
);

/** `SELECT * FROM documents WHERE debtor_id IN $$Ids OR creditor_id IN $$Ids` */
export const getDocumentsByBusinessIds = port<IGetDocumentsByBusinessIdsQuery>(
  async ({ Ids }, db) => byCounterparty(db, Ids),
);

/** `SELECT * FROM documents WHERE file_hash IN $$hashes` */
export const getDocumentsByHashes = port<IGetDocumentsByHashesQuery>(async ({ hashes }, db) =>
  asDocuments(await db.whereIn('documents', 'file_hash', hashes)),
);

/**
 * SELECT * FROM documents
 * WHERE charge_id IS NOT NULL
 * AND (image_url IS NULL AND file_url IS NULL) -- missing link
 * OR (type <> 'OTHER'
 *     AND (serial_number IS NULL OR date IS NULL OR total_amount IS NULL OR currency_code IS NULL
 *          OR vat_amount IS NULL OR debtor_id IS NULL OR creditor_id IS NULL));
 *
 * AND binds tighter than OR: (charge AND missing link) OR (not OTHER AND missing info).
 */
export const getDocumentsByMissingRequiredInfo = port<IGetDocumentsByMissingRequiredInfoQuery>(
  async (_params, db) =>
    asDocuments(await db.rows('documents')).filter(
      doc =>
        (doc.charge_id != null && doc.image_url == null && doc.file_url == null) ||
        (doc.type !== 'OTHER' &&
          (doc.serial_number == null ||
            doc.date == null ||
            doc.total_amount == null ||
            doc.currency_code == null ||
            doc.vat_amount == null ||
            doc.debtor_id == null ||
            doc.creditor_id == null)),
    ),
);

/**
 * UPDATE documents SET
 *   charge_id = CASE WHEN $chargeId='00000000-0000-0000-0000-000000000000' THEN NULL
 *               ELSE COALESCE($chargeId::UUID, charge_id, NULL) END,
 *   currency_code = COALESCE($currencyCode, currency_code, NULL), date = COALESCE($date, date, NULL),
 *   file_url = COALESCE($fileUrl, file_url, NULL), id = COALESCE(id, id, NULL),
 *   image_url = COALESCE($imageUrl, image_url, NULL), updated_at = NOW(),
 *   serial_number = COALESCE($serialNumber, ...), total_amount = COALESCE($totalAmount, ...),
 *   type = COALESCE($type, ...), vat_amount = COALESCE($vatAmount, ...),
 *   is_reviewed, creditor_id, debtor_id, no_vat_amount, vat_report_date_override, allocation_number,
 *   exchange_rate_override, description, remarks = COALESCE($param, column)
 * WHERE id = $documentId
 * RETURNING *;
 */
export const updateDocument = port<IUpdateDocumentQuery>(async (params, db) => {
  // Enum parameters are converted when the statement binds, before any row is touched.
  const type = enumParam('document_type', params.type);
  const currencyCode = enumParam('currency', params.currencyCode);
  if (params.documentId == null) return [];
  const result: DocumentRow[] = [];
  for (const doc of await db.where('documents', { id: params.documentId })) {
    const patch = {
      ...coalescePatch({
        charge_id: params.chargeId,
        currency_code: currencyCode,
        date: params.date,
        file_url: params.fileUrl,
        image_url: params.imageUrl,
        serial_number: params.serialNumber,
        total_amount: params.totalAmount,
        type,
        vat_amount: params.vatAmount,
        is_reviewed: params.isReviewed,
        creditor_id: params.creditorId,
        debtor_id: params.debtorId,
        no_vat_amount: params.noVatAmount,
        vat_report_date_override: params.vatReportDateOverride,
        // varchar(9): checked when the parameter is assigned (the kept value always fits)
        allocation_number: varcharValue(params.allocationNumber, 9),
        exchange_rate_override: params.exchangeRateOverride,
        description: params.description,
        remarks: params.remarks,
      }),
      ...(params.chargeId === EMPTY_UUID ? { charge_id: null } : {}),
      updated_at: db.ctx.now,
    } as DocumentPatch;
    result.push((await db.update('documents', doc, patch)) as DocumentRow);
  }
  return result;
});

/** `DELETE FROM documents WHERE id = $documentId RETURNING id` */
export const deleteDocument = port<IDeleteDocumentQuery>(async ({ documentId }, db) => {
  if (documentId == null) return [];
  const result: { id: string }[] = [];
  for (const doc of deletableRows(db, await db.where('documents', { id: documentId }))) {
    await db.delete('documents', doc);
    result.push({ id: doc.id });
  }
  return result;
});

/**
 * INSERT INTO documents (image_url, file_url, type, serial_number, date, total_amount,
 *   currency_code, vat_amount, charge_id, vat_report_date_override, no_vat_amount, creditor_id,
 *   debtor_id, allocation_number, exchange_rate_override, file_hash, description, remarks, owner_id)
 * VALUES $$documents(image, file, documentType, serialNumber, date, amount, currencyCode, vat,
 *   chargeId, vatReportDateOverride, noVatAmount, creditorId, debtorId, allocationNumber,
 *   exchangeRateOverride, fileHash, description, remarks, ownerId)
 * RETURNING *;
 *
 * Every listed column gets its value, NULL included (an explicit NULL type is a not-null error).
 */
export const insertDocuments = port<IInsertDocumentsQuery>(async ({ documents }, db) => {
  const types = documents.map(doc => enumParam('document_type', doc.documentType));
  const currencies = documents.map(doc => enumParam('currency', doc.currencyCode));
  const result: DocumentRow[] = [];
  for (const [i, doc] of documents.entries()) {
    const values = {
      image_url: doc.image ?? null,
      file_url: doc.file ?? null,
      type: types[i] ?? null,
      serial_number: doc.serialNumber ?? null,
      date: doc.date ?? null,
      total_amount: doc.amount ?? null,
      currency_code: currencies[i] ?? null,
      vat_amount: doc.vat ?? null,
      charge_id: doc.chargeId ?? null,
      vat_report_date_override: doc.vatReportDateOverride ?? null,
      no_vat_amount: doc.noVatAmount ?? null,
      creditor_id: doc.creditorId ?? null,
      debtor_id: doc.debtorId ?? null,
      allocation_number: varcharValue(doc.allocationNumber, 9),
      exchange_rate_override: doc.exchangeRateOverride ?? null,
      file_hash: doc.fileHash ?? null,
      description: doc.description ?? null,
      remarks: doc.remarks ?? null,
      owner_id: doc.ownerId ?? null,
    } as DocumentPatch;
    const row = await db.insert('documents', values);
    if (row) result.push(row as DocumentRow);
  }
  return result;
});

/** `COALESCE(vat_report_date_override, date)` */
const vatDate = (doc: DocumentRow) => doc.vat_report_date_override ?? doc.date;

/**
 * SELECT * FROM documents
 * WHERE ($isIDs = 0 OR id IN $$IDs)
 *   AND ($fromVatDate ::TEXT IS NULL OR COALESCE(vat_report_date_override ,date) >= $fromVatDate ::DATE)
 *   AND ($toVatDate ::TEXT IS NULL OR COALESCE(vat_report_date_override ,date) <= $toVatDate ::DATE)
 *   AND ($isBusinessIDs = 0 OR debtor_id IN $$businessIDs OR creditor_id IN $$businessIDs)
 * ORDER BY created_at DESC;
 */
export const getDocumentsByFilters = port<IGetDocumentsByFiltersQuery>(async (params, db) => {
  const idMatch = inList(params.IDs);
  const businessMatch = inList(params.businessIDs);
  const fromVat = dateBound(params.fromVatDate, 'from');
  const toVat = dateBound(params.toVatDate, 'to');
  return newestFirst(
    asDocuments(await db.rows('documents')).filter(
      doc =>
        (isZero(params.isIDs) || idMatch(doc.id)) &&
        fromVat(vatDate(doc)) &&
        toVat(vatDate(doc)) &&
        (isZero(params.isBusinessIDs) ||
          businessMatch(doc.debtor_id) ||
          businessMatch(doc.creditor_id)),
    ),
  );
});

/**
 * SELECT * FROM documents
 * WHERE ($isIDs = 0 OR id IN $$IDs)
 *   AND ($fromVatDate ::TEXT IS NULL OR COALESCE(vat_report_date_override ,date) >= $fromVatDate ::DATE)
 *   AND ($toVatDate ::TEXT IS NULL OR COALESCE(vat_report_date_override ,date) <= $toVatDate ::DATE)
 *   AND ($fromDate ::TEXT IS NULL OR date >= $fromDate ::DATE)
 *   AND ($toDate ::TEXT IS NULL OR date <= $toDate ::DATE)
 *   AND ($isBusinessIDs = 0 OR debtor_id IN $$businessIDs OR creditor_id IN $$businessIDs)
 *   AND ($isOwnerIDs = 0 OR owner_id IN $$ownerIDs)
 *   AND ($isChargeIDs = 0 OR charge_id IN $$chargeIDs)
 *   AND ($isTypes = 0 OR type IN $$types)
 *   AND ($isMissingCounterparty = 0 OR debtor_id IS NULL OR creditor_id IS NULL)
 *   AND ($isUnmatched = 0 OR NOT EXISTS (
 *     SELECT 1 FROM transactions t WHERE t.charge_id = documents.charge_id))
 *   AND ($freeText::TEXT IS NULL OR (
 *     serial_number ILIKE '%' || $freeText || '%'
 *     OR description ILIKE '%' || $freeText || '%'
 *     OR remarks ILIKE '%' || $freeText || '%'
 *     OR ($freeTextNumeric::TEXT IS NOT NULL AND (
 *       total_amount::TEXT ILIKE '%' || $freeTextNumeric || '%'
 *       OR ABS(total_amount)::TEXT ILIKE '%' || $freeTextNumeric || '%'))
 *     OR EXISTS (SELECT 1 FROM financial_entities fe
 *                WHERE fe.id = documents.creditor_id AND fe.name ILIKE '%' || $freeText || '%')
 *     OR EXISTS (SELECT 1 FROM financial_entities fe
 *                WHERE fe.id = documents.debtor_id AND fe.name ILIKE '%' || $freeText || '%')))
 * ORDER BY created_at DESC;
 */
export const getDocumentsByExtendedFilters = port<IGetDocumentsByExtendedFiltersQuery>(
  async (params, db) => {
    for (const type of params.types) enumParam('document_type', type);
    const idMatch = inList(params.IDs);
    const businessMatch = inList(params.businessIDs);
    const ownerMatch = inList(params.ownerIDs);
    const chargeMatch = inList(params.chargeIDs);
    const typeMatch = inList(params.types);
    const fromVat = dateBound(params.fromVatDate, 'from');
    const toVat = dateBound(params.toVatDate, 'to');
    const fromDate = dateBound(params.fromDate, 'from');
    const toDate = dateBound(params.toDate, 'to');

    const matchedCharges = isZero(params.isUnmatched)
      ? null
      : new Set((await db.rows('transactions')).map(t => t.charge_id));

    const freeText = params.freeText ?? null;
    const freeTextNumeric = params.freeTextNumeric ?? null;
    const namedEntities =
      freeText == null
        ? new Set<string>()
        : new Set(
            (await db.rows('financial_entities'))
              .filter(fe => containsInsensitive(fe.name, freeText))
              .map(fe => fe.id),
          );
    const freeTextMatch = (doc: DocumentRow) =>
      freeText == null ||
      containsInsensitive(doc.serial_number, freeText) ||
      containsInsensitive(doc.description, freeText) ||
      containsInsensitive(doc.remarks, freeText) ||
      (freeTextNumeric != null &&
        (containsInsensitive(float8Text(doc.total_amount), freeTextNumeric) ||
          containsInsensitive(
            float8Text(doc.total_amount == null ? null : Math.abs(doc.total_amount)),
            freeTextNumeric,
          ))) ||
      (doc.creditor_id != null && namedEntities.has(doc.creditor_id)) ||
      (doc.debtor_id != null && namedEntities.has(doc.debtor_id));

    return newestFirst(
      asDocuments(await db.rows('documents')).filter(
        doc =>
          (isZero(params.isIDs) || idMatch(doc.id)) &&
          fromVat(vatDate(doc)) &&
          toVat(vatDate(doc)) &&
          fromDate(doc.date) &&
          toDate(doc.date) &&
          (isZero(params.isBusinessIDs) ||
            businessMatch(doc.debtor_id) ||
            businessMatch(doc.creditor_id)) &&
          (isZero(params.isOwnerIDs) || ownerMatch(doc.owner_id)) &&
          (isZero(params.isChargeIDs) || chargeMatch(doc.charge_id)) &&
          (isZero(params.isTypes) || typeMatch(doc.type)) &&
          (isZero(params.isMissingCounterparty) ||
            doc.debtor_id == null ||
            doc.creditor_id == null) &&
          (matchedCharges === null ||
            doc.charge_id == null ||
            !matchedCharges.has(doc.charge_id)) &&
          freeTextMatch(doc),
      ),
    );
  },
);

/** `col = COALESCE(col, $param)` for each entry: the parameter only lands in a NULL column. */
function fillNulls(row: DocumentRow, values: Record<string, unknown>): DocumentPatch {
  const patch: Record<string, unknown> = {};
  for (const [column, value] of Object.entries(values)) {
    if ((row as unknown as Record<string, unknown>)[column] == null && value != null) {
      patch[column] = value;
    }
  }
  return patch as DocumentPatch;
}

/**
 * UPDATE documents SET
 *   serial_number = COALESCE(serial_number, $serialNumber::text), date = COALESCE(date, $date::date),
 *   total_amount = COALESCE(total_amount, $totalAmount::double precision),
 *   currency_code = COALESCE(currency_code, $currencyCode::currency),
 *   vat_amount = COALESCE(vat_amount, $vatAmount::double precision),
 *   allocation_number = COALESCE(allocation_number, $allocationNumber::varchar),
 *   description = COALESCE(description, $description::text), remarks = COALESCE(remarks, $remarks::text),
 *   creditor_id = COALESCE(creditor_id, $creditorId::uuid), debtor_id = COALESCE(debtor_id, $debtorId::uuid),
 *   type = CASE WHEN type = 'UNPROCESSED' THEN COALESCE($type::document_type, type) ELSE type END,
 *   updated_at = NOW()
 * WHERE id = $documentId::uuid
 *   AND ((serial_number IS NULL AND $serialNumber::text IS NOT NULL)
 *     OR (date IS NULL AND $date::date IS NOT NULL) OR ... (each column above)
 *     OR (type = 'UNPROCESSED' AND $type IS NOT NULL AND $type <> 'UNPROCESSED'))
 * RETURNING *;
 */
export const fillDocumentFromOcr = port<IFillDocumentFromOcrQuery>(async (params, db) => {
  const type = enumParam('document_type', params.type);
  const currencyCode = enumParam('currency', params.currencyCode);
  if (params.documentId == null) return [];
  const result: DocumentRow[] = [];
  for (const doc of asDocuments(await db.where('documents', { id: params.documentId }))) {
    const filled = fillNulls(doc, {
      serial_number: params.serialNumber,
      date: params.date,
      total_amount: params.totalAmount,
      currency_code: currencyCode,
      vat_amount: params.vatAmount,
      allocation_number: params.allocationNumber,
      description: params.description,
      remarks: params.remarks,
      creditor_id: params.creditorId,
      debtor_id: params.debtorId,
    });
    const retype = doc.type === 'UNPROCESSED' && type != null && type !== 'UNPROCESSED';
    // The WHERE clause: no row when the pass has nothing the document is missing.
    if (Object.keys(filled).length === 0 && !retype) continue;
    if (filled.allocation_number != null) {
      filled.allocation_number = varcharValue(filled.allocation_number, 9);
    }
    const patch: DocumentPatch = {
      ...filled,
      ...(retype ? { type: type! } : {}),
      updated_at: db.ctx.now,
    };
    result.push((await db.update('documents', doc as Row<'documents'>, patch)) as DocumentRow);
  }
  return result;
});

/** `UPDATE documents SET charge_id = $assertChargeID WHERE charge_id = $replaceChargeID RETURNING id` */
export const replaceDocumentsChargeId = port<IReplaceDocumentsChargeIdQuery>(
  async ({ assertChargeID, replaceChargeID }, db) => {
    if (replaceChargeID == null) return [];
    const result: { id: string }[] = [];
    for (const doc of await db.where('documents', { charge_id: replaceChargeID })) {
      await db.update('documents', doc, { charge_id: assertChargeID ?? null });
      result.push({ id: doc.id });
    }
    return result;
  },
);
