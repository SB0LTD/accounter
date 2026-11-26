import { FX } from '../_fixture-ids.js';
import type {
  IDeleteIssuedDocumentQuery,
  IGetIssuedDocumentsByClientIdsQuery,
  IGetIssuedDocumentsByExternalIdsQuery,
  IGetIssuedDocumentsByIdsQuery,
  IGetIssuedDocumentsByTypeQuery,
  IGetIssuedDocumentsStatusByChargeIdsQuery,
  IInsertIssuedDocumentsQuery,
  IUpdateIssuedDocumentByExternalIdQuery,
  IUpdateIssuedDocumentQuery,
} from '../../../../../modules/documents/__generated__/issued-documents.types.js';
import { caseFor, type Cases } from '../../../cases.js';

export const cases: Cases = {
  getIssuedDocumentsByIds: caseFor<IGetIssuedDocumentsByIdsQuery>(s => [
    { Ids: [FX.d1, FX.d5, FX.d2, s.missingId] },
    { Ids: [null] },
  ]),
  getIssuedDocumentsByExternalIds: caseFor<IGetIssuedDocumentsByExternalIdsQuery>(() => [
    { externalIds: ['gi-ext-001', 'gi-ext-006', 'no such id'] },
    { externalIds: ['GI-EXT-001'] },
  ]),
  getIssuedDocumentsByClientIds: caseFor<IGetIssuedDocumentsByClientIdsQuery>(s => [
    { clientIds: [FX.globex] },
    { clientIds: [s.businessId, FX.initech] },
    { clientIds: [s.missingId, null] },
  ]),
  getIssuedDocumentsStatusByChargeIds: caseFor<IGetIssuedDocumentsStatusByChargeIdsQuery>(s => [
    { chargeIds: [FX.chargeApproved, FX.chargeUnmatched, FX.chargeEmpty, s.missingId] },
    { chargeIds: s.values('documents', 'charge_id', 20) as string[] },
  ]),
  getIssuedDocumentsByType: caseFor<IGetIssuedDocumentsByTypeQuery>(() => [
    // NULL serial numbers come first in DESC order, then 'inv-f-000' before 'INV-F-002' (C collation)
    { type: 'INVOICE', limit: 2 },
    { type: 'INVOICE', limit: 3 },
    { type: 'INVOICE', limit: null },
    { type: 'INVOICE', limit: '1' },
    { type: 'CREDIT_INVOICE', limit: 5 },
    { type: 'PROFORMA', limit: 0 },
    { type: 'UNPROCESSED', limit: 3 },
    { type: null, limit: 3 },
    { type: 'NOT_A_TYPE' as never, limit: 3 },
  ]),
  updateIssuedDocument: caseFor<IUpdateIssuedDocumentQuery>(s => [
    {
      documentId: FX.d1,
      externalId: 'gi-ext-001b',
      status: 'CLOSED',
      linkedDocumentIds: [FX.d4],
    },
    { documentId: FX.d5, externalId: null, status: null, linkedDocumentIds: null },
    { documentId: FX.d6, linkedDocumentIds: [] },
    // external_id is unique
    { documentId: FX.d5, externalId: 'gi-ext-001' },
    { documentId: FX.d1, status: 'NOT_A_STATUS' as never },
    { documentId: s.missingId, status: 'OPEN' },
    { documentId: null, status: 'OPEN' },
  ]),
  updateIssuedDocumentByExternalId: caseFor<IUpdateIssuedDocumentByExternalIdQuery>(s => [
    // moves the issued row to another document (its primary key)
    { externalId: 'gi-ext-005', documentId: FX.d3, status: 'OPEN', linkedDocumentIds: [FX.d1] },
    { externalId: 'gi-ext-007', documentId: null, status: null, linkedDocumentIds: null },
    // the document already has an issued row
    { externalId: 'gi-ext-005', documentId: FX.d1 },
    // no such document
    { externalId: 'gi-ext-006', documentId: s.missingId },
    { externalId: 'no such id', status: 'CLOSED' },
    { externalId: null, status: 'CLOSED' },
  ]),
  deleteIssuedDocument: caseFor<IDeleteIssuedDocumentQuery>(s => [
    { documentId: FX.d1 },
    { documentId: FX.d2 },
    { documentId: s.missingId },
  ]),
  insertIssuedDocuments: caseFor<IInsertIssuedDocumentsQuery>(s => [
    {
      issuedDocuments: [
        {
          id: FX.d2,
          externalId: 'gi-new-2',
          status: 'OPEN',
          linkedDocumentIds: [FX.d1],
          ownerId: s.businessId,
        },
        {
          id: FX.d3,
          externalId: 'gi-new-3',
          status: 'CANCELLED_BY_OTHER_DOC',
          linkedDocumentIds: null,
          ownerId: s.businessId,
        },
      ],
    },
    // primary key, unique external id, explicit NULL status, missing document
    {
      issuedDocuments: [
        {
          id: FX.d1,
          externalId: 'gi-new-1',
          status: 'OPEN',
          linkedDocumentIds: null,
          ownerId: s.businessId,
        },
      ],
    },
    {
      issuedDocuments: [
        {
          id: FX.d2,
          externalId: 'gi-ext-004',
          status: 'OPEN',
          linkedDocumentIds: null,
          ownerId: s.businessId,
        },
      ],
    },
    {
      issuedDocuments: [
        {
          id: FX.d2,
          externalId: 'gi-new-2',
          status: null,
          linkedDocumentIds: null,
          ownerId: s.businessId,
        },
      ],
    },
    {
      issuedDocuments: [
        {
          id: s.missingId,
          externalId: 'gi-new-x',
          status: 'OPEN',
          linkedDocumentIds: null,
          ownerId: s.businessId,
        },
      ],
    },
  ]),
};
