-- Fixture rows for the financial-accounts, salaries and deel ports. Applied by
-- `yarn workspace @accounter/server firestore:fixtures --only 090-accounts-salaries`.
-- Idempotent: every insert skips rows that exist. Ids are fixed UUIDs in the
-- 0f090000-0000-4000-8000-xxxxxxxxxxxx range. Owned by the demo tenant (the single user_context owner).
--
-- Existing demo rows referenced (charges, documents, tax categories) are taken from the END of the id
-- order, so cases elsewhere that pick `s.ids(table, 1)` (the first ids) are not affected.

DO $$
DECLARE
  owner UUID := (SELECT owner_id FROM accounter_schema.user_context LIMIT 1);
  last_charge UUID := (SELECT id FROM accounter_schema.charges WHERE owner_id = owner ORDER BY id DESC LIMIT 1);
  prev_charge UUID := (SELECT id FROM accounter_schema.charges WHERE owner_id = owner ORDER BY id DESC OFFSET 1 LIMIT 1);
  last_doc UUID := (SELECT id FROM accounter_schema.documents WHERE owner_id = owner AND charge_id IS NOT NULL ORDER BY id DESC LIMIT 1);
  prev_doc UUID := (SELECT id FROM accounter_schema.documents WHERE owner_id = owner AND charge_id IS NOT NULL ORDER BY id DESC OFFSET 1 LIMIT 1);
  third_doc UUID := (SELECT id FROM accounter_schema.documents WHERE owner_id = owner AND charge_id IS NOT NULL ORDER BY id DESC OFFSET 2 LIMIT 1);
  tc1 UUID := (SELECT id FROM accounter_schema.tax_categories WHERE owner_id = owner ORDER BY id DESC LIMIT 1);
  tc2 UUID := (SELECT id FROM accounter_schema.tax_categories WHERE owner_id = owner ORDER BY id DESC OFFSET 1 LIMIT 1);
  tc3 UUID := (SELECT id FROM accounter_schema.tax_categories WHERE owner_id = owner ORDER BY id DESC OFFSET 2 LIMIT 1);
