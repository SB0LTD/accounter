-- Fixture rows for the documents, misc-expenses, contracts and accountant-approval ports.
-- Idempotent (ON CONFLICT DO NOTHING); ids in the 0f050000-0000-4000-8000-... range; everything is
-- owned by the demo tenant (the single user_context owner).
--
-- What the demo seed lacks and these rows add:
-- - documents with every column set, with none set, with negative / huge / tiny float amounts, with
--   distinct created_at (the demo documents all share one), missing counterparties, no charge;
-- - issued documents (documents_issued) in every status, with linked ids, empty and NULL arrays;
-- - misc expenses, client contracts (two fixture clients), active / inactive / NULL is_active;
-- - charges: APPROVED with documents, a ledger record and two depreciation rows (extended_charges
--   repeats a charge per depreciation row), UNAPPROVED without transactions (unmatched documents),
--   APPROVED with nothing at all (no dates).

DO $$
DECLARE
  owner UUID := (SELECT owner_id FROM accounter_schema.user_context LIMIT 1);
BEGIN
  -- two client businesses
  INSERT INTO accounter_schema.financial_entities (id, type, owner_id, name) VALUES
    ('0f050000-0000-4000-8000-000000000001', 'business', owner, 'Globex Fixture Client'),
    ('0f050000-0000-4000-8000-000000000003', 'business', owner, 'Initech Fixture Client')
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.businesses (id, owner_id, can_settle_with_receipt) VALUES
    ('0f050000-0000-4000-8000-000000000001', owner, true),
    ('0f050000-0000-4000-8000-000000000003', owner, false)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.clients (business_id, green_invoice_id, document_type, owner_id) VALUES
    ('0f050000-0000-4000-8000-000000000001', '0f050000-0000-4000-8000-000000000002', 'INVOICE', owner),
    ('0f050000-0000-4000-8000-000000000003', '0f050000-0000-4000-8000-000000000004', 'PROFORMA', owner)
  ON CONFLICT DO NOTHING;

  -- charges
  INSERT INTO accounter_schema.charges (id, owner_id, accountant_status, user_description) VALUES
    ('0f050000-0000-4000-8000-000000000101', owner, 'APPROVED', 'fixture: documents, ledger, depreciation'),
    ('0f050000-0000-4000-8000-000000000102', owner, 'UNAPPROVED', 'fixture: documents, no transactions'),
    ('0f050000-0000-4000-8000-000000000103', owner, 'APPROVED', 'fixture: empty charge')
  ON CONFLICT DO NOTHING;

  -- documents
  INSERT INTO accounter_schema.documents (
    id, type, serial_number, date, total_amount, currency_code, vat_amount, is_reviewed,
    debtor_id, creditor_id, no_vat_amount, charge_id, vat_report_date_override, allocation_number,
    exchange_rate_override, file_hash, image_url, file_url, description, remarks, created_at,
    updated_at, owner_id
  ) VALUES
    ('0f050000-0000-4000-8000-000000000201', 'RECEIPT', 'RC-100', '2024-03-10', 1234.56, 'ILS', 188.32, true,
      '0f050000-0000-4000-8000-000000000001', owner, 1046.24, '0f050000-0000-4000-8000-000000000101', '2024-04-01', '123456789',
      3.712345, '987654321', 'https://example.test/d1.png', NULL, 'Office chairs', 'paid in cash 50%', '2025-01-01 10:00:00+00',
      '2025-01-01 10:00:00+00', owner),
    ('0f050000-0000-4000-8000-000000000202', 'UNPROCESSED', NULL, NULL, NULL, NULL, NULL, false,
      NULL, NULL, NULL, NULL, NULL, NULL,
      NULL, NULL, NULL, NULL, NULL, NULL, '2025-01-02 10:00:00+00',
      '2025-01-02 10:00:00+00', owner),
    ('0f050000-0000-4000-8000-000000000203', 'OTHER', NULL, '2023-05-01', NULL, NULL, NULL, false,
      NULL, '0f050000-0000-4000-8000-000000000003', NULL, '0f050000-0000-4000-8000-000000000101', NULL, NULL,
      NULL, NULL, NULL, 'https://example.test/d3.pdf', 'Scanned contract', NULL, '2025-01-03 10:00:00+00',
      '2025-01-03 10:00:00+00', owner),
    ('0f050000-0000-4000-8000-000000000204', 'PROFORMA', 'PF-7', '2024-12-31', -250.5, 'EUR', 0, false,
      '0f050000-0000-4000-8000-000000000003', owner, NULL, '0f050000-0000-4000-8000-000000000102', NULL, NULL,
      NULL, NULL, NULL, NULL, 'Consulting retainer', NULL, '2025-01-04 10:00:00+00',
      '2025-01-04 10:00:00+00', owner),
    ('0f050000-0000-4000-8000-000000000205', 'INVOICE', 'INV-F-002', '2024-06-30', 1234567890123456, 'ILS', 0.00001, false,
      owner, '0f050000-0000-4000-8000-000000000001', NULL, '0f050000-0000-4000-8000-000000000101', '2024-07-15', NULL,
      NULL, '555', NULL, NULL, NULL, 'Large_amount', '2025-01-05 10:00:00+00',
      '2025-01-05 10:00:00+00', owner),
    ('0f050000-0000-4000-8000-000000000206', 'INVOICE', NULL, NULL, NULL, NULL, NULL, false,
      NULL, NULL, NULL, NULL, NULL, NULL,
      NULL, NULL, NULL, NULL, NULL, NULL, '2025-01-06 10:00:00+00',
      '2025-01-06 10:00:00+00', owner),
    ('0f050000-0000-4000-8000-000000000207', 'INVOICE', 'INV-F-001', '2024-02-01', 99.99, 'USD', 15.3, false,
      '0f050000-0000-4000-8000-000000000003', owner, 84.690, '0f050000-0000-4000-8000-000000000102', NULL, NULL,
      3.6, '111', NULL, 'https://example.test/d7.pdf', 'Hosting', NULL, '2025-01-07 10:00:00+00',
      '2025-01-07 10:00:00+00', owner),
    ('0f050000-0000-4000-8000-000000000208', 'CREDIT_INVOICE', 'cr-f-1', '2024-02-10', 10, 'ILS', NULL, false,
      '0f050000-0000-4000-8000-000000000001', owner, NULL, '0f050000-0000-4000-8000-000000000102', NULL, NULL,
      NULL, NULL, NULL, NULL, NULL, 'Refund for Office chairs', '2025-01-08 10:00:00+00',
      '2025-01-08 10:00:00+00', owner),
    -- lower-case serial: sorts after every upper-case one in C collation
    ('0f050000-0000-4000-8000-000000000209', 'INVOICE', 'inv-f-000', '2024-09-09', 5, 'ILS', 0.85, false,
      '0f050000-0000-4000-8000-000000000001', owner, NULL, NULL, NULL, NULL,
      NULL, NULL, NULL, NULL, NULL, NULL, '2025-01-09 10:00:00+00',
      '2025-01-09 10:00:00+00', owner)
  ON CONFLICT DO NOTHING;

  -- issued documents
  INSERT INTO accounter_schema.documents_issued (id, external_id, status, linked_document_ids, owner_id) VALUES
    ('0f050000-0000-4000-8000-000000000201', 'gi-ext-001', 'OPEN',
      ARRAY['0f050000-0000-4000-8000-000000000205', '0f050000-0000-4000-8000-000000000207']::uuid[], owner),
    ('0f050000-0000-4000-8000-000000000204', 'gi-ext-004', 'CLOSED', NULL, owner),
    ('0f050000-0000-4000-8000-000000000205', 'gi-ext-005', 'CLOSED', NULL, owner),
    ('0f050000-0000-4000-8000-000000000206', 'gi-ext-006', 'OPEN', '{}'::uuid[], owner),
    ('0f050000-0000-4000-8000-000000000207', 'gi-ext-007', 'CANCELLED',
      ARRAY['0f050000-0000-4000-8000-000000000208']::uuid[], owner),
    ('0f050000-0000-4000-8000-000000000208', 'gi-ext-008', 'MANUALLY_CLOSED', NULL, owner),
    ('0f050000-0000-4000-8000-000000000209', 'gi-ext-009', 'OPEN', NULL, owner)
  ON CONFLICT DO NOTHING;

  -- misc expenses
  INSERT INTO accounter_schema.misc_expenses (
    id, charge_id, creditor_id, debtor_id, amount, currency, description, invoice_date, value_date, owner_id
  ) VALUES
    ('0f050000-0000-4000-8000-000000000301', '0f050000-0000-4000-8000-000000000101',
      '0f050000-0000-4000-8000-000000000001', owner, 150.75, 'ILS', 'Taxi', '2024-03-01', '2024-03-02 08:30:00', owner),
    ('0f050000-0000-4000-8000-000000000302', '0f050000-0000-4000-8000-000000000101',
      owner, '0f050000-0000-4000-8000-000000000003', -20.000, 'USD', NULL, '2024-03-05', '2024-03-05 00:00:00', owner),
    ('0f050000-0000-4000-8000-000000000303', '0f050000-0000-4000-8000-000000000102',
      '0f050000-0000-4000-8000-000000000003', '0f050000-0000-4000-8000-000000000001', 1000, 'EUR', 'Rent', '2024-04-01',
      '2024-04-01 12:00:00', owner)
  ON CONFLICT DO NOTHING;

  -- client contracts
  INSERT INTO accounter_schema.clients_contracts (
    id, client_id, start_date, end_date, remarks, document_type, amount, currency, billing_cycle,
    product, plan, is_active, signed_agreement, ms_cloud, purchase_orders, operations_count, owner_id
  ) VALUES
    ('0f050000-0000-4000-8000-000000000401', '0f050000-0000-4000-8000-000000000001', '2024-01-01', '2024-12-31',
      'annual', 'INVOICE', 1500.5, 'USD', 'monthly', 'HIVE', 'PRO', true, 'https://example.test/k1.pdf',
      'https://ms.example.test', ARRAY['PO-1', 'PO-2'], 1000000, owner),
    ('0f050000-0000-4000-8000-000000000402', '0f050000-0000-4000-8000-000000000001', '2023-01-01', '2023-12-31',
      NULL, 'PROFORMA', 100, 'ILS', 'annual', NULL, NULL, false, NULL,
      NULL, '{}', 0, owner),
    ('0f050000-0000-4000-8000-000000000403', '0f050000-0000-4000-8000-000000000003', '2024-01-01', '2025-01-01',
      'no flag', 'PROFORMA', 42, 'EUR', 'annual', 'STELLATE', NULL, NULL, NULL,
      NULL, ARRAY['PO-9'], 5, owner)
  ON CONFLICT DO NOTHING;

  -- ledger record and depreciation for the APPROVED charge (extended_charges date bounds, row count)
  INSERT INTO accounter_schema.ledger_records (
    id, owner_id, charge_id, debit_entity1, credit_entity1, currency, invoice_date, value_date
  ) VALUES
    ('0f050000-0000-4000-8000-000000000501', owner, '0f050000-0000-4000-8000-000000000101',
      '0f050000-0000-4000-8000-000000000001', owner, 'ILS', '2023-06-15', '2023-06-30')
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.depreciation_categories (id, name, percentage) VALUES
    ('0f050000-0000-4000-8000-000000000901', 'Fixture equipment', 15.00)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.depreciation (id, charge_id, activation_date, category, owner_id) VALUES
    ('0f050000-0000-4000-8000-000000000601', '0f050000-0000-4000-8000-000000000101', '2024-03-10',
      '0f050000-0000-4000-8000-000000000901', owner),
    ('0f050000-0000-4000-8000-000000000602', '0f050000-0000-4000-8000-000000000101', '2024-03-10',
      '0f050000-0000-4000-8000-000000000901', owner)
  ON CONFLICT DO NOTHING;
END $$;
