import type {
  IGetChargeIdsByPaymentIdsQuery,
  IGetInvoicesByIdsQuery,
  IGetInvoicesByIssueDatesQuery,
  IInsertDeelInvoiceRecordsQuery,
  IUpdateDeelInvoiceRecordsQuery,
} from '../../../../../modules/deel/__generated__/deel-invoices.types.js';
import { caseFor, type Cases } from '../../../cases.js';

// Fixture rows (scripts/firestore/fixtures/090-accounts-salaries.sql)
const ID = (n: number) => `0f090000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const UNCHARGED_DOCUMENT = ID(301);

type InvoiceParams = IInsertDeelInvoiceRecordsQuery['params'];

/** The NOT NULL columns, set; everything else NULL. */
const minimalInvoice = (ownerId: string): InvoiceParams => ({
  id: 'FXINV0912',
  documentId: null,
  amount: 10,
  billingType: null,
  contractId: null,
  createdAt: new Date('2024-04-01T09:00:00Z'),
  currency: 'USD',
  deelFee: 0,
  documentType: null,
  dueDate: new Date('2024-04-15T00:00:00Z'),
  isOverdue: false,
  issuedAt: new Date('2024-04-01T10:00:00Z'),
  label: 'Minimal',
  paidAt: new Date('2024-04-10T00:00:00Z'),
  status: 'paid',
  total: 10,
  vatId: null,
  vatPercentage: null,
  vatTotal: null,
  adjustment: 0,
  approveDate: null,
  approvers: null,
  bonus: 0,
  commissions: 0,
  contractCountry: null,
  contractStartDate: null,
  contractType: null,
  contractorEmail: null,
  contractorEmployeeName: 'Somebody',
  contractorUniqueIdentifier: null,
  deductions: 0,
  expenses: 0,
  frequency: null,
  generalLedgerAccount: null,
  groupId: null,
  others: 0,
  overtime: 0,
  paymentCurrency: 'USD',
  proRata: 0,
  processingFee: 0,
  work: 10,
  totalPaymentCurrency: 10,
  paymentId: 'FXPAY0912',
  recipientLegalEntityId: null,
  ownerId,
});

export const cases: Cases = {
  getInvoicesByIssueDates: caseFor<IGetInvoicesByIssueDatesQuery>(() => [
    { from: new Date('2024-01-01T00:00:00Z'), to: new Date('2024-02-01T10:00:00Z') },
    { from: '2024-02-01', to: '2024-12-31' },
    // both bounds inclusive
    { from: new Date('2024-01-05T10:00:00Z'), to: new Date('2024-01-05T10:00:00Z') },
    { from: new Date('2024-03-01T10:00:00.001Z'), to: new Date('2030-01-01T00:00:00Z') },
    { from: new Date('2025-01-01T00:00:00Z'), to: new Date('2024-01-01T00:00:00Z') },
    { from: null, to: new Date('2030-01-01T00:00:00Z') },
  ]),
  getInvoicesByIds: caseFor<IGetInvoicesByIdsQuery>(s => [
    { ids: ['FXINV0901', 'FXINV0905', 'FXINV0999'] },
    { ids: s.values('deel_invoices', 'id', 20) as string[] },
    { ids: ['no such invoice'] },
  ]),
  getChargeIdsByPaymentIds: caseFor<IGetChargeIdsByPaymentIdsQuery>(s => [
    // FXPAY0901: charged document + no document; FXPAY0902: charged + uncharged document;
    // FXPAY0903: charged; FXPAY0904: no document; FXPAY0905: uncharged + charged
    { paymentIds: s.values('deel_invoices', 'payment_id', 20) as string[] },
    { paymentIds: ['FXPAY0904', null] },
    { paymentIds: ['no such payment'] },
  ]),
  insertDeelInvoiceRecords: caseFor<IInsertDeelInvoiceRecordsQuery>(s => [
    // every column, amounts rounded to their numeric scales
    {
      id: 'FXINV0911',
      documentId: UNCHARGED_DOCUMENT,
      amount: 1234.567,
      billingType: 'fixed',
      contractId: 'FXC0902',
      createdAt: new Date('2024-04-01T09:00:00Z'),
      currency: 'EUR',
      deelFee: '12.345',
      documentType: 'invoice',
      dueDate: '2024-04-15',
      isOverdue: true,
      issuedAt: '2024-04-01T10:00:00Z',
      label: 'April work',
      paidAt: new Date('2024-04-20T12:00:00Z'),
      status: 'processing',
      total: '1246.91',
      vatId: 'B',
      vatPercentage: '7',
      vatTotal: 0.005,
      adjustment: -3.333,
      approveDate: new Date('2024-04-02T00:00:00Z'),
      approvers: 'approver@example.com',
      bonus: 100,
      commissions: 0.1,
      contractCountry: 'DE',
      contractStartDate: new Date('2023-06-15T08:30:00Z'),
      contractType: 'pay_as_you_go_time_based',
      contractorEmail: 'b@example.com',
      contractorEmployeeName: 'Contractor B',
      contractorUniqueIdentifier: ID(202),
      deductions: 5,
      expenses: '44.10',
      frequency: 'monthly',
      generalLedgerAccount: 'X',
      groupId: 'grp-2',
      others: 1,
      overtime: 2.5,
      paymentCurrency: 'EUR',
      proRata: 0,
      processingFee: 1.5,
      work: 1100.004,
      totalPaymentCurrency: 1246.91,
      paymentId: 'FXPAY0911',
      recipientLegalEntityId: ID(122),
      ownerId: s.businessId,
    },
    minimalInvoice(s.businessId),
    // id taken: 23505
    { ...minimalInvoice(s.businessId), id: 'FXINV0901' },
    // status varchar(12): too long
    { ...minimalInvoice(s.businessId), status: 'much too long status' },
    // no such document: 23503
    { ...minimalInvoice(s.businessId), documentId: s.missingId },
    // amount is NOT NULL
    { ...minimalInvoice(s.businessId), amount: null },
    // numeric(9,2) overflow
    { ...minimalInvoice(s.businessId), deelFee: 10000000 },
  ]),
  updateDeelInvoiceRecords: caseFor<IUpdateDeelInvoiceRecordsQuery>(s => [
    {
      id: 'FXINV0903',
      amount: 3300.335,
      label: 'Updated',
      isOverdue: false,
      dueDate: new Date('2024-02-28T00:00:00Z'),
      approvers: 'someone@example.com',
      paymentCurrency: 'USD',
      documentId: s.values('deel_invoices', 'document_id', 1)[0] as string,
      vatId: 'C',
      work: '3000.1',
    },
    { id: 'FXINV0905' }, // nothing to set: the row comes back unchanged
    { id: 'FXINV0902', createdAt: '2024-01-04T00:00:00Z', paymentId: 'FXPAY0999' },
    { id: 'no such invoice', label: 'nobody' },
    { id: null, label: 'nobody' },
    { id: 'FXINV0902', documentId: s.missingId }, // 23503
    { id: 'FXINV0902', vatId: 'AB' }, // varchar(1): 22001
  ]),
};
