import { EMPTY_UUID, FX } from '../_fixture-ids.js';
import type {
  IDeleteDocumentQuery,
  IFillDocumentFromOcrQuery,
  IGetDocumentsByBusinessIdsQuery,
  IGetDocumentsByChargeIdQuery,
  IGetDocumentsByExtendedFiltersParams,
  IGetDocumentsByExtendedFiltersQuery,
  IGetDocumentsByFiltersQuery,
  IGetDocumentsByHashesQuery,
  IGetDocumentsByIdsQuery,
  IInsertDocumentsParams,
  IInsertDocumentsQuery,
  IReplaceDocumentsChargeIdQuery,
  IUpdateDocumentQuery,
} from '../../../../../modules/documents/__generated__/documents.types.js';
import { caseFor, type Cases } from '../../../cases.js';

// The demo documents share one created_at; cases of the ORDER BY created_at queries pick at most one
// of them so the order is total.

const noFilters: IGetDocumentsByExtendedFiltersParams = {
  isIDs: 0,
  IDs: [null],
  fromVatDate: null,
  toVatDate: null,
  fromDate: null,
  toDate: null,
  isBusinessIDs: 0,
  businessIDs: [null],
  isOwnerIDs: 0,
  ownerIDs: [null],
  isChargeIDs: 0,
  chargeIDs: [null],
  isTypes: 0,
  types: [null],
  isMissingCounterparty: 0,
  isUnmatched: 0,
  freeText: null,
  freeTextNumeric: null,
};

type NewDocument = IInsertDocumentsParams['documents'][number];
const newDocument = (ownerId: string, patch: Partial<NewDocument> = {}): NewDocument => ({
  image: 'https://example.test/new.png',
  file: null,
  documentType: 'INVOICE',
  serialNumber: 'NEW-1',
  date: '2024-08-08',
  amount: 321.5,
  currencyCode: 'USD',
  vat: 49.1,
  chargeId: FX.chargeApproved,
  vatReportDateOverride: '2024-09-01',
  noVatAmount: '272.400',
  creditorId: FX.globex,
  debtorId: ownerId,
  allocationNumber: '000111222',
  exchangeRateOverride: 3.71,
  fileHash: '42',
  description: 'new document',
  remarks: null,
  ownerId,
  ...patch,
});

