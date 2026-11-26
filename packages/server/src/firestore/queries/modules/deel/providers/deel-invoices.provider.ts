import type { Row } from '../../../../catalog.js';
import type {
  IGetChargeIdsByPaymentIdsQuery,
  IGetInvoicesByIdsQuery,
  IGetInvoicesByIssueDatesQuery,
  IGetReceiptToChargeQuery,
  IInsertDeelInvoiceRecordsQuery,
  IUpdateDeelInvoiceRecordsQuery,
} from '../../../../../modules/deel/__generated__/deel-invoices.types.js';
import { coalescePatch, distinctOn, orderBy } from '../../../../sql-helpers.js';
import type { QueryDb } from '../../../../query-db.js';
import { port } from '../../../port.js';
import { timestampParam, typed } from '../../salaries/_helpers.js';

type InvoiceRow = Row<'deel_invoices'>;

/** Documents by id, as the request may read them (RLS). */
async function documentsById(db: QueryDb, ids: readonly (string | null)[]) {
  const documents = await db.whereIn('documents', 'id', ids);
  return new Map(documents.map(document => [document.id, document]));
}

/**
 * SELECT * FROM deel_invoices WHERE issued_at >= $from AND issued_at <= $to
 */
export const getInvoicesByIssueDates = port<IGetInvoicesByIssueDatesQuery>(
  async ({ from, to }, db) => {
    if (from == null || to == null) return [];
    const start = timestampParam(from).getTime();
    const end = timestampParam(to).getTime();
    return (await db.rows('deel_invoices')).filter(invoice => {
      const issued = invoice.issued_at.getTime();
      return issued >= start && issued <= end;
    });
  },
);

/** SELECT * FROM deel_invoices WHERE id IN $$ids */
export const getInvoicesByIds = port<IGetInvoicesByIdsQuery>(async ({ ids }, db) =>
  db.whereIn('deel_invoices', 'id', ids),
);

/**
 * SELECT d.charge_id, i.payment_id
 * FROM deel_invoices i
 * LEFT JOIN documents d ON i.document_id = d.id AND d.charge_id IS NOT NULL
 * WHERE i.payment_id IN $$paymentIds
 */
export const getChargeIdsByPaymentIds = port<IGetChargeIdsByPaymentIdsQuery>(
  async ({ paymentIds }, db) => {
    const invoices = await db.whereIn('deel_invoices', 'payment_id', paymentIds);
    const documents = await documentsById(
      db,
      invoices.map(invoice => invoice.document_id),
    );
    return invoices.map(invoice => {
      const document = invoice.document_id == null ? undefined : documents.get(invoice.document_id);
      return { charge_id: document?.charge_id ?? null, payment_id: invoice.payment_id };
    });
  },
);

/**
 * SELECT DISTINCT ON (di.payment_id) di.payment_id, d.charge_id
 * FROM deel_invoices di
 * LEFT JOIN documents d ON d.id = di.document_id
 * ORDER BY di.payment_id, di.created_at ASC
 *
 * Invoices of one payment with the same created_at tie: Postgres may keep either (none in fixtures).
 */
export const getReceiptToCharge = port<IGetReceiptToChargeQuery>(async (_params, db) => {
  const invoices = await db.rows('deel_invoices');
  const documents = await documentsById(
    db,
    invoices.map(invoice => invoice.document_id),
  );
  const ordered = orderBy(invoices, [
    { value: invoice => invoice.payment_id },
    { value: invoice => invoice.created_at },
  ]);
  return distinctOn(ordered, invoice => invoice.payment_id).map(invoice => ({
    payment_id: invoice.payment_id,
    charge_id:
      invoice.document_id == null ? null : (documents.get(invoice.document_id)?.charge_id ?? null),
  }));
});

/** The deel_invoices columns from the camel-case parameters (timestamps parsed as Postgres does). */
function invoiceColumns(params: IInsertDeelInvoiceRecordsQuery['params']) {
  const timestamp = (value: Date | string | null | void) =>
    value == null ? value : timestampParam(value);
  return {
    document_id: params.documentId,
    amount: params.amount,
    billing_type: params.billingType,
    contract_id: params.contractId,
    created_at: timestamp(params.createdAt),
    currency: params.currency,
    deel_fee: params.deelFee,
    document_type: params.documentType,
    due_date: timestamp(params.dueDate),
    is_overdue: params.isOverdue,
    issued_at: timestamp(params.issuedAt),
    label: params.label,
    paid_at: timestamp(params.paidAt),
    status: params.status,
    total: params.total,
    vat_id: params.vatId,
    vat_percentage: params.vatPercentage,
    vat_total: params.vatTotal,
    adjustment: params.adjustment,
    approve_date: timestamp(params.approveDate),
    approvers: params.approvers,
    bonus: params.bonus,
    commissions: params.commissions,
    contract_country: params.contractCountry,
    contract_start_date: timestamp(params.contractStartDate),
    contract_type: params.contractType,
    contractor_email: params.contractorEmail,
    contractor_employee_name: params.contractorEmployeeName,
    contractor_unique_identifier: params.contractorUniqueIdentifier,
    deductions: params.deductions,
    expenses: params.expenses,
    frequency: params.frequency,
    general_ledger_account: params.generalLedgerAccount,
    group_id: params.groupId,
    others: params.others,
    overtime: params.overtime,
    payment_currency: params.paymentCurrency,
    pro_rata: params.proRata,
    processing_fee: params.processingFee,
    work: params.work,
    total_payment_currency: params.totalPaymentCurrency,
    payment_id: params.paymentId,
    recipient_legal_entity_id: params.recipientLegalEntityId,
  };
}

/**
 * INSERT INTO deel_invoices (id, document_id, amount, billing_type, contract_id, created_at,
 *   currency, deel_fee, document_type, due_date, is_overdue, issued_at, label, paid_at, status,
 *   total, vat_id, vat_percentage, vat_total, adjustment, approve_date, approvers, bonus,
 *   commissions, contract_country, contract_start_date, contract_type, contractor_email,
 *   contractor_employee_name, contractor_unique_identifier, deductions, expenses, frequency,
 *   general_ledger_account, group_id, others, overtime, payment_currency, pro_rata,
 *   processing_fee, "work", total_payment_currency, payment_id, recipient_legal_entity_id, owner_id)
 * VALUES ($id, $documentId, ..., $recipientLegalEntityId, $ownerId)
 * RETURNING *
 */
export const insertDeelInvoiceRecords = port<IInsertDeelInvoiceRecordsQuery>(async (params, db) => {
  const values: Record<string, unknown> = { id: params.id ?? null };
  for (const [column, value] of Object.entries(invoiceColumns(params))) {
    values[column] = value ?? null;
  }
  values.owner_id = params.ownerId ?? null;
  const row = await db.insert('deel_invoices', typed('deel_invoices', values));
  return row ? [row] : [];
});

/**
 * UPDATE deel_invoices SET <column> = COALESCE($param, <column>) for every column but id and owner_id
 * WHERE id = $id
 * RETURNING *
 */
export const updateDeelInvoiceRecords = port<IUpdateDeelInvoiceRecordsQuery>(async (params, db) => {
  if (params.id == null) return [];
  const patch = typed('deel_invoices', coalescePatch(invoiceColumns(params)));
  const updated: InvoiceRow[] = [];
  for (const row of await db.where('deel_invoices', { id: params.id })) {
    updated.push(await db.update('deel_invoices', row, patch));
  }
  return updated;
});
