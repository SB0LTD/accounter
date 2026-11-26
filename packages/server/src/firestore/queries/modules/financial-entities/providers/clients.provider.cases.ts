import { FX } from '../_fixture-ids.js';
import type {
  IDeleteClientQuery,
  IGetClientsByGreenInvoiceIdsQuery,
  IGetClientsByIdsQuery,
  IInsertClientQuery,
  IUpdateClientQuery,
} from '../../../../../modules/financial-entities/__generated__/clients.types.js';
import { caseFor, type Cases } from '../../../cases.js';

export const cases: Cases = {
  getClientsByIds: caseFor<IGetClientsByIdsQuery>(s => [
    { businessIds: [FX.delta, FX.alpha, FX.eta, FX.gamma, s.missingId] },
    { businessIds: [FX.delta.toUpperCase()] },
    { businessIds: [s.missingId] },
  ]),
  getClientsByGreenInvoiceIds: caseFor<IGetClientsByGreenInvoiceIdsQuery>(s => [
    // alpha's stored id is braced upper-case without hyphens; the cast canonicalises it
    { greenInvoiceBusinessIds: [FX.greenDelta, FX.greenAlpha, FX.greenEta, s.missingId] },
    { greenInvoiceBusinessIds: ['{0F020000000040008000000000000041}'] },
    { greenInvoiceBusinessIds: [FX.greenEpsilon, FX.greenBeta] }, // NULL / non-object integrations
    { greenInvoiceBusinessIds: ['not-a-uuid'] },
  ]),
  updateClient: caseFor<IUpdateClientQuery>(s => [
    {
      businessId: FX.delta,
      emails: ['new@delta.example'],
      integrations: { greenInvoiceId: FX.greenDelta, hiveId: 'hive-4' },
      generatedDocumentType: 'RECEIPT',
      newBusinessId: null,
    },
    { businessId: FX.delta, newBusinessId: FX.gamma }, // moves the client
    { businessId: FX.delta, newBusinessId: FX.alpha }, // alpha is a client: 23505
    { businessId: FX.delta, newBusinessId: s.missingId }, // no such business: 23503
    { businessId: FX.delta, generatedDocumentType: 'BAD' as never }, // 22P02
    { businessId: FX.epsilon, emails: [] },
    { businessId: FX.eta }, // nothing to change
    { businessId: s.missingId, emails: ['x@y.example'] },
  ]),
  deleteClient: caseFor<IDeleteClientQuery>(s => [
    { businessId: FX.delta },
    { businessId: FX.eta },
    { businessId: s.missingId },
    // a client with contracts, if the dataset has one: 23503
    { businessId: s.values('clients_contracts', 'client_id', 1)[0] as string | undefined },
  ]),
  insertClient: caseFor<IInsertClientQuery>(s => [
    // green_invoice_id is NOT NULL and not inserted: 23502
    {
      businessId: FX.gamma,
      emails: ['g@gamma.example'],
      integrations: { greenInvoiceId: FX.unused },
      generatedDocumentType: 'INVOICE',
      ownerId: s.businessId,
    },
    // another tenant: RLS is checked before NOT NULL
    {
      businessId: FX.gamma,
      emails: null,
      integrations: null,
      generatedDocumentType: 'PROFORMA',
      ownerId: s.missingId,
    },
  ]),
};
