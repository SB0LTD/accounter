-- Fixture rows for the reports, report-1214, annual-audit, corporate-taxes, dividends and vat ports.
-- Applied by `yarn workspace @accounter/server firestore:fixtures --only 040-reports`.
-- Idempotent: every insert skips rows that exist. Ids are fixed UUIDs in the 0f040000-... range.
-- Rows are owned by the demo tenant (the single user_context owner) and reuse its demo businesses,
-- tax categories, charges and transactions where a report reads them.
--
-- Global rows (exchange_rates, crypto_exchange_rates) use dates no other fixture is expected to use.

DO $$
DECLARE
  owner UUID := (SELECT owner_id FROM accounter_schema.user_context LIMIT 1);
  account UUID := (SELECT account_id FROM accounter_schema.transactions WHERE owner_id = owner ORDER BY id LIMIT 1);
  user_a UUID := (SELECT user_id FROM accounter_schema.business_users WHERE business_id = owner ORDER BY user_id LIMIT 1);
  user_b UUID := (SELECT user_id FROM accounter_schema.business_users WHERE business_id = owner ORDER BY user_id DESC LIMIT 1);
  -- demo businesses
  acme_usa UUID := '87916ff6-a3f1-5d39-b6e0-7b5d7e155426';
  acme_retail UUID := '51955ea0-2d3d-5393-bd8f-e537dbd6f5f2';
  -- demo tax categories
  service_income UUID := 'f6d03f4c-1529-5050-86b6-c3bb12b4e65e';
  income_fx UUID := '0284cd22-b9af-5fde-930e-045799fd842c';
  income_to_collect UUID := '934b6b60-1076-51bb-a5ad-ebdda0a7490e';
  output_vat UUID := 'fa042563-a3b4-55e6-8d38-c20b6a207d8d';
  balance_cancellation UUID := '35d6d3ca-1823-53b9-ad9e-0ce4956f00f4';
  exchange_rates_cat UUID := 'df801144-d541-586a-89cd-99bcf4809bb0';
  -- demo charges with documents and transactions
  jan_charge UUID := '4481df29-1a91-532b-a68d-20471594df24';
  client_charge UUID := 'afd7669e-9d86-5201-8948-010aadfdce07';
  dividend_charge UUID := 'ea694759-612f-5dbd-8f5c-c4d544fdf219';
  refund_charge UUID := '18064efe-c5d5-5bc9-8c38-dc4d2d5af984';