export const cases: Cases = {
  getDocumentsByChargeId: caseFor<IGetDocumentsByChargeIdQuery>(s => [
    { chargeIds: [FX.chargeApproved, FX.chargeUnmatched] },
    { chargeIds: [s.values('documents', 'charge_id', 20).at(-1) as string, FX.chargeApproved] },
    { chargeIds: [s.missingId, null] },
  ]),
  getDocumentsByIds: caseFor<IGetDocumentsByIdsQuery>(s => [
    { Ids: s.ids('documents', 5) },
    { Ids: [FX.d1, s.missingId, null] },
    { Ids: s.rows('documents').map(row => row.id as string) },
  ]),
  getDocumentsByBusinessIds: caseFor<IGetDocumentsByBusinessIdsQuery>(s => [
    { Ids: [FX.globex] },
    { Ids: [s.businessId] },
    { Ids: [FX.initech, s.missingId] },
  ]),
  getDocumentsByHashes: caseFor<IGetDocumentsByHashesQuery>(() => [
    { hashes: ['987654321', '111'] },
    { hashes: ['no such hash', null] },
  ]),
  updateDocument: caseFor<IUpdateDocumentQuery>(s => [
    // every column
    {
      documentId: FX.d2,
      chargeId: FX.chargeUnmatched,
      currencyCode: 'USD',
      date: '2024-05-05',
      fileUrl: 'https://example.test/f.pdf',
      imageUrl: 'https://example.test/i.png',
      serialNumber: 'S-1',
      totalAmount: 12.5,
      type: 'INVOICE',
      vatAmount: 1.5,
      isReviewed: true,
      creditorId: FX.globex,
      debtorId: s.businessId,
      noVatAmount: '11.000',
      vatReportDateOverride: '2024-06-01',
      allocationNumber: 'ABC123456',
      exchangeRateOverride: 3.25,
      description: 'updated',
      remarks: 'updated remarks',
    },
    // the empty UUID detaches the charge; NULLs keep the columns
    { documentId: FX.d1, chargeId: EMPTY_UUID },
    { documentId: FX.d1 },
    { documentId: s.missingId, serialNumber: 'nothing to update' },
    { documentId: null, serialNumber: 'no id' },
    // allocation_number is varchar(9): too long raises, trailing spaces are cut
    { documentId: FX.d1, allocationNumber: '1234567890' },
    { documentId: FX.d1, allocationNumber: '12345678   ' },
    // unknown charge: foreign key
    { documentId: FX.d1, chargeId: s.missingId },
    // unknown enum label
    { documentId: FX.d1, type: 'NOT_A_TYPE' as never },
    { documentId: s.missingId, currencyCode: 'XYZ' as never },
  ]),
  deleteDocument: caseFor<IDeleteDocumentQuery>(s => [
    // cascades to documents_issued
    { documentId: FX.d1 },
    { documentId: FX.d2 },
    { documentId: s.missingId },
    { documentId: null },
  ]),
  insertDocuments: caseFor<IInsertDocumentsQuery>(s => [
    {
      documents: [
        newDocument(s.businessId),
        newDocument(s.businessId, {
          image: null,
          documentType: 'UNPROCESSED',
          serialNumber: null,
          date: null,
          amount: null,
          currencyCode: null,
          vat: null,
          chargeId: null,
          vatReportDateOverride: null,
          noVatAmount: null,
          creditorId: null,
          debtorId: null,
          allocationNumber: null,
          exchangeRateOverride: null,
          fileHash: null,
          description: null,
        }),
      ],
    },
    // an explicit NULL type does not take the default: not-null violation
    { documents: [newDocument(s.businessId, { documentType: null })] },
    { documents: [newDocument(s.businessId, { chargeId: s.missingId })] },
    { documents: [newDocument(s.businessId, { allocationNumber: '0123456789' })] },
    { documents: [newDocument(s.businessId, { currencyCode: 'XYZ' as never })] },
    // another business: row-level security
    { documents: [newDocument(s.missingId)] },
  ]),
  getDocumentsByFilters: caseFor<IGetDocumentsByFiltersQuery>(() => [
    {
      isIDs: 0,
      IDs: [null],
      fromVatDate: '2024-01-01',
      toVatDate: '2024-12-31',
      isBusinessIDs: 1,
      businessIDs: [FX.globex, FX.initech],
    },
    {
      isIDs: 1,
      IDs: [FX.d1, FX.d2, FX.d3],
      fromVatDate: null,
      toVatDate: null,
      isBusinessIDs: 0,
      businessIDs: [null],
    },
    {
      isIDs: 1,
      IDs: [FX.d1, FX.d2],
      fromVatDate: '2020-01-01',
      toVatDate: null,
      isBusinessIDs: 0,
      businessIDs: [null],
    },
    // NULL flags: `NULL = 0` is not true, so the list filters apply
    {
      isIDs: null,
      IDs: [FX.d1, FX.d4],
      fromVatDate: null,
      toVatDate: '2024-06-30',
      isBusinessIDs: null,
      businessIDs: [FX.globex],
    },
  ]),
  getDocumentsByExtendedFilters: caseFor<IGetDocumentsByExtendedFiltersQuery>(s => [
    { ...noFilters, isChargeIDs: 1, chargeIDs: [FX.chargeApproved, FX.chargeUnmatched] },
    { ...noFilters, isTypes: 1, types: ['RECEIPT', 'PROFORMA', 'OTHER'] },
    { ...noFilters, isMissingCounterparty: 1, isOwnerIDs: 1, ownerIDs: [s.businessId] },
    { ...noFilters, isUnmatched: 1 },
    { ...noFilters, freeText: 'office' },
    // amounts match as text: 1234567890123456 prints as 1.234567890123456e+15
    { ...noFilters, freeText: '1.2345', freeTextNumeric: '1.2345' },
    { ...noFilters, freeText: '250.5', freeTextNumeric: '250.5' },
    { ...noFilters, freeText: '-250', freeTextNumeric: '-250' },
    // counterparty names
    { ...noFilters, freeText: 'GLOBEX' },
    // LIKE wildcards and escapes in the user's text
    {
      ...noFilters,
      freeText: '%chairs',
      isChargeIDs: 1,
      chargeIDs: [FX.chargeApproved, FX.chargeUnmatched],
    },
    { ...noFilters, freeText: 'large\\_a' },
    { ...noFilters, freeText: '', isChargeIDs: 1, chargeIDs: [FX.chargeUnmatched] },
    { ...noFilters, fromDate: '2024-02-01', toDate: '2024-02-28' },
    { ...noFilters, fromVatDate: '2024-04-01', toVatDate: '2024-04-01' },
    {
      ...noFilters,
      isIDs: 1,
      IDs: [FX.d1, FX.d4, s.missingId],
      isBusinessIDs: 1,
      businessIDs: [FX.globex],
    },
    { ...noFilters, isOwnerIDs: 1, ownerIDs: [s.missingId] },
  ]),
  fillDocumentFromOcr: caseFor<IFillDocumentFromOcrQuery>(s => [
    {
      documentId: FX.d2,
      serialNumber: 'OCR-1',
      date: '2024-07-07',
      totalAmount: 77.7,
      currencyCode: 'GBP',
      vatAmount: 11.1,
      allocationNumber: '987654321',
      description: 'from ocr',
      remarks: 'ocr remarks',
      creditorId: FX.globex,
      debtorId: s.businessId,
      type: 'INVOICE',
    },
    // nothing missing that the pass has: no row
    {
      documentId: FX.d1,
      serialNumber: 'OCR-1',
      date: '2024-07-07',
      totalAmount: 77.7,
      currencyCode: 'GBP',
      type: 'INVOICE',
    },
    { documentId: FX.d2, type: 'UNPROCESSED' },
    { documentId: FX.d6, serialNumber: 'OCR-6', type: 'RECEIPT' },
    { documentId: FX.d3, date: '2020-01-01', debtorId: FX.initech },
    { documentId: FX.d2, allocationNumber: '1234567890' },
    { documentId: FX.d2, debtorId: s.missingId },
    { documentId: null, serialNumber: 'no id' },
  ]),
  replaceDocumentsChargeId: caseFor<IReplaceDocumentsChargeIdQuery>(s => [
    { assertChargeID: FX.chargeEmpty, replaceChargeID: FX.chargeApproved },
    { assertChargeID: null, replaceChargeID: FX.chargeUnmatched },
    { assertChargeID: s.missingId, replaceChargeID: FX.chargeApproved },
    { assertChargeID: FX.chargeEmpty, replaceChargeID: s.missingId },
    { assertChargeID: FX.chargeEmpty, replaceChargeID: null },
  ]),
};