BEGIN
  -- Businesses: employees (101-103), funds (111-113), Deel contractors (121-123), a second employer (131)
  INSERT INTO accounter_schema.financial_entities (id, type, owner_id, name) VALUES
    ('0f090000-0000-4000-8000-000000000101', 'business', owner, 'Fixture Employee One'),
    ('0f090000-0000-4000-8000-000000000102', 'business', owner, 'Fixture Employee Two'),
    ('0f090000-0000-4000-8000-000000000103', 'business', owner, 'Fixture Employee Three'),
    ('0f090000-0000-4000-8000-000000000111', 'business', owner, 'Fixture Pension Fund'),
    ('0f090000-0000-4000-8000-000000000112', 'business', owner, 'Fixture Training Fund'),
    ('0f090000-0000-4000-8000-000000000113', 'business', owner, 'Fixture Untyped Fund'),
    ('0f090000-0000-4000-8000-000000000121', 'business', owner, 'Fixture Deel Contractor A'),
    ('0f090000-0000-4000-8000-000000000122', 'business', owner, 'Fixture Deel Contractor B'),
    ('0f090000-0000-4000-8000-000000000123', 'business', owner, 'Fixture Deel Contractor C'),
    ('0f090000-0000-4000-8000-000000000131', 'business', owner, 'Fixture Second Employer')
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.businesses (id, owner_id) VALUES
    ('0f090000-0000-4000-8000-000000000101', owner),
    ('0f090000-0000-4000-8000-000000000102', owner),
    ('0f090000-0000-4000-8000-000000000103', owner),
    ('0f090000-0000-4000-8000-000000000111', owner),
    ('0f090000-0000-4000-8000-000000000112', owner),
    ('0f090000-0000-4000-8000-000000000113', owner),
    ('0f090000-0000-4000-8000-000000000121', owner),
    ('0f090000-0000-4000-8000-000000000122', owner),
    ('0f090000-0000-4000-8000-000000000123', owner),
    ('0f090000-0000-4000-8000-000000000131', owner)
  ON CONFLICT DO NOTHING;

  -- financial accounts: 001 has tax categories (delete raises), 002 and 003 have bank accounts
  -- (delete cascades), 004 and 005 share an account number, 004 has nothing attached.
  INSERT INTO accounter_schema.financial_accounts
    (id, account_number, account_name, private_business, owner, type, owner_id, bank_number, branch_number)
  VALUES
    ('0f090000-0000-4000-8000-000000000001', '090-1001', 'Fixture card', 'business', owner, 'CREDIT_CARD', owner, NULL, NULL),
    ('0f090000-0000-4000-8000-000000000002', '090-1002', NULL, 'business', owner, 'BANK_ACCOUNT', owner, 12, 600),
    ('0f090000-0000-4000-8000-000000000003', '090-1003', 'No owner', 'private', NULL, 'BANK_ACCOUNT', owner, 10, 800),
    ('0f090000-0000-4000-8000-000000000004', '090-1004', 'Wallet', 'business', '0f090000-0000-4000-8000-000000000131', 'CRYPTO_WALLET', owner, NULL, NULL),
    ('0f090000-0000-4000-8000-000000000005', '090-1004', 'Securities', 'private', '0f090000-0000-4000-8000-000000000131', 'FOREIGN_SECURITIES', owner, NULL, NULL)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.financial_accounts_tax_categories (financial_account_id, currency, tax_category_id, owner_id) VALUES
    ('0f090000-0000-4000-8000-000000000001', 'USD', tc1, owner),
    ('0f090000-0000-4000-8000-000000000001', 'EUR', tc2, owner),
    ('0f090000-0000-4000-8000-000000000001', 'ILS', tc3, owner),
    ('0f090000-0000-4000-8000-000000000002', 'ILS', tc1, owner)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.financial_bank_accounts (
    id, bank_number, branch_number, iban, swift_code, extended_bank_number, party_preferred_indication,
    party_account_involvement_code, account_deal_date, account_update_date, meteg_doar_net,
    kod_harshaat_peilut, account_closing_reason_code, account_agreement_opening_date,
    service_authorization_desc, branch_type_code, mymail_entitlement_switch, product_label, owner_id
  ) VALUES
    ('0f090000-0000-4000-8000-000000000002', 12, 600, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
     NULL, NULL, NULL, NULL, NULL, NULL, NULL, owner),
    ('0f090000-0000-4000-8000-000000000003', 10, 800, 'IL620108000000099999999', 'LUMIILITXXX', 10800, 1,
     3, 20190101, 20240115, 1, 0, 0, 20190102, 'Full', 2, 0, 'Fixture label', owner)
  ON CONFLICT DO NOTHING;

  -- salaries: employees, funds, records
  INSERT INTO accounter_schema.employees (business_id, first_name, last_name, employer, start_work_date, end_work_date, owner_id, national_id, israel_resident, bank_number, account_number, branch_number) VALUES
    ('0f090000-0000-4000-8000-000000000101', 'Dana', 'One', owner, '2022-03-01', NULL, owner, '000000018', true, 12, 123456, 600),
    ('0f090000-0000-4000-8000-000000000102', 'Eli', 'Two', owner, '2023-07-15', '2024-12-31', owner, NULL, NULL, NULL, NULL, NULL),
    ('0f090000-0000-4000-8000-000000000103', 'Gal', 'Three', '0f090000-0000-4000-8000-000000000131', '2024-01-01', NULL, owner, NULL, false, NULL, NULL, NULL)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.pension_funds (id, name, otsar_id, type, management_fees, links, emails, owner_id) VALUES
    ('0f090000-0000-4000-8000-000000000111', 'Fixture Pension Fund', '512000001', 'pension', 0.25, ARRAY['https://example.com/pension'], ARRAY['a@example.com', 'b@example.com'], owner),
    ('0f090000-0000-4000-8000-000000000112', 'Fixture Training Fund', NULL, 'training_fund', NULL, NULL, NULL, owner),
    ('0f090000-0000-4000-8000-000000000113', 'Fixture Untyped Fund', NULL, NULL, 1.10, ARRAY[]::text[], NULL, owner)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.salaries (
    month, employee_id, employer, employee, direct_payment_amount, base_salary,
    social_security_amount_employee, social_security_amount_employer, health_payment_amount, tax_amount,
    pension_employer_amount, pension_employee_amount, pension_employee_percentage,
    pension_employer_percentage, compensations_employer_percentage, compensations_employer_amount,
    training_fund_employer_amount, training_fund_employee_amount, training_fund_employer_percentage,
    training_fund_employee_percentage, pension_fund_id, training_fund_id, work_days, hours, hourly_rate,
    added_vacation_days, vacation_days_balance, sickness_days_balance, global_additional_hours, zkufot,
    recovery, gift, bonus, vacation_takeout, charge_id, job_percentage, travel_and_subsistence, owner_id
  ) VALUES
    ('2024-01', '0f090000-0000-4000-8000-000000000101', owner, 'Dana One', 15234.56, 20000.00,
     812.40, 760.15, 621.00, 2531.89, 1300.00, 1200.00, 6, 6.5, 8.33, 1666.00, 1500.00, 500.00, 7.5,
     2.5, '0f090000-0000-4000-8000-000000000111', '0f090000-0000-4000-8000-000000000112', 21.50, 182.00,
     NULL, 1.25, 12.75, 18.00, 3.50, 120, 418.00, NULL, 1000.00, NULL, last_charge, 100, 315.20, owner),
    ('2024-01', '0f090000-0000-4000-8000-000000000102', owner, 'Eli Two', 4800.00, NULL,
     NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
     80.00, 60.00, NULL, NULL, NULL, NULL, NULL, NULL, 250.00, NULL, NULL, prev_charge, 50, NULL, owner),
    ('2024-02', '0f090000-0000-4000-8000-000000000101', owner, 'Dana One', 15100.00, 20000.00,
     812.40, 760.15, 621.00, 2600.10, 1300.00, 1200.00, 6, 6.5, 8.33, 1666.00, 1500.00, 500.00, 7.5, 2.5,
     '0f090000-0000-4000-8000-000000000111', '0f090000-0000-4000-8000-000000000112', 20.00, 170.00, NULL,
     1.25, 14.00, 18.00, NULL, 120, NULL, NULL, NULL, 2.00, NULL, 100, 315.20, owner),
    ('2024-02', '0f090000-0000-4000-8000-000000000102', owner, 'Eli Two', 5000.00, NULL,
     NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
     83.50, 60.00, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, last_charge, 50, NULL, owner),
    ('2024-03', '0f090000-0000-4000-8000-000000000103', '0f090000-0000-4000-8000-000000000131', NULL, 9999.99, 12000.00,
     NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '0f090000-0000-4000-8000-000000000113', NULL, NULL,
     NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 75.5, NULL, owner)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.recovery (year, day_value) VALUES
    (2023, 418.00),
    (2024, 418.00)
  ON CONFLICT DO NOTHING;

  -- deel: a document without a charge, two workers, invoices
  INSERT INTO accounter_schema.documents (id, owner_id, charge_id, serial_number) VALUES
    ('0f090000-0000-4000-8000-000000000301', owner, NULL, 'FX-DEEL-0301')
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.deel_workers (contract_id, contractor_id, contractor_name, contract_start_date, business_id, owner_id) VALUES
    ('FXC0901', '0f090000-0000-4000-8000-000000000201', 'Contractor A', '2024-01-01 00:00:00+00', '0f090000-0000-4000-8000-000000000121', owner),
    ('FXC0902', '0f090000-0000-4000-8000-000000000202', 'Contractor B', '2023-06-15 08:30:00+00', '0f090000-0000-4000-8000-000000000122', owner)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.deel_invoices (
    id, document_id, amount, billing_type, contract_id, created_at, currency, deel_fee, document_type,
    due_date, is_overdue, issued_at, label, paid_at, status, total, vat_id, vat_percentage, vat_total,
    adjustment, approve_date, approvers, bonus, commissions, contract_country, contract_start_date,
    contract_type, contractor_email, contractor_employee_name, contractor_unique_identifier, deductions,
    expenses, frequency, general_ledger_account, group_id, others, overtime, payment_currency, pro_rata,
    processing_fee, "work", total_payment_currency, payment_id, recipient_legal_entity_id, owner_id
  ) VALUES
    -- FXPAY0901: earliest invoice has a charged document
    ('FXINV0901', last_doc, 5000.00, 'fixed', 'FXC0901', '2024-01-05 09:00:00+00', 'USD', 0.00, 'invoice',
     '2024-01-20 00:00:00+00', false, '2024-01-05 10:00:00+00', 'January work', '2024-01-18 12:00:00+00', 'paid', 5000.00, NULL, NULL, NULL,
     0.00, '2024-01-06 00:00:00+00', 'approver@example.com', 0.00, 0.00, 'US', '2024-01-01 00:00:00+00',
     'ongoing_time_based', 'a@example.com', 'Contractor A', '0f090000-0000-4000-8000-000000000201', 0.00,
     0.00, 'monthly', NULL, 'grp-1', 0.00, 0.00, 'USD', 0.00,
     0.00, 5000.00, 5000.00, 'FXPAY0901', NULL, owner),
    ('FXINV0902', NULL, 49.00, NULL, 'FXC0901', '2024-01-06 09:00:00+00', 'USD', 49.00, 'deel_fee',
     '2024-01-20 00:00:00+00', false, '2024-01-05 10:00:00+00', 'Deel fee', '2024-01-18 12:00:00+00', 'paid', 49.00, NULL, NULL, NULL,
     0.00, NULL, NULL, 0.00, 0.00, NULL, NULL,
     NULL, NULL, 'Contractor A', NULL, 0.00,
     0.00, NULL, NULL, NULL, 0.00, 0.00, 'USD', 0.00,
     0.00, 0.00, 49.00, 'FXPAY0901', NULL, owner),
    -- FXPAY0902: earliest has a charged document, a later one a document without a charge
    ('FXINV0903', '0f090000-0000-4000-8000-000000000301', 3200.50, 'fixed', 'FXC0902', '2024-02-01 09:00:00+00', 'EUR', 12.30, 'invoice',
     '2024-02-15 00:00:00+00', true, '2024-02-01 10:00:00+00', 'February work', '2024-02-20 12:00:00+00', 'paid', 3212.80, 'A', '0', 0.00,
     -10.00, NULL, NULL, 150.00, 0.00, 'DE', '2023-06-15 08:30:00+00',
     'pay_as_you_go_time_based', 'b@example.com', 'Contractor B', '0f090000-0000-4000-8000-000000000202', 5.25,
     44.10, 'monthly', 'X', NULL, 1.00, 2.00, 'EUR', 0.00,
     1.50, 3000.00, 3212.80, 'FXPAY0902', '0f090000-0000-4000-8000-000000000122', owner),
    ('FXINV0906', prev_doc, 100.00, NULL, 'FXC0902', '2024-01-15 09:00:00+00', 'EUR', 0.00, NULL,
     '2024-02-15 00:00:00+00', false, '2024-02-01 10:00:00+00', 'Expense', '2024-02-20 12:00:00+00', 'paid', 100.00, NULL, NULL, NULL,
     0.00, NULL, NULL, 0.00, 0.00, NULL, NULL,
     NULL, NULL, 'Contractor B', NULL, 0.00,
     100.00, NULL, NULL, NULL, 0.00, 0.00, 'EUR', 0.00,
     0.00, 0.00, 100.00, 'FXPAY0902', NULL, owner),
    -- FXPAY0903: contract without a worker
    ('FXINV0904', third_doc, 750.75, NULL, 'FXC0999', '2024-02-02 09:00:00+00', 'ILS', 0.00, NULL,
     '2024-02-28 00:00:00+00', false, '2024-02-02 10:00:00+00', 'Other', '2024-02-27 12:00:00+00', 'pending', 750.75, NULL, NULL, NULL,
     0.00, NULL, NULL, 0.00, 0.00, NULL, NULL,
     NULL, NULL, 'Unknown', NULL, 0.00,
     0.00, NULL, NULL, NULL, 0.00, 0.00, 'ILS', 0.00,
     0.00, 750.75, 750.75, 'FXPAY0903', NULL, owner),
    -- FXPAY0904: no document, no contract
    ('FXINV0905', NULL, 10.00, NULL, NULL, '2024-02-03 09:00:00+00', 'USD', 0.00, NULL,
     '2024-02-28 00:00:00+00', false, '2024-02-03 10:00:00+00', 'Misc', '2024-02-27 12:00:00+00', 'paid', 10.00, NULL, NULL, NULL,
     0.00, NULL, NULL, 0.00, 0.00, NULL, NULL,
     NULL, NULL, 'Nobody', NULL, 0.00,
     0.00, NULL, NULL, NULL, 10.00, 0.00, 'USD', 0.00,
     0.00, 0.00, 10.00, 'FXPAY0904', NULL, owner),
    -- FXPAY0905: earliest invoice's document has no charge
    ('FXINV0907', '0f090000-0000-4000-8000-000000000301', 20.00, NULL, 'FXC0902', '2024-03-01 09:00:00+00', 'EUR', 0.00, NULL,
     '2024-03-15 00:00:00+00', false, '2024-03-01 10:00:00+00', 'March a', '2024-03-14 12:00:00+00', 'paid', 20.00, NULL, NULL, NULL,
     0.00, NULL, NULL, 0.00, 0.00, NULL, NULL,
     NULL, NULL, 'Contractor B', NULL, 0.00,
     0.00, NULL, NULL, NULL, 0.00, 0.00, 'EUR', 0.00,
     0.00, 20.00, 20.00, 'FXPAY0905', NULL, owner),
    ('FXINV0908', last_doc, 30.00, NULL, 'FXC0902', '2024-03-02 09:00:00+00', 'EUR', 0.00, NULL,
     '2024-03-15 00:00:00+00', false, '2024-03-01 10:00:00+00', 'March b', '2024-03-14 12:00:00+00', 'paid', 30.00, NULL, NULL, NULL,
     0.00, NULL, NULL, 0.00, 0.00, NULL, NULL,
     NULL, NULL, 'Contractor B', NULL, 0.00,
     0.00, NULL, NULL, NULL, 0.00, 0.00, 'EUR', 0.00,
     0.00, 30.00, 30.00, 'FXPAY0905', NULL, owner)
  ON CONFLICT DO NOTHING;
END $$;