BEGIN
  IF owner IS NULL THEN
    RETURN;
  END IF;

  -- ------------------------------------------------------------------------------------------
  -- Exchange rates (global): ILS per unit, a few dates of 2024, some currencies missing
  -- ------------------------------------------------------------------------------------------
  INSERT INTO accounter_schema.exchange_rates (exchange_date, usd, eur, gbp, cad, jpy, aud, sek) VALUES
    ('2024-02-29', 3.652, 3.9532, 4.6123, 2.6987, 0.024389, 2.3912, 0.3501),
    ('2024-06-20', 3.721, 3.9871, 4.7105, 2.7101, 0.023512, 2.4787, NULL),
    ('2024-10-01', 3.708, 4.1352, 4.9622, 2.7455, 0.025801, 2.5634, 0.3633),
    ('2024-12-29', 3.647, 3.8, 4.5813, NULL, 0.023, 2.2671, 0.3317)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.crypto_currencies (symbol, name) VALUES
    ('ETH', 'Ethereum'),
    ('USDC', 'USD Coin'),
    ('GRT', 'The Graph')
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.crypto_exchange_rates (date, coin_symbol, value, against, sample_date) VALUES
    ('2024-06-01 10:00:00', 'ETH', 3801.25, 'USD', '2024-06-01 10:00:00'),
    ('2024-06-02 00:00:00', 'ETH', 3850.5, 'USD', '2024-06-02 00:00:00'),
    ('2024-06-02 12:00:00', 'ETH', 3900, 'USD', '2024-06-02 12:00:00'),
    ('2024-06-01 00:00:00', 'USDC', 1.0001, 'USD', '2024-06-01 00:00:00'),
    ('2024-06-02 06:00:00', 'USDC', 3.71, 'ILS', '2024-06-02 06:00:00'),
    ('2024-11-01 00:00:00', 'GRT', 0.15234, 'USD', '2024-11-01 00:00:00')
  ON CONFLICT DO NOTHING;

  -- ------------------------------------------------------------------------------------------
  -- Charges
  -- ------------------------------------------------------------------------------------------
  INSERT INTO accounter_schema.charges (id, owner_id, type, user_description) VALUES
    ('0f040000-0000-4000-8000-000000000001', owner, 'FINANCIAL', 'Opening Balance 2023'),
    ('0f040000-0000-4000-8000-000000000002', owner, 'FINANCIAL', 'balance adjustments'),
    ('0f040000-0000-4000-8000-000000000003', owner, 'COMMON', 'balance (common charge)'),
    ('0f040000-0000-4000-8000-000000000004', owner, 'FINANCIAL', 'Year end closing'),
    ('0f040000-0000-4000-8000-000000000005', owner, 'FINANCIAL', 'BALANCE 2024'),
    ('0f040000-0000-4000-8000-000000000006', owner, NULL, 'Fixture revenue, two parties'),
    ('0f040000-0000-4000-8000-000000000007', owner, NULL, 'Fixture crypto income'),
    ('0f040000-0000-4000-8000-000000000008', owner, NULL, 'Fixture foreign currency moves')
  ON CONFLICT DO NOTHING;

  -- ------------------------------------------------------------------------------------------
  -- Transactions (balance report, revenue report's charge business ids)
  -- ------------------------------------------------------------------------------------------
  INSERT INTO accounter_schema.transactions_raw_list (id, kraken_id) VALUES
    ('0f040000-0000-4000-8000-000000000301', 'fx040-301'),
    ('0f040000-0000-4000-8000-000000000302', 'fx040-302'),
    ('0f040000-0000-4000-8000-000000000303', 'fx040-303'),
    ('0f040000-0000-4000-8000-000000000304', 'fx040-304'),
    ('0f040000-0000-4000-8000-000000000305', 'fx040-305'),
    ('0f040000-0000-4000-8000-000000000306', 'fx040-306'),
    ('0f040000-0000-4000-8000-000000000307', 'fx040-307'),
    ('0f040000-0000-4000-8000-000000000308', 'fx040-308'),
    ('0f040000-0000-4000-8000-000000000309', 'fx040-309'),
    ('0f040000-0000-4000-8000-000000000310', 'fx040-310'),
    ('0f040000-0000-4000-8000-000000000311', 'fx040-311'),
    ('0f040000-0000-4000-8000-000000000312', 'fx040-312'),
    ('0f040000-0000-4000-8000-000000000313', 'fx040-313')
  ON CONFLICT DO NOTHING;

  IF account IS NOT NULL THEN
    INSERT INTO accounter_schema.transactions (
      id, account_id, charge_id, source_id, source_description, currency, event_date, debit_date,
      debit_date_override, debit_timestamp, amount, current_balance, business_id, is_fee,
      source_reference, source_origin, origin_key, owner_id
    ) VALUES
      ('0f040000-0000-4000-8000-000000000201', account, '0f040000-0000-4000-8000-000000000008', '0f040000-0000-4000-8000-000000000301',
        'EUR transfer', 'EUR', '2024-06-21', '2024-06-22', NULL, NULL, 1234.56, 0, acme_usa, false, 'FX040', 'FIXTURE', 'fx040-201', owner),
      ('0f040000-0000-4000-8000-000000000202', account, '0f040000-0000-4000-8000-000000000008', '0f040000-0000-4000-8000-000000000302',
        'GBP by timestamp', 'GBP', '2024-07-01', NULL, NULL, '2024-07-03 23:30:00', -987.65, 0, NULL, false, 'FX040', 'FIXTURE', 'fx040-202', owner),
      ('0f040000-0000-4000-8000-000000000203', account, '0f040000-0000-4000-8000-000000000008', '0f040000-0000-4000-8000-000000000303',
        'JPY with override', 'JPY', '2024-09-28', '2024-09-30', '2024-10-02', NULL, 150000, 0, acme_usa, false, 'FX040', 'FIXTURE', 'fx040-203', owner),
      ('0f040000-0000-4000-8000-000000000204', account, '0f040000-0000-4000-8000-000000000008', '0f040000-0000-4000-8000-000000000304',
        'CAD by event date', 'CAD', '2024-12-30', NULL, NULL, NULL, 321.09, 0, NULL, false, 'FX040', 'FIXTURE', 'fx040-204', owner),
      ('0f040000-0000-4000-8000-000000000205', account, '0f040000-0000-4000-8000-000000000008', '0f040000-0000-4000-8000-000000000305',
        'AUD', 'AUD', '2024-03-05', '2024-03-05', NULL, NULL, -45.5, 0, NULL, false, 'FX040', 'FIXTURE', 'fx040-205', owner),
      ('0f040000-0000-4000-8000-000000000206', account, '0f040000-0000-4000-8000-000000000008', '0f040000-0000-4000-8000-000000000306',
        'SEK', 'SEK', '2024-07-07', '2024-07-07', NULL, NULL, 77.7, 0, NULL, false, 'FX040', 'FIXTURE', 'fx040-206', owner),
      ('0f040000-0000-4000-8000-000000000207', account, '0f040000-0000-4000-8000-000000000007', '0f040000-0000-4000-8000-000000000307',
        'ETH in', 'ETH', '2024-06-01', '2024-06-01', NULL, '2024-06-01 12:00:00', 1.5, 0, acme_usa, false, 'FX040', 'FIXTURE', 'fx040-207', owner),
      ('0f040000-0000-4000-8000-000000000208', account, '0f040000-0000-4000-8000-000000000007', '0f040000-0000-4000-8000-000000000308',
        'USDC without timestamp', 'USDC', '2024-06-05', '2024-06-05', NULL, NULL, 2500.000001, 0, NULL, false, 'FX040', 'FIXTURE', 'fx040-208', owner),
      ('0f040000-0000-4000-8000-000000000209', account, '0f040000-0000-4000-8000-000000000007', '0f040000-0000-4000-8000-000000000309',
        'GRT', 'GRT', '2024-11-02', '2024-11-02', NULL, '2024-11-02 08:00:00', 10000.123, 0, acme_usa, false, 'FX040', 'FIXTURE', 'fx040-209', owner),
      ('0f040000-0000-4000-8000-000000000210', account, '0f040000-0000-4000-8000-000000000008', '0f040000-0000-4000-8000-000000000310',
        'ILS before any rate', 'ILS', '2024-01-03', '2024-01-03', NULL, NULL, 99.99, 0, NULL, false, 'FX040', 'FIXTURE', 'fx040-210', owner),
      ('0f040000-0000-4000-8000-000000000211', account, '0f040000-0000-4000-8000-000000000007', '0f040000-0000-4000-8000-000000000311',
        'ETH at midnight', 'ETH', '2024-06-02', '2024-06-02', NULL, '2024-06-02 00:00:00', -0.25, 0, acme_usa, false, 'FX040', 'FIXTURE', 'fx040-211', owner),
      ('0f040000-0000-4000-8000-000000000212', account, '0f040000-0000-4000-8000-000000000007', '0f040000-0000-4000-8000-000000000312',
        'USD fee', 'USD', '2024-06-03', '2024-06-03', NULL, NULL, -12.34, 0, acme_retail, true, 'FX040', 'FIXTURE', 'fx040-212', owner),
      ('0f040000-0000-4000-8000-000000000213', account, '0f040000-0000-4000-8000-000000000006', '0f040000-0000-4000-8000-000000000313',
        'Two parties, first', 'USD', '2024-05-05', '2024-05-05', NULL, NULL, 600.01, 0, acme_usa, false, 'FX040', 'FIXTURE', 'fx040-213', owner)
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO accounter_schema.documents (id, type, owner_id, charge_id, creditor_id, debtor_id, date, currency_code, total_amount) VALUES
    ('0f040000-0000-4000-8000-000000000401', 'INVOICE', owner, '0f040000-0000-4000-8000-000000000006', acme_retail, owner, '2024-05-01', 'USD', 600.01)
  ON CONFLICT DO NOTHING;

  -- ------------------------------------------------------------------------------------------
  -- Ledger records: balance charges (annual audit) and revenue lines (annual revenue report)
  -- ------------------------------------------------------------------------------------------
  INSERT INTO accounter_schema.ledger_records (
    id, owner_id, charge_id, debit_entity1, debit_foreign_amount1, debit_local_amount1,
    credit_entity1, credit_foreign_amount1, credit_local_amount1, debit_entity2, credit_entity2,
    currency, invoice_date, value_date, description, reference1
  ) VALUES
    -- balance charges
    ('0f040000-0000-4000-8000-000000000101', owner, '0f040000-0000-4000-8000-000000000001', balance_cancellation, NULL, 1000, acme_usa, NULL, 1000, NULL, NULL, 'ILS', '2023-06-30', '2023-06-30', 'opening', 'B-1'),
    ('0f040000-0000-4000-8000-000000000102', owner, '0f040000-0000-4000-8000-000000000001', acme_usa, NULL, 1000, balance_cancellation, NULL, 1000, NULL, NULL, 'ILS', '2024-02-01', '2024-02-01', 'opening', 'B-2'),
    ('0f040000-0000-4000-8000-000000000103', owner, '0f040000-0000-4000-8000-000000000002', balance_cancellation, NULL, 50, NULL, NULL, 50, NULL, NULL, 'ILS', '2023-01-15', '2023-01-15', NULL, NULL),
    ('0f040000-0000-4000-8000-000000000104', owner, '0f040000-0000-4000-8000-000000000002', NULL, NULL, 50, balance_cancellation, NULL, 50, NULL, NULL, 'ILS', '2023-12-30', '2023-12-30', NULL, NULL),
    ('0f040000-0000-4000-8000-000000000105', owner, '0f040000-0000-4000-8000-000000000003', balance_cancellation, NULL, 10, acme_retail, NULL, 10, NULL, NULL, 'ILS', '2023-03-01', '2023-03-01', NULL, NULL),
    ('0f040000-0000-4000-8000-000000000106', owner, '0f040000-0000-4000-8000-000000000003', acme_retail, NULL, 10, balance_cancellation, NULL, 10, NULL, NULL, 'ILS', '2024-03-01', '2024-03-01', NULL, NULL),
    ('0f040000-0000-4000-8000-000000000107', owner, '0f040000-0000-4000-8000-000000000004', balance_cancellation, NULL, 20, acme_usa, NULL, 20, NULL, NULL, 'ILS', '2023-03-01', '2023-03-01', NULL, NULL),
    ('0f040000-0000-4000-8000-000000000108', owner, '0f040000-0000-4000-8000-000000000004', acme_usa, NULL, 20, balance_cancellation, NULL, 20, NULL, NULL, 'ILS', '2024-03-01', '2024-03-01', NULL, NULL),
    -- revenue: income categories on the credit side (branch 1)
    ('0f040000-0000-4000-8000-000000000111', owner, jan_charge, acme_usa, 500.00, 1826.00, service_income, 500.00, 1826.00, NULL, NULL, 'USD', '2024-01-01', '2024-01-15', 'January services', 'INV-111'),
    ('0f040000-0000-4000-8000-000000000112', owner, '0f040000-0000-4000-8000-000000000006', acme_retail, NULL, 2340.50, output_vat, NULL, 2340.50, NULL, service_income, 'ILS', '2024-03-10', '2024-03-12', 'Local client', 'INV-112'),
    ('0f040000-0000-4000-8000-000000000113', owner, '0f040000-0000-4000-8000-000000000006', acme_usa, 1000.00, 3987.10, service_income, 1000.00, 3987.10, NULL, NULL, 'EUR', '2024-06-25', '2024-06-25', 'EUR services', 'INV-113'),
    ('0f040000-0000-4000-8000-000000000114', owner, '0f040000-0000-4000-8000-000000000006', acme_usa, 333.33, 1570.12, service_income, 333.33, 1570.12, NULL, NULL, 'GBP', '2024-07-01', '2024-07-01', NULL, 'INV-114'),
    ('0f040000-0000-4000-8000-000000000115', owner, '0f040000-0000-4000-8000-000000000006', acme_usa, 150000, 3676.80, service_income, 150000, 3676.80, NULL, NULL, 'JPY', '2024-08-08', '2024-08-08', 'JPY services', NULL),
    ('0f040000-0000-4000-8000-000000000116', owner, '0f040000-0000-4000-8000-000000000006', exchange_rates_cat, 210.5, 570.48, income_fx, 210.5, 570.48, NULL, NULL, 'CAD', '2024-09-09', '2024-09-09', 'CAD gain', NULL),
    ('0f040000-0000-4000-8000-000000000117', owner, '0f040000-0000-4000-8000-000000000006', acme_usa, 99.9, 247.41, service_income, 99.9, 247.41, NULL, NULL, 'AUD', '2024-04-04', '2024-04-04', NULL, NULL),
    ('0f040000-0000-4000-8000-000000000118', owner, '0f040000-0000-4000-8000-000000000006', acme_usa, 1234, 451.21, service_income, 1234, 451.21, NULL, NULL, 'SEK', '2024-07-10', '2024-07-10', 'SEK with no rate', NULL),
    ('0f040000-0000-4000-8000-000000000119', owner, '0f040000-0000-4000-8000-000000000007', acme_usa, 1.5, 21456.7, service_income, 1.5, 21456.7, NULL, NULL, 'ETH', '2024-06-02', '2024-06-02', 'ETH income', NULL),
    ('0f040000-0000-4000-8000-000000000120', owner, '0f040000-0000-4000-8000-000000000007', acme_usa, 2500.000001, 9302.5, service_income, 2500.000001, 9302.5, NULL, NULL, 'USDC', '2024-06-03', '2024-06-03', 'USDC income', NULL),
    ('0f040000-0000-4000-8000-000000000121', owner, '0f040000-0000-4000-8000-000000000007', acme_usa, 40000, 22000, service_income, 40000, 22000, NULL, NULL, 'GRT', '2024-01-05', '2024-01-05', 'GRT before any rate', NULL),
    -- revenue: income categories on the debit side (branch 2)
    ('0f040000-0000-4000-8000-000000000122', owner, refund_charge, service_income, NULL, 500.00, acme_retail, NULL, 500.00, NULL, NULL, 'ILS', '2024-11-20', '2024-11-20', 'Refund', 'CR-122'),
    ('0f040000-0000-4000-8000-000000000123', owner, jan_charge, NULL, 10, 35.5, acme_usa, 10, 35.5, income_fx, NULL, 'USD', '2024-02-02', '2024-02-02', 'FX loss', NULL),
    -- revenue: income to collect, opening (branch 3) and closing (branch 4)
    ('0f040000-0000-4000-8000-000000000124', owner, '0f040000-0000-4000-8000-000000000006', acme_usa, 200, 700, income_to_collect, 200, 700, NULL, NULL, 'USD', '2024-01-01', '2024-01-01', 'Opening to collect, two parties', NULL),
    ('0f040000-0000-4000-8000-000000000125', owner, client_charge, acme_retail, NULL, 1000, NULL, NULL, 1000, NULL, income_to_collect, 'ILS', '2024-01-01', '2024-01-09', 'Opening to collect, one party', NULL),
    ('0f040000-0000-4000-8000-000000000126', owner, dividend_charge, income_to_collect, 100, 400, acme_usa, 100, 400, NULL, NULL, 'EUR', '2024-12-31', '2024-12-31', 'Closing to collect', NULL),
    ('0f040000-0000-4000-8000-000000000127', owner, '0f040000-0000-4000-8000-000000000005', NULL, 50, 182.35, acme_usa, 50, 182.35, income_to_collect, NULL, 'USD', '2024-12-31', '2024-12-31', 'Closing to collect, no party', NULL),
    ('0f040000-0000-4000-8000-000000000132', owner, '0f040000-0000-4000-8000-000000000007', acme_usa, 0.75, 9000, income_to_collect, 0.75, 9000, NULL, NULL, 'ETH', '2024-01-01', '2024-01-01', 'Opening to collect, crypto', NULL),
    -- revenue: the same row from branch 1 and branch 3 (UNION keeps one)
    ('0f040000-0000-4000-8000-000000000128', owner, jan_charge, acme_usa, NULL, 0.00, service_income, NULL, 0.00, NULL, income_to_collect, 'USD', '2024-01-01', '2024-01-01', 'dup', 'R-128'),
    -- revenue: outside 2024
    ('0f040000-0000-4000-8000-000000000129', owner, jan_charge, acme_usa, 5, 18, service_income, 5, 18, NULL, NULL, 'USD', '2025-01-05', '2025-01-05', 'next year', NULL)
  ON CONFLICT DO NOTHING;

  -- ------------------------------------------------------------------------------------------
  -- VAT reports (pcn874)
  -- ------------------------------------------------------------------------------------------
  INSERT INTO accounter_schema.pcn874 (business_id, month_date, content, owner_id) VALUES
    (owner, '2024-01-01', 'O0000000001202401 fixture january', owner),
    (owner, '2024-02-01', 'O0000000001202402 fixture february', owner),
    (acme_usa, '2024-01-01', 'O0000000002202401 other business', owner)
  ON CONFLICT DO NOTHING;

  -- ------------------------------------------------------------------------------------------
  -- Dynamic reports: templates, snapshots, comment threads and comments
  -- ------------------------------------------------------------------------------------------
  INSERT INTO accounter_schema.dynamic_report_templates (name, owner_id, template, created_at, updated_at, is_locked, from_date, to_date) VALUES
    ('fixture-040 Balance', owner, '{"nodes":[{"id":"assets"}]}', '2025-01-02 09:00:00', '2025-01-03 09:00:00', true, '2024-01-01', '2024-12-31'),
    ('fixture-040 P&L', owner, '{"nodes":[]}', '2025-01-02 10:00:00', '2025-01-02 10:00:00', false, NULL, NULL),
    ('fixture-040 Spare', owner, '{}', '2025-01-04 10:00:00', '2025-01-04 10:00:00', false, '2023-01-01', NULL)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.dynamic_report_template_snapshots (
    id, owner_id, template_name, from_date, to_date, scope_owner_id, tree, leaf_values, created_by,
    created_at, leaf_fingerprints, leaf_approvals
  ) VALUES
    ('0f040000-0000-4000-8000-000000000601', owner, 'fixture-040 P&L', '2024-01-01', '2024-12-31', owner,
      '{"id":"root","children":[{"id":"rev"}]}', '{"rev":"1234.50"}', user_a, '2025-02-01 09:00:00+00',
      '{"rev":"f1"}', '{"rev":{"by":"a","at":"2025-02-01"}}'),
    ('0f040000-0000-4000-8000-000000000602', owner, 'fixture-040 P&L', '2024-01-01', '2024-12-31', owner,
      '{"id":"root","children":[{"id":"rev"}]}', '{"rev":"1300"}', user_a, '2025-02-03 09:00:00+00',
      '{"rev":"f2"}', '{"rev":{"by":"a","at":"2025-02-03"}}'),
    ('0f040000-0000-4000-8000-000000000603', owner, 'fixture-040 P&L', '2023-01-01', '2023-12-31', owner,
      '{"id":"root"}', '{}', NULL, '2025-02-02 09:00:00+00', NULL, NULL),
    ('0f040000-0000-4000-8000-000000000604', owner, 'fixture-040 Balance', '2024-01-01', '2024-12-31', owner,
      '[1, 2, {"deep": [true, null]}]', '{"a": 1.50, "b": [1, 2]}', user_b, '2025-01-15 12:30:00+00', NULL, '{}')
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.dynamic_report_threads (id, owner_id, template_name, node_id, node_kind, node_label, resolved_at, resolved_by, created_at) VALUES
    ('0f040000-0000-4000-8000-000000000501', owner, 'fixture-040 P&L', 'rev', 'leaf', 'Revenue', NULL, NULL, '2025-03-01 10:00:00+00'),
    ('0f040000-0000-4000-8000-000000000502', owner, 'fixture-040 P&L', 'costs', 'branch', 'Costs', '2025-03-02 11:00:00+00', user_b, '2025-03-01 10:00:00+00'),
    ('0f040000-0000-4000-8000-000000000503', owner, 'fixture-040 Balance', 'assets', 'branch', 'Assets', NULL, NULL, '2025-03-01 09:00:00+00')
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.dynamic_report_comments (id, owner_id, thread_id, author_id, content, from_date, to_date, scope_owner_id, created_at, edited_at, deleted_at) VALUES
    ('0f040000-0000-4000-8000-000000000551', owner, '0f040000-0000-4000-8000-000000000501', user_a, 'Revenue looks low', '2024-01-01', '2024-12-31', owner, '2025-03-01 10:05:00+00', NULL, NULL),
    ('0f040000-0000-4000-8000-000000000552', owner, '0f040000-0000-4000-8000-000000000501', user_b, 'Checked, it is right', '2024-01-01', '2024-12-31', owner, '2025-03-01 10:06:00+00', '2025-03-01 10:07:00+00', NULL),
    ('0f040000-0000-4000-8000-000000000553', owner, '0f040000-0000-4000-8000-000000000501', user_a, 'removed', '2024-01-01', '2024-12-31', owner, '2025-03-01 10:06:00+00', NULL, '2025-03-01 10:08:00+00'),
    ('0f040000-0000-4000-8000-000000000554', owner, '0f040000-0000-4000-8000-000000000502', user_a, 'Costs fine', '2024-01-01', '2024-12-31', owner, '2025-03-01 10:30:00+00', NULL, NULL),
    ('0f040000-0000-4000-8000-000000000555', owner, '0f040000-0000-4000-8000-000000000503', user_b, 'Assets ok', '2024-01-01', '2024-12-31', owner, '2025-03-01 09:30:00+00', NULL, NULL)
  ON CONFLICT DO NOTHING;

  -- ------------------------------------------------------------------------------------------
  -- Annual audit step statuses
  -- ------------------------------------------------------------------------------------------
  INSERT INTO accounter_schema.annual_audit_step_status (owner_id, year, step_id, status, notes, evidence_json, completed_at, created_at, updated_at) VALUES
    (owner, 2024, '1', 'COMPLETED', 'done', NULL, '2025-01-10 08:00:00+00', '2025-01-09 08:00:00+00', '2025-01-10 08:00:00+00'),
    (owner, 2024, '3', 'BLOCKED', NULL, NULL, NULL, '2025-01-09 08:00:00+00', '2025-01-09 08:00:00+00'),
    (owner, 2024, '5', 'PENDING', NULL, '{"balanceSheetTemplateName":"fixture-040 Balance","profitAndLossTemplateName":"fixture-040 P&L"}', NULL, '2025-01-09 08:00:00+00', '2025-01-09 08:00:00+00'),
    (owner, 2024, '9', 'COMPLETED', 'final', '{"balanceSheetTemplateName":"fixture-040 Balance","profitAndLossTemplateName":"fixture-040 P&L"}', '2025-01-11 08:00:00+00', '2025-01-09 08:00:00+00', '2025-01-11 08:00:00+00'),
    (owner, 2023, '5', 'IN_PROGRESS', 'keep me', '{"balanceSheetTemplateName":"fixture-040 Balance","note":"keep","count":3}', NULL, '2024-01-09 08:00:00+00', '2024-01-09 08:00:00+00'),
    (owner, 2023, '9', 'IN_PROGRESS', NULL, '{"lockedTemplateName":"fixture-040 Balance"}', NULL, '2024-01-09 08:00:00+00', '2024-01-09 08:00:00+00'),
    (owner, 2022, '5', 'PENDING', NULL, NULL, NULL, '2023-01-09 08:00:00+00', '2023-01-09 08:00:00+00'),
    (owner, 2022, '9', 'COMPLETED', NULL, '{"profitAndLossTemplateName":"fixture-040 Spare","extra":{"nested":[1,2]}}', '2023-02-01 08:00:00+00', '2023-01-09 08:00:00+00', '2023-02-01 08:00:00+00')
  ON CONFLICT DO NOTHING;

  -- ------------------------------------------------------------------------------------------
  -- Form 1214: profiles and shareholders
  -- ------------------------------------------------------------------------------------------
  INSERT INTO accounter_schema.report_1214_profiles (owner_id, year, company, related_companies, amount_overrides, preparer, created_at, updated_at) VALUES
    (owner, 2023, '{"phone":"03-1234567","email":"a@b.c"}', '[{"name":"Sub Ltd","share":50}]', '{"100": 1234.5, "150": 0}', '{"name":"CPA"}', '2024-03-01 08:00:00+00', '2024-03-02 08:00:00+00'),
    (owner, 2024, '{}', '[]', '{}', '{}', '2025-03-01 08:00:00+00', '2025-03-01 08:00:00+00')
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.shareholders (
    id, owner_id, year, business_id, id_number, full_name, is_controlling, dividend_rights_percent,
    voting_rights_percent, other_rights_percent, is_material, salary_months_1_to_9,
    salary_months_10_to_12, other_payments, sort_order, created_at, updated_at
  ) VALUES
    ('0f040000-0000-4000-8000-000000000701', owner, 2024, NULL, '123456782', 'Dana Levi', true, 60, 60, NULL, true, 120000.50, 40000, 0, 0, '2025-01-01 00:00:00+00', '2025-01-01 00:00:00+00'),
    ('0f040000-0000-4000-8000-000000000703', owner, 2024, NULL, '999999964', 'Foreign Holder', false, 30.5, 30.5, NULL, false, NULL, NULL, NULL, 1, '2025-01-01 00:00:00+00', '2025-01-01 00:00:00+00'),
    ('0f040000-0000-4000-8000-000000000702', owner, 2024, NULL, '999999964', 'Foreign Holder Two', false, 9.5, 9.5, 12.3456, NULL, NULL, NULL, 15.75, 1, '2025-01-01 00:00:00+00', '2025-01-01 00:00:00+00'),
    ('0f040000-0000-4000-8000-000000000704', owner, 2023, acme_usa, '123456782', 'Dana Levi', true, 70, 70, NULL, true, 100000, 33000.33, NULL, 0, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00'),
    ('0f040000-0000-4000-8000-000000000705', owner, 2023, NULL, '987654321', 'Avi Cohen', false, 30, 30, NULL, false, NULL, NULL, NULL, 1, '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00')
  ON CONFLICT DO NOTHING;

  -- ------------------------------------------------------------------------------------------
  -- Corporate tax rates and dividends
  -- ------------------------------------------------------------------------------------------
  INSERT INTO accounter_schema.corporate_tax_variables (corporate_id, date, tax_rate, original_tax_rate, owner_id) VALUES
    (owner, '2018-01-01', 23, 23, owner),
    (owner, '2023-01-01', 23.5, 23, owner),
    (owner, '2024-01-01', 0.24, 23.00, owner),
    (acme_usa, '2022-07-01', 21, 21, owner)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.dividends (id, business_id, amount, date, transaction_id, owner_id, withholding_tax_percentage_override) VALUES
    ('0f040000-0000-4000-8000-000000000801', acme_usa, 10000.00, '2024-12-31', '2cbef481-153d-5b18-a633-c3fae2767b39', owner, NULL),
    ('0f040000-0000-4000-8000-000000000802', acme_retail, 2500.5, '2024-11-15', '5d68f59a-a06d-570b-ab9a-446ea660053d', owner, 0.25),
    ('0f040000-0000-4000-8000-000000000803', acme_usa, 750, '2024-06-30', NULL, owner, NULL),
    ('0f040000-0000-4000-8000-000000000804', acme_retail, 1.005, '2024-12-30', '2cbef481-153d-5b18-a633-c3fae2767b39', owner, 0.1)
  ON CONFLICT DO NOTHING;
END $$;
