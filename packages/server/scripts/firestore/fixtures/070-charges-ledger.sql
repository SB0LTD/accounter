-- Fixtures for the charges / ledger / transactions / bank-deposits / manual-automations ports.
-- Idempotent (fixed ids, ON CONFLICT DO NOTHING). Ids: 0f070000-0000-4000-8000-xxxxxxxxxxxx.
-- Depends on 000-base (its tags) and on the demo seed (owner, bank accounts, tax categories).
--
--   ...0001xx  businesses (financial entities)     ...0002xx  financial accounts
--   ...0003xx  charges                             ...0004xx  transactions_raw_list
--   ...0005xx  transactions                        ...0006xx  documents
--   ...0007xx  ledger records                      ...0008xx  bank deposits
--   ...0009xx  trips, bank raw rows, securities, tax events, misc expenses, depreciation
--
-- Three poalim_ils_account_transactions rows go through the bank insert trigger, which files a
-- transactions_raw_list row and creates a transaction and a charge of its own (generated ids).
DO $$
DECLARE
  owner UUID := (SELECT owner_id FROM accounter_schema.user_context LIMIT 1);
  bank1 UUID := '01a217ef-ee3d-7bfd-afab-07ad7db14c77';
  bank2 UUID := '01a217ef-eea1-7b96-a93d-b9cf2f56cfb9';
  b1 UUID := '0f070000-0000-4000-8000-000000000101';
  b2 UUID := '0f070000-0000-4000-8000-000000000102';
  cc1 UUID := '0f070000-0000-4000-8000-000000000201';
  cc2 UUID := '0f070000-0000-4000-8000-000000000202';
  dep UUID := '0f070000-0000-4000-8000-000000000203';
  bank3 UUID := '0f070000-0000-4000-8000-000000000204';
  consulting UUID := 'c389e2a2-b2bf-5d6c-87d1-6eca9fc5e3ed';
  input_vat UUID := '7f290789-5c1a-5aa1-81e8-927039f89fa0';
  service_income UUID := 'f6d03f4c-1529-5050-86b6-c3bb12b4e65e';
  income_fx UUID := '0284cd22-b9af-5fde-930e-045799fd842c';
  revaluation UUID := 'ea82e666-35ce-5ad6-a231-ec8ffab0251f';
