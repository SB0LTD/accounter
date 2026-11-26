import { deletableRows, enumParam } from '../_helpers.js';
import type {
  IDeleteIssuedDocumentQuery,
  IGetAllIssuedDocumentsQuery,
  IGetIssuedDocumentsByClientIdsQuery,
  IGetIssuedDocumentsByExternalIdsQuery,
  IGetIssuedDocumentsByIdsQuery,
  IGetIssuedDocumentsByTypeQuery,
  IGetIssuedDocumentsByTypeResult,
  IGetIssuedDocumentsStatusByChargeIdsQuery,
  IInsertIssuedDocumentsQuery,
  IUpdateIssuedDocumentByExternalIdQuery,
  IUpdateIssuedDocumentQuery,
} from '../../../../../modules/documents/__generated__/issued-documents.types.js';
import type { Row } from '../../../../catalog.js';
import {
  boolOr,
  coalesce,
  coalescePatch,
  groupBy,
  limitOffset,
  orderBy,
} from '../../../../sql-helpers.js';
import { port } from '../../../port.js';

type DocumentRow = Row<'documents'>;
type IssuedRow = Row<'documents_issued'>;
type IssuedPatch = Partial<IssuedRow>;

/**
 * `SELECT d.*, di.external_id, di.status, di.linked_document_ids` (pgTyped types the date columns
 * as TimelessDateString; rows hold the same `YYYY-MM-DD` text as string).
 */
const joined = (doc: DocumentRow, issued: IssuedRow) =>
  ({
    ...doc,
    external_id: issued.external_id,
    status: issued.status,
    linked_document_ids: issued.linked_document_ids,
  }) as IGetIssuedDocumentsByTypeResult;

/** `SELECT * FROM documents_issued` */
export const getAllIssuedDocuments = port<IGetAllIssuedDocumentsQuery>(async (_params, db) =>
  db.rows('documents_issued'),
);

/** `SELECT * FROM documents_issued WHERE id IN $$Ids` */
export const getIssuedDocumentsByIds = port<IGetIssuedDocumentsByIdsQuery>(async ({ Ids }, db) =>
  db.whereIn('documents_issued', 'id', Ids),
);

/** `SELECT * FROM documents_issued WHERE external_id IN $$externalIds` */
export const getIssuedDocumentsByExternalIds = port<IGetIssuedDocumentsByExternalIdsQuery>(
  async ({ externalIds }, db) => db.whereIn('documents_issued', 'external_id', externalIds),
);

/**
 * SELECT d.*, di.external_id, di.status, di.linked_document_ids
 * FROM documents_issued di LEFT JOIN documents d ON di.id = d.id
 * WHERE d.debtor_id IN $$clientIds OR d.creditor_id IN $$clientIds;
 *
 * The WHERE needs a document, so the LEFT JOIN acts as an inner join.
 */
export const getIssuedDocumentsByClientIds = port<IGetIssuedDocumentsByClientIdsQuery>(
  async ({ clientIds }, db) => {
    const byDebtor = await db.whereIn('documents', 'debtor_id', clientIds);
    const seen = new Set(byDebtor.map(doc => doc.id));
    const docs = [
      ...byDebtor,
      ...(await db.whereIn('documents', 'creditor_id', clientIds)).filter(doc => !seen.has(doc.id)),
    ];
    const docById = new Map(docs.map(doc => [doc.id, doc]));
    const issued = await db.whereIn(
      'documents_issued',
      'id',
      docs.map(doc => doc.id),
    );
    return issued.map(di => joined(docById.get(di.id)!, di));
  },
);

/**
 * SELECT documents.charge_id,
 *   COALESCE(bool_or(documents_issued.status = 'OPEN'::document_status), false) AS open_docs_flag
 * FROM documents_issued LEFT JOIN documents ON documents.id = documents_issued.id
 * WHERE documents.charge_id in $$chargeIds
 * GROUP BY documents.charge_id
 */
export const getIssuedDocumentsStatusByChargeIds = port<IGetIssuedDocumentsStatusByChargeIdsQuery>(
  async ({ chargeIds }, db) => {
    const docs = await db.whereIn('documents', 'charge_id', chargeIds);
    const chargeByDoc = new Map(docs.map(doc => [doc.id, doc.charge_id]));
    const issued = await db.whereIn(
      'documents_issued',
      'id',
      docs.map(doc => doc.id),
    );
    const groups = groupBy(issued, di => chargeByDoc.get(di.id)!);
    return [...groups].map(([chargeId, rows]) => ({
      charge_id: chargeId,
      open_docs_flag: coalesce(boolOr(rows.map(di => di.status === 'OPEN')), false),
    }));
  },
);

