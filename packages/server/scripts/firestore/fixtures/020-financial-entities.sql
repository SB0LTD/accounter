-- Fixture rows for the financial-entities and sort-codes ports: sort codes, businesses with
-- recognition emails, tax categories and their business matches, clients with green-invoice
-- integrations, an extra admin business, and rows that reference one business ("Eta Source") so the
-- replace queries have work to do. Idempotent; ids in the 0f020000-... range.
--
-- The tenant is the demo seed's admin business (the single user_context owner).

DO $$
DECLARE
  owner UUID := (SELECT owner_id FROM accounter_schema.user_context LIMIT 1);
  first_charge UUID := (SELECT id FROM accounter_schema.charges WHERE owner_id = owner ORDER BY id LIMIT 1);
BEGIN
  INSERT INTO accounter_schema.sort_codes (key, name, default_irs_code, owner_id) VALUES
    (100, 'Revenue', 1000, owner),
    (200, 'Expenses', NULL, owner),
    (300, 'Assets', 3000, owner),
    (400, 'Unused', NULL, owner)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.financial_entities (id, type, owner_id, name, sort_code, irs_code, is_active) VALUES
    ('0f020000-0000-4000-8000-000000000001', 'business', owner, 'Alpha Supplies Ltd', 100, 1010, true),
    ('0f020000-0000-4000-8000-000000000002', 'business', owner, 'Beta Services', 200, NULL, false),
    ('0f020000-0000-4000-8000-000000000003', 'business', owner, 'Gamma Unused', NULL, NULL, true),
    ('0f020000-0000-4000-8000-000000000004', 'business', owner, 'Delta Client', NULL, NULL, true),
    ('0f020000-0000-4000-8000-000000000005', 'business', owner, 'Epsilon Wildcard', 100, NULL, true),
    ('0f020000-0000-4000-8000-000000000006', 'business', owner, 'Zeta Target', NULL, NULL, true),
    ('0f020000-0000-4000-8000-000000000007', 'business', owner, 'Eta Source', 200, NULL, true),
    ('0f020000-0000-4000-8000-000000000008', 'business', owner, 'Theta Orphan Entity', NULL, NULL, true),
    ('0f020000-0000-4000-8000-000000000009', 'business', owner, 'Iota Admin', NULL, NULL, true),
    ('0f020000-0000-4000-8000-000000000011', 'tax_category', owner, 'Alpha Tax Category', 100, NULL, true),
    ('0f020000-0000-4000-8000-000000000012', 'tax_category', owner, 'Beta Tax Category', 300, 3010, true),
    ('0f020000-0000-4000-8000-000000000013', 'tax_category', owner, 'Gamma Tax Category', NULL, NULL, true),
    ('0f020000-0000-4000-8000-000000000014', 'tax_category', owner, 'Delta Tax Category', NULL, NULL, false)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.businesses (id, owner_id, vat_number, hebrew_name, address, email, city, zip_code,
      country, suggestion_data, exempt_dealer, optional_vat, pcn874_record_type_override, no_invoices_required,
      can_settle_with_receipt) VALUES
    ('0f020000-0000-4000-8000-000000000001', owner, '512345678', 'אלפא ספקים', '1 Main St', 'billing@alpha.example',
      'Haifa', '3100000', 'ISR', '{"emails": "not-an-array"}', false, false, NULL, false, false),
    ('0f020000-0000-4000-8000-000000000002', owner, NULL, NULL, NULL, NULL, NULL, NULL,
      'USA', '[]', false, true, 'S1', true, false),
    ('0f020000-0000-4000-8000-000000000003', owner, NULL, 'גמא', NULL, NULL, NULL, NULL,
      'GBR', '{"emails": ["Exact@Gamma.example"]}', false, false, NULL, false, false),
    ('0f020000-0000-4000-8000-000000000004', owner, '300000001', 'דלתא לקוח', NULL, 'office@delta.example', 'Tel Aviv', NULL,
      'ISR', NULL, true, false, NULL, false, true),
    ('0f020000-0000-4000-8000-000000000005', owner, NULL, NULL, NULL, NULL, NULL, NULL,
      'ISR', '{"emails": ["*@cloudflare.example", "Billing_Team@Example.com", "50%off@deals.example", "a#b@hash.example", 5, null, {"x": 1}], "phrases": ["eps"]}',
      false, false, NULL, false, false),
    ('0f020000-0000-4000-8000-000000000006', owner, NULL, NULL, NULL, NULL, NULL, NULL,
      'ISR', NULL, false, false, NULL, false, false),
    ('0f020000-0000-4000-8000-000000000007', owner, NULL, 'אטה', NULL, NULL, NULL, NULL,
      'ISR', '{"emails": []}', false, false, NULL, false, false),
    ('0f020000-0000-4000-8000-000000000009', owner, '999999999', NULL, NULL, NULL, NULL, NULL,
      'ISR', NULL, false, false, NULL, false, false)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.businesses_admin (id, owner_id, company_tax_id, business_registration_start_date,
      advance_tax_rates, tax_advances_ids) VALUES
    ('0f020000-0000-4000-8000-000000000009', owner, '123456789', '2020-01-01',
      ARRAY['{"date": "2024-01-01", "rate": 0.1}'::jsonb], ARRAY['{"year": 2024, "id": "TA-1"}'::jsonb])
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.tax_categories (id, hashavshevet_name, tax_excluded, owner_id) VALUES
    ('0f020000-0000-4000-8000-000000000011', 'ALPHA-HV', false, owner),
    ('0f020000-0000-4000-8000-000000000012', NULL, true, owner),
    ('0f020000-0000-4000-8000-000000000013', 'GAMMA-HV', false, owner),
    ('0f020000-0000-4000-8000-000000000014', NULL, false, owner)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.business_tax_category_match (business_id, owner_id, tax_category_id) VALUES
    ('0f020000-0000-4000-8000-000000000001', owner, '0f020000-0000-4000-8000-000000000011'),
    ('0f020000-0000-4000-8000-000000000002', owner, '0f020000-0000-4000-8000-000000000011'),
    ('0f020000-0000-4000-8000-000000000004', owner, '0f020000-0000-4000-8000-000000000012'),
    ('0f020000-0000-4000-8000-000000000007', owner, '0f020000-0000-4000-8000-000000000012')
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.clients (business_id, green_invoice_id, emails, integrations, document_type, remark, owner_id) VALUES
    ('0f020000-0000-4000-8000-000000000004', '0f020000-0000-4000-8000-000000000041', ARRAY['a@delta.example', 'b@delta.example'],
      '{"greenInvoiceId": "0f020000-0000-4000-8000-000000000041"}', 'INVOICE', 'fixture client', owner),
    ('0f020000-0000-4000-8000-000000000001', '0f020000-0000-4000-8000-000000000042', NULL,
      '{"greenInvoiceId": "{0F020000000040008000000000000042}"}', 'PROFORMA', NULL, owner),
    ('0f020000-0000-4000-8000-000000000007', '0f020000-0000-4000-8000-000000000043', ARRAY['eta@source.example'],
      '{"greenInvoiceId": "0f020000-0000-4000-8000-000000000043", "hiveId": "hive-7"}', 'RECEIPT', NULL, owner),
    ('0f020000-0000-4000-8000-000000000005', '0f020000-0000-4000-8000-000000000044', NULL,
      NULL, 'PROFORMA', NULL, owner),
    ('0f020000-0000-4000-8000-000000000002', '0f020000-0000-4000-8000-000000000045', NULL,
      '[1, 2]', 'INVOICE_RECEIPT', NULL, owner)
  ON CONFLICT DO NOTHING;

  -- a bank account owned by "Alpha Supplies Ltd", with per-currency tax categories
  INSERT INTO accounter_schema.financial_accounts (id, account_number, owner, type, owner_id) VALUES
    ('0f020000-0000-4000-8000-000000000061', 'FX-020-1', '0f020000-0000-4000-8000-000000000001', 'BANK_ACCOUNT', owner)
  ON CONFLICT DO NOTHING;
  INSERT INTO accounter_schema.financial_accounts_tax_categories (financial_account_id, currency, tax_category_id, owner_id) VALUES
    ('0f020000-0000-4000-8000-000000000061', 'USD', '0f020000-0000-4000-8000-000000000011', owner),
    ('0f020000-0000-4000-8000-000000000061', 'EUR', '0f020000-0000-4000-8000-000000000012', owner)
  ON CONFLICT DO NOTHING;

  -- rows that reference "Eta Source" (07), some on two columns at once
  INSERT INTO accounter_schema.ledger_records (id, owner_id, charge_id, debit_entity1, debit_local_amount1,
      credit_entity1, credit_local_amount1, debit_entity2, debit_local_amount2, credit_entity2, credit_local_amount2,
      currency, invoice_date, value_date, description) VALUES
    ('0f020000-0000-4000-8000-000000000021', owner, first_charge, '0f020000-0000-4000-8000-000000000007', 100,
      '0f020000-0000-4000-8000-000000000007', 100, NULL, NULL, NULL, NULL, 'ILS', '2024-03-01', '2024-03-01', 'fixture self'),
    ('0f020000-0000-4000-8000-000000000022', owner, first_charge, '0f020000-0000-4000-8000-000000000001', 50,
      NULL, NULL, '0f020000-0000-4000-8000-000000000007', 50, '0f020000-0000-4000-8000-000000000007', 100,
      'ILS', '2024-03-02', '2024-03-02', 'fixture second'),
    ('0f020000-0000-4000-8000-000000000023', owner, first_charge, '0f020000-0000-4000-8000-000000000001', 70,
      '0f020000-0000-4000-8000-000000000002', 70, NULL, NULL, NULL, NULL, 'USD', '2024-03-03', '2024-03-03', 'fixture other')
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.misc_expenses (id, charge_id, amount, currency, description, creditor_id, debtor_id,
      invoice_date, value_date, owner_id) VALUES
    ('0f020000-0000-4000-8000-000000000031', first_charge, 50, 'ILS', 'fixture self',
      '0f020000-0000-4000-8000-000000000007', '0f020000-0000-4000-8000-000000000007', '2024-03-01', '2024-03-01 00:00', owner),
    ('0f020000-0000-4000-8000-000000000032', first_charge, 60, 'ILS', 'fixture debtor',
      '0f020000-0000-4000-8000-000000000001', '0f020000-0000-4000-8000-000000000007', '2024-03-01', '2024-03-01 00:00', owner),
    ('0f020000-0000-4000-8000-000000000033', first_charge, 70, 'USD', 'fixture creditor',
      '0f020000-0000-4000-8000-000000000007', '0f020000-0000-4000-8000-000000000002', '2024-03-01', '2024-03-01 00:00', owner)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.dividends (id, business_id, amount, date, owner_id) VALUES
    ('0f020000-0000-4000-8000-000000000051', '0f020000-0000-4000-8000-000000000007', 1000, '2024-06-30', owner)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.pension_funds (id, name, type, owner_id) VALUES
    ('0f020000-0000-4000-8000-000000000007', 'Eta Fund', 'pension', owner)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.charge_unbalanced_ledger_businesses (charge_id, business_id, remark, owner_id) VALUES
    (first_charge, '0f020000-0000-4000-8000-000000000007', 'fixture', owner)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.charge_balance_cancellation (charge_id, description, business_id, owner_id) VALUES
    (first_charge, 'fixture', '0f020000-0000-4000-8000-000000000007', owner)
  ON CONFLICT DO NOTHING;
END $$;