BEGIN
  -- Counterparties
  INSERT INTO accounter_schema.financial_entities (id, type, owner_id, name) VALUES
    (b1, 'business', owner, 'Globex Supplies'),
    (b2, 'business', owner, 'Initech Services')
  ON CONFLICT DO NOTHING;
  INSERT INTO accounter_schema.businesses (id, owner_id, can_settle_with_receipt, no_invoices_required) VALUES
    (b1, owner, true, false),
    (b2, owner, false, true)
  ON CONFLICT DO NOTHING;
  INSERT INTO accounter_schema.business_tax_category_match (business_id, owner_id, tax_category_id) VALUES
    (b1, owner, consulting)
  ON CONFLICT DO NOTHING;

  -- Accounts: two credit cards, a deposit account (with bank details), a bank account the raw
  -- Poalim rows below belong to.
  INSERT INTO accounter_schema.financial_accounts (id, account_number, owner, type, account_name, bank_number, branch_number, owner_id) VALUES
    (cc1, '4580', owner, 'CREDIT_CARD', 'Visa Gold', NULL, NULL, owner),
    (cc2, '9911', owner, 'CREDIT_CARD', 'MAX Card', NULL, NULL, owner),
    (dep, '555666', owner, 'BANK_DEPOSIT_ACCOUNT', 'Deposits', 12, 600, owner),
    (bank3, '777888', owner, 'BANK_ACCOUNT', NULL, 12, 600, owner)
  ON CONFLICT DO NOTHING;
  INSERT INTO accounter_schema.financial_bank_accounts (id, bank_number, branch_number, owner_id) VALUES
    (dep, 12, 600, owner)
  ON CONFLICT DO NOTHING;

  -- Charges
  INSERT INTO accounter_schema.charges (id, owner_id, is_property, user_description, tax_category_id, invoice_payment_currency_diff, type, optional_vat, accountant_status, documents_optional_flag) VALUES
    ('0f070000-0000-4000-8000-000000000301', owner, false, 'Globex office supplies', NULL, NULL, NULL, false, 'PENDING', false),
    ('0f070000-0000-4000-8000-000000000302', owner, false, 'Initech consulting retainer', service_income, true, 'COMMON', true, 'APPROVED', true),
    ('0f070000-0000-4000-8000-000000000303', owner, true, 'Mixed currency hardware', NULL, false, NULL, false, 'UNAPPROVED', false),
    ('0f070000-0000-4000-8000-000000000304', owner, false, 'Stock distribution 2024', NULL, NULL, 'FOREIGN_SECURITIES', false, 'UNAPPROVED', false),
    ('0f070000-0000-4000-8000-000000000305', owner, false, NULL, NULL, NULL, NULL, false, 'UNAPPROVED', false),
    ('0f070000-0000-4000-8000-000000000306', owner, false, 'Visa Gold monthly debit', NULL, NULL, 'CREDITCARD_BANK', false, 'PENDING', false),
    ('0f070000-0000-4000-8000-000000000307', owner, false, 'Card purchases August', NULL, NULL, NULL, false, 'PENDING', false),
    ('0f070000-0000-4000-8000-000000000308', owner, false, 'MAX card debit', NULL, NULL, 'CREDITCARD_BANK', false, 'PENDING', false),
    ('0f070000-0000-4000-8000-000000000309', owner, false, 'Wire fee', NULL, NULL, NULL, false, 'UNAPPROVED', false),
    ('0f070000-0000-4000-8000-000000000310', owner, false, 'Wire abroad', NULL, NULL, NULL, false, 'UNAPPROVED', false),
    ('0f070000-0000-4000-8000-000000000311', owner, false, 'Foreign securities buy', NULL, NULL, 'FOREIGN_SECURITIES', false, 'UNAPPROVED', false),
    ('0f070000-0000-4000-8000-000000000312', owner, false, NULL, NULL, NULL, NULL, false, 'UNAPPROVED', false),
    ('0f070000-0000-4000-8000-000000000313', owner, false, 'Bank deposit 2024', NULL, NULL, 'BANK_DEPOSIT', false, 'APPROVED', false),
    ('0f070000-0000-4000-8000-000000000314', owner, false, 'Bank deposit 2024 close', NULL, NULL, 'BANK_DEPOSIT', false, 'APPROVED', false),
    ('0f070000-0000-4000-8000-000000000315', owner, false, 'Old deposit fees', NULL, NULL, 'BANK_DEPOSIT', false, 'UNAPPROVED', false),
    ('0f070000-0000-4000-8000-000000000316', owner, false, 'Bank deposits revaluation 2023', revaluation, NULL, 'FINANCIAL', false, 'UNAPPROVED', false),
    ('0f070000-0000-4000-8000-000000000317', owner, false, 'Bank deposits revaluation 2024', revaluation, NULL, 'FINANCIAL', false, 'UNAPPROVED', false),
    ('0f070000-0000-4000-8000-000000000318', owner, false, 'Delete me too', NULL, NULL, NULL, false, 'UNAPPROVED', false)
  ON CONFLICT DO NOTHING;

  -- Raw-list rows for the transactions below (kraken_id has no foreign key)
  INSERT INTO accounter_schema.transactions_raw_list (id, kraken_id)
  SELECT ('0f070000-0000-4000-8000-0000000004' || lpad(n::text, 2, '0'))::uuid, 'fx070-' || n
  FROM generate_series(1, 23) AS n
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.transactions (id, account_id, charge_id, source_id, source_description, currency, event_date, debit_date, debit_date_override, amount, current_balance, business_id, is_fee, source_reference, source_origin, counter_account, debit_timestamp, origin_key, owner_id) VALUES
    ('0f070000-0000-4000-8000-000000000501', bank1, '0f070000-0000-4000-8000-000000000301', '0f070000-0000-4000-8000-000000000401', 'GLOBEX SUPPLIES LTD', 'ILS', '2024-03-05', '2024-03-06', NULL, -1170.00, 0, b1, false, 'GX-1001', 'TEST', '12-600-123456', NULL, 'fx070-1', owner),
    ('0f070000-0000-4000-8000-000000000502', bank1, '0f070000-0000-4000-8000-000000000301', '0f070000-0000-4000-8000-000000000402', 'BANK FEE', 'ILS', '2024-03-05', '2024-03-07', NULL, -15.50, 0, b1, true, 'GX-1001-F', 'TEST', NULL, NULL, 'fx070-2', owner),
    ('0f070000-0000-4000-8000-000000000503', bank1, '0f070000-0000-4000-8000-000000000302', '0f070000-0000-4000-8000-000000000403', 'INITECH RETAINER', 'USD', '2024-04-10', NULL, '2024-04-12', 2500.00, 0, b2, false, 'IN-77', 'TEST', NULL, '2024-04-12 09:30:00', 'fx070-3', owner),
    ('0f070000-0000-4000-8000-000000000504', bank2, '0f070000-0000-4000-8000-000000000303', '0f070000-0000-4000-8000-000000000404', 'Unknown vendor', 'EUR', '2024-05-02', NULL, NULL, -200.00, 0, NULL, false, 'EU-1', 'TEST', NULL, NULL, 'fx070-4', owner),
    ('0f070000-0000-4000-8000-000000000505', bank2, '0f070000-0000-4000-8000-000000000303', '0f070000-0000-4000-8000-000000000405', 'GLOBEX EU', 'USD', '2024-05-03', '2024-05-04', NULL, -300.10, 0, b1, false, 'EU-2', 'TEST', NULL, '2024-05-04 08:00:00', 'fx070-5', owner),
    ('0f070000-0000-4000-8000-000000000506', bank1, '0f070000-0000-4000-8000-000000000306', '0f070000-0000-4000-8000-000000000406', 'VISA GOLD DEBIT', 'ILS', '2024-08-10', '2024-08-10', NULL, -150.25, 0, NULL, false, '4580', 'TEST', NULL, NULL, 'fx070-6', owner),
    ('0f070000-0000-4000-8000-000000000507', cc1, '0f070000-0000-4000-8000-000000000307', '0f070000-0000-4000-8000-000000000407', 'Globex online', 'ILS', '2024-07-20', '2024-08-10', NULL, -100.00, 0, b1, false, 'CC-1', 'ISRACARD', NULL, NULL, 'fx070-7', owner),
    ('0f070000-0000-4000-8000-000000000508', cc1, '0f070000-0000-4000-8000-000000000307', '0f070000-0000-4000-8000-000000000408', 'Initech parking', 'ILS', '2024-07-25', '2024-08-10', NULL, -50.25, 0, b2, false, 'CC-2', 'ISRACARD', NULL, NULL, 'fx070-8', owner),
    ('0f070000-0000-4000-8000-000000000509', cc1, '0f070000-0000-4000-8000-000000000307', '0f070000-0000-4000-8000-000000000409', 'Cafe', 'ILS', '2024-07-28', NULL, NULL, -42.00, 0, NULL, false, 'CC-3', 'ISRACARD', NULL, NULL, 'fx070-9', owner),
    ('0f070000-0000-4000-8000-000000000510', cc1, '0f070000-0000-4000-8000-000000000307', '0f070000-0000-4000-8000-000000000410', 'App store', 'USD', '2024-07-28', NULL, NULL, -9.99, 0, NULL, false, 'CC-4', 'AMEX', NULL, NULL, 'fx070-10', owner),
    ('0f070000-0000-4000-8000-000000000511', cc1, '0f070000-0000-4000-8000-000000000307', '0f070000-0000-4000-8000-000000000411', 'Old purchase', 'ILS', '2024-05-01', NULL, NULL, -60.00, 0, NULL, false, 'CC-5', 'AMEX', NULL, NULL, 'fx070-11', owner),
    ('0f070000-0000-4000-8000-000000000512', bank1, '0f070000-0000-4000-8000-000000000308', '0f070000-0000-4000-8000-000000000412', 'Payment MAX Card 9911', 'ILS', '2024-09-02', '2024-09-02', NULL, -75.00, 0, NULL, false, 'MAXREF', 'TEST', NULL, NULL, 'fx070-12', owner),
    ('0f070000-0000-4000-8000-000000000513', cc2, '0f070000-0000-4000-8000-000000000308', '0f070000-0000-4000-8000-000000000413', 'Bookstore', 'ILS', '2024-08-15', '2024-09-02', NULL, -75.00, 0, NULL, false, 'MX-1', 'MAX', NULL, NULL, 'fx070-13', owner),
    ('0f070000-0000-4000-8000-000000000514', bank2, '0f070000-0000-4000-8000-000000000309', '0f070000-0000-4000-8000-000000000414', 'העברת מט"ח לחו"ל', 'USD', '2024-10-01', '2024-10-01', NULL, -25.00, 0, NULL, false, 'WIRE-555', 'TEST', NULL, NULL, 'fx070-14', owner),
    ('0f070000-0000-4000-8000-000000000515', bank2, '0f070000-0000-4000-8000-000000000310', '0f070000-0000-4000-8000-000000000415', 'העברת מט"ח', 'USD', '2024-10-01', '2024-10-01', NULL, -1500.00, 0, b2, false, 'WIRE-555', 'TEST', NULL, NULL, 'fx070-15', owner),
    ('0f070000-0000-4000-8000-000000000516', bank2, '0f070000-0000-4000-8000-000000000310', '0f070000-0000-4000-8000-000000000416', 'העברת מטבע', 'EUR', '2024-10-02', '2024-10-02', NULL, -12.00, 0, NULL, false, 'SOLO-1', 'TEST', NULL, NULL, 'fx070-16', owner),
    ('0f070000-0000-4000-8000-000000000517', bank1, '0f070000-0000-4000-8000-000000000311', '0f070000-0000-4000-8000-000000000417', 'FSEC buy 0012345678', 'ILS', '2024-06-01', '2024-06-01', NULL, -5000.00, 0, NULL, false, '77001', 'POALIM', NULL, NULL, 'fx070-17', owner),
    ('0f070000-0000-4000-8000-000000000518', bank1, '0f070000-0000-4000-8000-000000000312', '0f070000-0000-4000-8000-000000000418', 'Securities settle', 'ILS', '2024-06-01', '2024-06-01', NULL, 5000.00, 0, NULL, false, '0012345678', 'POALIM', NULL, NULL, 'fx070-18', owner),
    ('0f070000-0000-4000-8000-000000000519', bank1, '0f070000-0000-4000-8000-000000000312', '0f070000-0000-4000-8000-000000000419', 'Securities settle late', 'ILS', '2024-06-02', '2024-06-02', NULL, 1.00, 0, NULL, false, '0012345678', 'POALIM', NULL, NULL, 'fx070-19', owner),
    ('0f070000-0000-4000-8000-000000000520', bank1, '0f070000-0000-4000-8000-000000000311', '0f070000-0000-4000-8000-000000000420', 'ני"עז 0098765432', 'ILS', '2024-06-03', '2024-06-03', NULL, -10.00, 0, NULL, false, '88002', 'POALIM', NULL, NULL, 'fx070-20', owner),
    ('0f070000-0000-4000-8000-000000000521', dep, '0f070000-0000-4000-8000-000000000313', '0f070000-0000-4000-8000-000000000421', 'Deposit open', 'ILS', '2024-01-01', '2024-01-01', NULL, -10000.00, 0, NULL, false, 'DEP-1', 'TEST', NULL, NULL, 'fx070-21', owner),
    ('0f070000-0000-4000-8000-000000000522', dep, '0f070000-0000-4000-8000-000000000313', '0f070000-0000-4000-8000-000000000422', 'Deposit interest', 'ILS', '2024-06-30', NULL, NULL, 55.30, 0, NULL, false, 'DEP-2', 'TEST', NULL, NULL, 'fx070-22', owner),
    ('0f070000-0000-4000-8000-000000000523', dep, '0f070000-0000-4000-8000-000000000314', '0f070000-0000-4000-8000-000000000423', 'Deposit close', 'ILS', '2024-07-01', '2024-07-01', NULL, 10055.30, 0, NULL, false, 'DEP-3', 'TEST', NULL, NULL, 'fx070-23', owner)
  ON CONFLICT DO NOTHING;

  -- Documents (one without a charge)
  INSERT INTO accounter_schema.documents (id, type, serial_number, date, total_amount, currency_code, vat_amount, debtor_id, creditor_id, charge_id, description, remarks, owner_id) VALUES
    ('0f070000-0000-4000-8000-000000000601', 'RECEIPT', 'RC-77', '2024-03-04', 1170, 'ILS', 170, owner, b1, '0f070000-0000-4000-8000-000000000301', 'Paper and toner', 'urgent', owner),
    ('0f070000-0000-4000-8000-000000000602', 'INVOICE', 'INV-9001', '2024-04-01', 2500, 'USD', 0, b2, owner, '0f070000-0000-4000-8000-000000000302', 'Retainer April', NULL, owner),
    ('0f070000-0000-4000-8000-000000000603', 'PROFORMA', 'PRO-12', '2024-03-25', 2500, 'USD', NULL, b2, owner, '0f070000-0000-4000-8000-000000000302', NULL, NULL, owner),
    ('0f070000-0000-4000-8000-000000000604', 'INVOICE_RECEIPT', 'IR-5', '2024-05-01', 520.5, 'EUR', 80.5, owner, b1, '0f070000-0000-4000-8000-000000000303', 'Hardware', NULL, owner),
    ('0f070000-0000-4000-8000-000000000605', 'INVOICE', NULL, '2024-05-02', 10, 'ILS', 0, owner, NULL, '0f070000-0000-4000-8000-000000000303', NULL, NULL, owner),
    ('0f070000-0000-4000-8000-000000000606', 'UNPROCESSED', NULL, '2024-07-01', NULL, NULL, NULL, NULL, NULL, NULL, 'Loose scan', NULL, owner),
    ('0f070000-0000-4000-8000-000000000607', 'RECEIPT', 'RC-9', '2024-10-01', 25, 'USD', 0, owner, b2, '0f070000-0000-4000-8000-000000000309', NULL, NULL, owner),
    ('0f070000-0000-4000-8000-000000000608', 'CREDIT_INVOICE', 'CR-1', '2024-10-05', 300, 'USD', 51, b2, owner, '0f070000-0000-4000-8000-000000000310', 'Credit for wire', NULL, owner)
  ON CONFLICT DO NOTHING;
  INSERT INTO accounter_schema.documents_issued (id, external_id, status, owner_id) VALUES
    ('0f070000-0000-4000-8000-000000000602', 'fx070-gi-602', 'OPEN', owner),
    ('0f070000-0000-4000-8000-000000000603', 'fx070-gi-603', 'CLOSED', owner),
    ('0f070000-0000-4000-8000-000000000608', 'fx070-gi-608', 'CANCELLED', owner)
  ON CONFLICT DO NOTHING;

  -- Tags (000-base tags), in tag-id order per charge
  INSERT INTO accounter_schema.charge_tags (charge_id, tag_id, part, owner_id) VALUES
    ('0f070000-0000-4000-8000-000000000301', '0f0f0000-0000-4000-8000-000000000001', 0.5, owner),
    ('0f070000-0000-4000-8000-000000000301', '0f0f0000-0000-4000-8000-000000000004', 0.5, owner),
    ('0f070000-0000-4000-8000-000000000302', '0f0f0000-0000-4000-8000-000000000005', NULL, owner),
    ('0f070000-0000-4000-8000-000000000303', '0f0f0000-0000-4000-8000-000000000002', NULL, owner)
  ON CONFLICT DO NOTHING;

  -- Spread, in year order per charge
  INSERT INTO accounter_schema.charge_spread (charge_id, year_of_relevance, amount, owner_id) VALUES
    ('0f070000-0000-4000-8000-000000000301', '2024-01-01', 600.00, owner),
    ('0f070000-0000-4000-8000-000000000301', '2025-01-01', 570.00, owner),
    ('0f070000-0000-4000-8000-000000000302', '2024-01-01', NULL, owner)
  ON CONFLICT DO NOTHING;

  -- Business trip
  INSERT INTO accounter_schema.business_trips (id, name, destination, owner_id) VALUES
    ('0f070000-0000-4000-8000-000000000901', 'Berlin client visit', NULL, owner)
  ON CONFLICT DO NOTHING;
  INSERT INTO accounter_schema.business_trip_charges (business_trip_id, charge_id, owner_id) VALUES
    ('0f070000-0000-4000-8000-000000000901', '0f070000-0000-4000-8000-000000000302', owner)
  ON CONFLICT DO NOTHING;

  -- Misc expense (adds a fee-side business to the charge)
  INSERT INTO accounter_schema.misc_expenses (id, charge_id, amount, currency, description, creditor_id, debtor_id, invoice_date, value_date, owner_id) VALUES
    ('0f070000-0000-4000-8000-000000000941', '0f070000-0000-4000-8000-000000000303', 33.30, 'EUR', 'Shipping', b2, owner, '2024-05-02', '2024-05-02 00:00:00', owner)
  ON CONFLICT DO NOTHING;

  -- Depreciation: two rows on one charge (the view repeats the charge per row)
  INSERT INTO accounter_schema.depreciation_categories (id, name, percentage) VALUES
    ('0f070000-0000-4000-8000-000000000951', 'Computers (fx070)', 33.00)
  ON CONFLICT DO NOTHING;
  INSERT INTO accounter_schema.depreciation (id, charge_id, amount, currency, activation_date, type, category, owner_id) VALUES
    ('0f070000-0000-4000-8000-000000000952', '0f070000-0000-4000-8000-000000000303', 300.00, 'EUR', '2024-05-01', 'GENERAL_AND_MANAGEMENT', '0f070000-0000-4000-8000-000000000951', owner),
    ('0f070000-0000-4000-8000-000000000953', '0f070000-0000-4000-8000-000000000303', 220.50, 'EUR', '2024-06-01', 'RESEARCH_AND_DEVELOPMENT', '0f070000-0000-4000-8000-000000000951', owner)
  ON CONFLICT DO NOTHING;

  -- Securities executions booked by a charge
  INSERT INTO accounter_schema.poalim_securities_transactions (id, owner_id, bank_number, branch_number, account_number, security, trade_date, value_date, trade_type, transaction_type) VALUES
    ('0f070000-0000-4000-8000-000000000921', owner, 12, 600, 555666, 'ACME', '2024-12-15', '2024-12-17', 'DIST', 'BUY'),
    ('0f070000-0000-4000-8000-000000000922', owner, 12, 600, 555666, 'ACME', '2024-12-20', NULL, 'DIST', 'BUY')
  ON CONFLICT DO NOTHING;
  INSERT INTO accounter_schema.charges_securities_executions (execution_id, charge_id, owner_id) VALUES
    ('0f070000-0000-4000-8000-000000000921', '0f070000-0000-4000-8000-000000000304', owner),
    ('0f070000-0000-4000-8000-000000000922', '0f070000-0000-4000-8000-000000000304', owner)
  ON CONFLICT DO NOTHING;

  -- Ledger
  INSERT INTO accounter_schema.ledger_records (id, owner_id, charge_id, debit_entity1, debit_foreign_amount1, debit_local_amount1, credit_entity1, credit_foreign_amount1, credit_local_amount1, debit_entity2, debit_foreign_amount2, debit_local_amount2, credit_entity2, credit_foreign_amount2, credit_local_amount2, currency, invoice_date, value_date, description, reference1, locked) VALUES
    ('0f070000-0000-4000-8000-000000000701', owner, '0f070000-0000-4000-8000-000000000301', consulting, NULL, 1000.00, b1, NULL, 1000.00, NULL, NULL, NULL, NULL, NULL, NULL, 'ILS', '2024-03-04', '2024-03-06', 'Office supplies', 'RC-77', false),
    ('0f070000-0000-4000-8000-000000000702', owner, '0f070000-0000-4000-8000-000000000301', input_vat, NULL, 170.00, b1, NULL, 170.00, NULL, NULL, NULL, NULL, NULL, NULL, 'ILS', '2024-03-04', '2024-03-06', 'Input VAT', 'RC-77', false),
    ('0f070000-0000-4000-8000-000000000703', owner, '0f070000-0000-4000-8000-000000000302', b2, 2500.00, 9250.00, service_income, 2500.00, 9237.655, NULL, NULL, NULL, income_fx, NULL, 12.345, 'USD', '2024-04-01', '2024-04-12', 'Retainer', 'INV-9001', true),
    ('0f070000-0000-4000-8000-000000000704', owner, '0f070000-0000-4000-8000-000000000303', consulting, 300.10, 1100.40, b1, 320.20, 1180.90, input_vat, 21.80, 80.50, NULL, NULL, NULL, 'EUR', '2024-05-01', '2024-05-04', NULL, NULL, false),
    ('0f070000-0000-4000-8000-000000000705', owner, '0f070000-0000-4000-8000-000000000304', '8fd191a4-a654-5627-89f8-f7dea9b31b95', NULL, 5000, 'a05760a0-e74d-55d4-9a88-2578bf6cfc9e', NULL, 5000, NULL, NULL, NULL, NULL, NULL, NULL, 'ILS', '2024-12-20', '2024-12-31', 'Distribution', NULL, true),
    ('0f070000-0000-4000-8000-000000000706', owner, '4481df29-1a91-532b-a68d-20471594df24', '87916ff6-a3f1-5d39-b6e0-7b5d7e155426', 500.00, 1850.00, consulting, 500.00, 1850.00, NULL, NULL, NULL, NULL, NULL, NULL, 'USD', '2024-01-01', '2024-01-15', 'January consulting', 'INV-2024-01-15', false),
    ('0f070000-0000-4000-8000-000000000707', owner, '0f070000-0000-4000-8000-000000000313', '82426d36-91a6-5fda-a650-190ebf035c9e', NULL, 10000, 'feb54bc1-92ca-5b24-bd9e-b1c51c70e891', NULL, 10000, NULL, NULL, NULL, NULL, NULL, NULL, 'ILS', '2024-01-01', '2024-01-01', NULL, 'DEP-1', false),
    ('0f070000-0000-4000-8000-000000000708', owner, '0f070000-0000-4000-8000-000000000302', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'USD', '2025-01-15', '2025-01-20', 'Placeholder', NULL, NULL)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.charge_balance_cancellation (charge_id, description, business_id, owner_id) VALUES
    ('0f070000-0000-4000-8000-000000000301', 'Cancel rounding', b1, owner),
    ('0f070000-0000-4000-8000-000000000303', NULL, b1, owner),
    ('0f070000-0000-4000-8000-000000000302', 'Retainer offset', b2, owner)
  ON CONFLICT DO NOTHING;
  INSERT INTO accounter_schema.charge_unbalanced_ledger_businesses (charge_id, business_id, remark, owner_id) VALUES
    ('0f070000-0000-4000-8000-000000000301', b1, 'check rounding', owner),
    ('0f070000-0000-4000-8000-000000000301', '87916ff6-a3f1-5d39-b6e0-7b5d7e155426', NULL, owner),
    ('0f070000-0000-4000-8000-000000000303', b2, 'shipping', owner)
  ON CONFLICT DO NOTHING;

  -- Bank deposits
  INSERT INTO accounter_schema.bank_deposits (id, name, open_date, close_date, currency, owner_id, account_id) VALUES
    ('0f070000-0000-4000-8000-000000000801', 'Deposit 12-600', '2024-01-01', NULL, 'ILS', owner, dep),
    ('0f070000-0000-4000-8000-000000000802', 'Old deposit', '2023-01-01', '2023-12-31', 'USD', owner, NULL),
    ('0f070000-0000-4000-8000-000000000803', 'Empty deposit', '2024-02-01', NULL, 'EUR', owner, dep)
  ON CONFLICT DO NOTHING;
  INSERT INTO accounter_schema.charges_bank_deposits (id, deposit_id, account_id, owner_id, new_deposit_id) VALUES
    ('0f070000-0000-4000-8000-000000000313', 'legacy-1', dep, owner, '0f070000-0000-4000-8000-000000000801'),
    ('0f070000-0000-4000-8000-000000000314', NULL, dep, owner, '0f070000-0000-4000-8000-000000000801'),
    ('0f070000-0000-4000-8000-000000000315', NULL, dep, owner, '0f070000-0000-4000-8000-000000000802')
  ON CONFLICT DO NOTHING;
  INSERT INTO accounter_schema.poalim_deposit_tax_events (id, owner_id, bank_number, branch_number, account_number, event_serial_number, executing_date, action_type_description, short_product_name, tax_action_type_description, tax_event_amount, debit_amount, crdit_amount) VALUES
    ('0f070000-0000-4000-8000-000000000931', owner, 12, 600, 555666, 2, '2024-03-31', 'Interest payment', 'Deposit A', 'Tax withheld', 12.50, 12.50, 0),
    ('0f070000-0000-4000-8000-000000000932', owner, 12, 600, 555666, 1, '2024-03-31', 'Interest payment', 'Deposit A', NULL, 0, 0, 55.30),
    ('0f070000-0000-4000-8000-000000000933', owner, 12, 600, 555666, 1, '2024-01-15', 'Opening', NULL, NULL, 0, 10000, 0),
    ('0f070000-0000-4000-8000-000000000934', owner, 12, 700, 555666, 1, '2024-03-31', 'Other branch', NULL, NULL, 1.00, 1.00, 0)
  ON CONFLICT DO NOTHING;
