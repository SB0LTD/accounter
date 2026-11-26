import {
  castUuid,
  deletable,
  insertRow,
  jsonField,
  pgParams,
  uuidList,
  uuidParam,
} from '../_helpers.js';
import type {
  IDeleteClientQuery,
  IGetAllClientsQuery,
  IGetClientsByGreenInvoiceIdsQuery,
  IGetClientsByIdsQuery,
  IInsertClientQuery,
  IUpdateClientQuery,
} from '../../../../../modules/financial-entities/__generated__/clients.types.js';
import { coalescePatch, inList } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';

/** SELECT * FROM clients */
export const getAllClients = port<IGetAllClientsQuery>(async (_params, db) => db.rows('clients'));

/** SELECT * FROM clients WHERE business_id IN $$businessIds */
export const getClientsByIds = port<IGetClientsByIdsQuery>(async ({ businessIds }, db) =>
  db.whereIn('clients', 'business_id', uuidList(businessIds)),
);

/**
 * SELECT *, (integrations->>'greenInvoiceId')::uuid as green_invoice_business_id
 * FROM clients
 * WHERE (integrations->>'greenInvoiceId')::uuid in $$greenInvoiceBusinessIds
 *
 * The WHERE casts every visible row's value, so one malformed id fails the query (22P02), as in
 * Postgres.
 */
export const getClientsByGreenInvoiceIds = port<IGetClientsByGreenInvoiceIdsQuery>(
  async ({ greenInvoiceBusinessIds }, db) => {
    const wanted = inList(uuidList(greenInvoiceBusinessIds));
    const result = [];
    for (const client of await db.rows('clients')) {
      const text = jsonField(client.integrations, 'greenInvoiceId');
      const greenInvoiceId = text == null ? null : castUuid(text);
      if (wanted(greenInvoiceId)) {
        result.push({ ...client, green_invoice_business_id: greenInvoiceId });
      }
    }
    return result;
  },
);

/**
 * UPDATE clients SET emails = COALESCE($emails, emails, NULL),
 *   business_id = COALESCE($newBusinessId, business_id, NULL),
 *   integrations = COALESCE($integrations, integrations, NULL),
 *   document_type = COALESCE($generatedDocumentType, document_type)
 * WHERE business_id = $businessId RETURNING *
 */
export const updateClient = port<IUpdateClientQuery>(async (params, db) => {
  const patch = pgParams(
    'clients',
    coalescePatch({
      emails: params.emails,
      business_id: params.newBusinessId,
      integrations: params.integrations,
      document_type: params.generatedDocumentType,
    }) as never,
  );
  const businessId = uuidParam(params.businessId);
  if (businessId == null) return [];
  const updated = [];
  for (const client of await db.where('clients', { business_id: businessId })) {
    updated.push(await db.update('clients', client, patch));
  }
  return updated;
});

/** DELETE FROM clients WHERE business_id = $businessId RETURNING business_id */
export const deleteClient = port<IDeleteClientQuery>(async ({ businessId }, db) => {
  const id = uuidParam(businessId);
  if (id == null) return [];
  const deleted = [];
  for (const client of deletable(db, await db.where('clients', { business_id: id }))) {
    await db.delete('clients', client);
    deleted.push({ business_id: client.business_id });
  }
  return deleted;
});

/**
 * INSERT INTO clients (business_id, emails, integrations, document_type, owner_id)
 * VALUES ($businessId, $emails, $integrations, $generatedDocumentType, $ownerId) RETURNING *
 *
 * green_invoice_id is NOT NULL without a default and not in the column list, so this raises 23502
 * on the current schema, as it does in Postgres.
 */
export const insertClient = port<IInsertClientQuery>(async (params, db) => {
  const row = await insertRow(
    db,
    'clients',
    pgParams('clients', {
      business_id: params.businessId ?? null,
      emails: params.emails ?? null,
      integrations: params.integrations ?? null,
      document_type: params.generatedDocumentType ?? null,
      owner_id: params.ownerId ?? null,
    } as never),
  );
  return row ? [row] : [];
});