/**
 * SELECT d.*, di.external_id, di.status, di.linked_document_ids
 * FROM documents_issued di LEFT JOIN documents d ON di.id = d.id
 * WHERE d.type = $type
 * ORDER BY d.serial_number DESC
 * LIMIT $limit;
 *
 * Documents sharing a serial number tie: their order (and which of them a LIMIT keeps) is
 * undefined in Postgres too.
 */
export const getIssuedDocumentsByType = port<IGetIssuedDocumentsByTypeQuery>(
  async ({ type, limit }, db) => {
    const documentType = enumParam('document_type', type);
    if (documentType == null) return [];
    const docs = await db.where('documents', { type: documentType as DocumentRow['type'] });
    const docById = new Map(docs.map(doc => [doc.id, doc]));
    const issued = await db.whereIn(
      'documents_issued',
      'id',
      docs.map(doc => doc.id),
    );
    const rows = orderBy(
      issued.map(di => joined(docById.get(di.id)!, di)),
      [{ value: row => row.serial_number, desc: true }],
    );
    return limitOffset(rows, limit ?? null);
  },
);

/**
 * UPDATE documents_issued SET
 *   external_id = COALESCE($externalId, external_id), status = COALESCE($status, status),
 *   linked_document_ids = COALESCE($linkedDocumentIds, linked_document_ids)
 * WHERE id = $documentId
 * RETURNING *;
 */
export const updateIssuedDocument = port<IUpdateIssuedDocumentQuery>(
  async ({ documentId, externalId, status, linkedDocumentIds }, db) => {
    const newStatus = enumParam('document_status', status);
    if (documentId == null) return [];
    const result: IssuedRow[] = [];
    for (const row of await db.where('documents_issued', { id: documentId })) {
      const patch = coalescePatch({
        external_id: externalId,
        status: newStatus,
        linked_document_ids: linkedDocumentIds,
      }) as IssuedPatch;
      result.push(await db.update('documents_issued', row, patch));
    }
    return result;
  },
);

/**
 * UPDATE documents_issued SET
 *   id = COALESCE($documentId, id), status = COALESCE($status, status),
 *   linked_document_ids = COALESCE($linkedDocumentIds, linked_document_ids)
 * WHERE external_id = $externalId
 * RETURNING *;
 */
export const updateIssuedDocumentByExternalId = port<IUpdateIssuedDocumentByExternalIdQuery>(
  async ({ documentId, externalId, status, linkedDocumentIds }, db) => {
    const newStatus = enumParam('document_status', status);
    if (externalId == null) return [];
    const result: IssuedRow[] = [];
    for (const row of await db.where('documents_issued', { external_id: externalId })) {
      const patch = coalescePatch({
        id: documentId,
        status: newStatus,
        linked_document_ids: linkedDocumentIds,
      }) as IssuedPatch;
      result.push(await db.update('documents_issued', row, patch));
    }
    return result;
  },
);

/** `DELETE FROM documents_issued WHERE id = $documentId RETURNING id` */
export const deleteIssuedDocument = port<IDeleteIssuedDocumentQuery>(async ({ documentId }, db) => {
  if (documentId == null) return [];
  const result: { id: string }[] = [];
  for (const row of deletableRows(db, await db.where('documents_issued', { id: documentId }))) {
    await db.delete('documents_issued', row);
    result.push({ id: row.id });
  }
  return result;
});

/**
 * INSERT INTO documents_issued (id, external_id, status, linked_document_ids, owner_id)
 * VALUES $$issuedDocuments(id, externalId, status, linkedDocumentIds, ownerId)
 * RETURNING *;
 */
export const insertIssuedDocuments = port<IInsertIssuedDocumentsQuery>(
  async ({ issuedDocuments }, db) => {
    const statuses = issuedDocuments.map(doc => enumParam('document_status', doc.status));
    const result: IssuedRow[] = [];
    for (const [i, doc] of issuedDocuments.entries()) {
      const row = await db.insert('documents_issued', {
        id: doc.id ?? null,
        external_id: doc.externalId ?? null,
        status: statuses[i] ?? null,
        linked_document_ids: doc.linkedDocumentIds ?? null,
        owner_id: doc.ownerId ?? null,
      } as IssuedPatch);
      if (row) result.push(row);
    }
    return result;
  },
);