END $$;

-- Raw Poalim ILS rows (the insert trigger creates their transactions and charges): two credit-card
-- debits (activity 491) for card 4580, and a securities transfer whose message names a reference.
INSERT INTO accounter_schema.poalim_ils_account_transactions (
  id, event_date, formatted_event_date, serial_number, activity_type_code, activity_description, text_code,
  reference_number, reference_catenated_number, value_date, formatted_value_date, event_amount,
  event_activity_type_code, current_balance, internal_link_code, original_event_create_date,
  transaction_type, data_group_code, expanded_event_date, executing_branch_number, event_id,
  different_date_indication, table_number, record_number, contra_bank_number, contra_branch_number,
  contra_account_number, contra_account_type_code, marketing_offer_context, comment_existence_switch,
  field_desc_display_switch, beneficiary_details_data_message_detail, bank_number, branch_number, account_number
) VALUES
  ('0f070000-0000-4000-8000-000000000911', '2024-08-10', '2024-08-10T00:00:00', 70001, 491, 'CARD DEBIT', 469, 4580, 0, '2024-08-10', '2024-08-10T00:00:00', 1234.50, 2, 0, 0, 20240810, 'REGULAR', 0, 20240810, 600, 70001, 'N', 0, 0, 0, 0, 0, 0, B'0', B'0', B'0', NULL, 12, 600, 777888),
  ('0f070000-0000-4000-8000-000000000912', '2024-08-20', '2024-08-20T00:00:00', 70002, 491, 'CARD DEBIT', 469, 4580, 0, '2024-08-20', '2024-08-20T00:00:00', 80.00, 2, 0, 0, 20240820, 'REGULAR', 0, 20240820, 600, 70002, 'N', 0, 0, 0, 0, 0, 0, B'0', B'0', B'0', NULL, 12, 600, 777888),
  ('0f070000-0000-4000-8000-000000000913', '2024-06-05', '2024-06-05T00:00:00', 70003, 485, 'SECURITIES', 100, 300123, 0, '2024-06-05', '2024-06-05T00:00:00', 2000.00, 1, 0, 0, 20240605, 'REGULAR', 0, 20240605, 600, 70003, 'N', 0, 0, 0, 0, 0, 0, B'0', B'0', B'0', 'FSEC 0011223344', 12, 600, 777888)
ON CONFLICT DO NOTHING;
