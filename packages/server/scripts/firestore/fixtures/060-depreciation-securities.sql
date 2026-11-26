-- Fixture rows for the depreciation, foreign-securities, exchange-rates and price-indexes ports.
-- Applied by `yarn workspace @accounter/server firestore:fixtures --only 060-depreciation-securities`.
-- Idempotent: every insert skips rows that exist. Ids are fixed UUIDs in the
-- 0f060000-0000-4000-8000-xxxxxxxxxxxx range. Tenant rows are owned by the demo tenant (the single
-- user_context owner); a few are owned by another business (`other`), which RLS hides from the
-- tenant, so the ports' tenant isolation is compared too.
--
-- Existing demo charges are taken from the middle of the id order (offset 3..8).

-- Global reference data ------------------------------------------------------------------------

-- exchange_rates has no primary key, only a unique index on exchange_date (NULLs allowed)
INSERT INTO accounter_schema.exchange_rates (exchange_date, usd, eur, gbp, cad, jpy, aud, sek) VALUES
  ('2024-01-01', 3.627, 4.0123, 4.6123, 2.7012, 0.025123, 2.4567, 0.3512),
  ('2024-01-02', 3.640, 3.9876, 4.6001, 2.7100, 0.025200, 2.4600, 0.3520),
  ('2024-01-05', 3.700, 4.0500, NULL, NULL, NULL, NULL, NULL),
  ('2024-02-01', 3.600, 3.9000, 4.5500, 2.6500, 0.024500, 2.4000, 0.3400),
  ('2025-06-30', 3.400, 3.9500, 4.6500, 2.4800, 0.023400, 2.2100, 0.3500)
ON CONFLICT DO NOTHING;

INSERT INTO accounter_schema.exchange_rates (exchange_date, usd, eur)
SELECT NULL, 9.999, 9.9999
WHERE NOT EXISTS (SELECT 1 FROM accounter_schema.exchange_rates WHERE exchange_date IS NULL);

INSERT INTO accounter_schema.crypto_currencies (symbol, name, coingecko_id, coinmarketcap_id) VALUES
  ('ETH', 'Ethereum', 'ethereum', 1027),
  ('GRT', 'The Graph', 'the-graph', 6719),
  ('USDC', 'USD Coin', 'usd-coin', NULL)
ON CONFLICT DO NOTHING;

INSERT INTO accounter_schema.crypto_exchange_rates (date, coin_symbol, value, against, sample_date) VALUES
  ('2024-01-01 00:00:00', 'ETH', 2281.41, 'USD', '2023-12-31 23:55:00'),
  ('2024-01-02 12:30:00', 'ETH', 2350.123456789, 'USD', '2024-01-02 12:25:00'),
  ('2024-01-01 00:00:00', 'GRT', 0.1745, 'USD', '2023-12-31 23:58:30'),
  ('2024-01-03 00:00:00', 'ETH', 8500.50, 'ILS', '2024-01-02 23:59:59')
ON CONFLICT DO NOTHING;

INSERT INTO accounter_schema.depreciation_categories (id, name, percentage) VALUES
  ('0f060000-0000-4000-8000-000000000001', 'Computers', 33.00),
  ('0f060000-0000-4000-8000-000000000002', 'Furniture', 6.00),
  ('0f060000-0000-4000-8000-000000000003', 'Land', 0.00),
  -- 004 is used by no asset; 005 only by an asset of `other` (hidden from the tenant by RLS)
  ('0f060000-0000-4000-8000-000000000004', 'Vehicles', 15.00),
  ('0f060000-0000-4000-8000-000000000005', 'Leased equipment', 20.00)
ON CONFLICT DO NOTHING;

INSERT INTO accounter_schema.price_index_bases (index_code, base_label, first_period, chain_coefficient, chained_factor) VALUES
  (120010, 'Average 2018', '2019-01-01', NULL, 1),
  (120010, 'Average 2020', '2021-01-01', 1.006, 1.006),
  (120010, 'Average 2022', '2023-01-01', 1.081, 1.087486),
  (120020, 'Average 2022', '2023-01-01', NULL, 1)
ON CONFLICT DO NOTHING;

INSERT INTO accounter_schema.price_index_values
  (index_code, period, value, base_label, chained_value, monthly_change_pct, yearly_change_pct, published_on) VALUES
  (120010, '2022-11-01', 105.3, 'Average 2020', 105.9318, 0.3, 5.3, '2022-12-15'),
  (120010, '2022-12-01', 105.2, 'Average 2020', 105.8312, -0.1, 5.3, '2023-01-15'),
  (120010, '2023-01-01', 100.0, 'Average 2022', 108.7486, NULL, 5.4, '2023-02-15'),
  (120010, '2023-02-01', 100.4, 'Average 2022', 109.183594, 0.4, NULL, '2023-03-15'),
  (120020, '2023-01-01', 100, 'Average 2022', 100, NULL, NULL, '2023-02-15')
ON CONFLICT DO NOTHING;

-- Tenant data ----------------------------------------------------------------------------------

DO $$
DECLARE
  owner UUID := (SELECT owner_id FROM accounter_schema.user_context LIMIT 1);
  other UUID := (SELECT id FROM accounter_schema.businesses
                 WHERE owner_id = owner AND id <> owner ORDER BY id DESC LIMIT 1);
  c0 UUID := (SELECT id FROM accounter_schema.charges WHERE owner_id = owner ORDER BY id OFFSET 3 LIMIT 1);
  c1 UUID := (SELECT id FROM accounter_schema.charges WHERE owner_id = owner ORDER BY id OFFSET 4 LIMIT 1);
  c2 UUID := (SELECT id FROM accounter_schema.charges WHERE owner_id = owner ORDER BY id OFFSET 5 LIMIT 1);
  c3 UUID := (SELECT id FROM accounter_schema.charges WHERE owner_id = owner ORDER BY id OFFSET 6 LIMIT 1);
  c4 UUID := (SELECT id FROM accounter_schema.charges WHERE owner_id = owner ORDER BY id OFFSET 7 LIMIT 1);
  c5 UUID := (SELECT id FROM accounter_schema.charges WHERE owner_id = owner ORDER BY id OFFSET 8 LIMIT 1);
  tc1 UUID := (SELECT id FROM accounter_schema.tax_categories WHERE owner_id = owner ORDER BY id OFFSET 5 LIMIT 1);
BEGIN
  -- depreciation (101-110). 107 and 110 belong to `other`.
  INSERT INTO accounter_schema.depreciation
    (id, charge_id, amount, currency, activation_date, type, category, owner_id, local_amount, asset_tax_category_id) VALUES
    ('0f060000-0000-4000-8000-000000000101', c0, 10000.00, 'ILS', '2023-03-01', 'GENERAL_AND_MANAGEMENT', '0f060000-0000-4000-8000-000000000001', owner, NULL, NULL),
    ('0f060000-0000-4000-8000-000000000102', c0, 5000, 'USD', '2024-01-15', 'MARKETING', '0f060000-0000-4000-8000-000000000001', owner, NULL, NULL),
    ('0f060000-0000-4000-8000-000000000103', c1, 5000, 'USD', '2023-06-01', 'RESEARCH_AND_DEVELOPMENT', '0f060000-0000-4000-8000-000000000002', owner, 18000.50, tc1),
    ('0f060000-0000-4000-8000-000000000104', c1, NULL, NULL, '2022-01-01', NULL, '0f060000-0000-4000-8000-000000000003', owner, NULL, NULL),
    ('0f060000-0000-4000-8000-000000000105', c2, 3000.40, 'ILS', '2022-05-01', 'GENERAL_AND_MANAGEMENT', '0f060000-0000-4000-8000-000000000002', owner, NULL, NULL),
    ('0f060000-0000-4000-8000-000000000106', c2, 2000.50, NULL, '2025-02-01', 'MARKETING', '0f060000-0000-4000-8000-000000000001', owner, NULL, NULL),
    ('0f060000-0000-4000-8000-000000000107', c0, 777, 'ILS', '2023-01-01', 'MARKETING', '0f060000-0000-4000-8000-000000000001', other, NULL, NULL),
    ('0f060000-0000-4000-8000-000000000108', c3, 1500.5, 'EUR', '2023-03-01', 'GENERAL_AND_MANAGEMENT', '0f060000-0000-4000-8000-000000000001', owner, 1500.49, NULL),
    ('0f060000-0000-4000-8000-000000000109', c3, 100, 'ILS', '2023-04-01', 'RESEARCH_AND_DEVELOPMENT', '0f060000-0000-4000-8000-000000000002', owner, NULL, NULL),
    ('0f060000-0000-4000-8000-000000000110', c3, 900, 'ILS', '2023-04-01', 'MARKETING', '0f060000-0000-4000-8000-000000000005', other, NULL, NULL)
  ON CONFLICT DO NOTHING;

  -- depreciation_disposals (201-207). 207 belongs to `other`.
  INSERT INTO accounter_schema.depreciation_disposals
    (id, owner_id, depreciation_id, charge_id, type, disposal_date, disposed_cost, proceeds, description, refund_mode, original_amount, original_currency) VALUES
    ('0f060000-0000-4000-8000-000000000201', owner, '0f060000-0000-4000-8000-000000000101', c4, 'SALE', '2024-06-30', 2500.40, 1000, 'Sold laptop', NULL, NULL, NULL),
    ('0f060000-0000-4000-8000-000000000202', owner, '0f060000-0000-4000-8000-000000000105', NULL, 'WRITE_OFF', '2023-01-31', 1000.20, 0, NULL, NULL, NULL, NULL),
    ('0f060000-0000-4000-8000-000000000203', owner, '0f060000-0000-4000-8000-000000000105', c4, 'WRITE_OFF', '2023-06-30', 2000.20, 0, 'Broken', NULL, NULL, NULL),
    ('0f060000-0000-4000-8000-000000000204', owner, '0f060000-0000-4000-8000-000000000103', c4, 'COST_REFUND', '2024-06-30', NULL, 0, 'Vendor refund', 'FROM_REFUND_DATE', 500, 'USD'),
    ('0f060000-0000-4000-8000-000000000205', owner, '0f060000-0000-4000-8000-000000000108', c5, 'SALE', '2023-12-31', 1500.49, 1200, NULL, NULL, NULL, NULL),
    ('0f060000-0000-4000-8000-000000000206', owner, '0f060000-0000-4000-8000-000000000109', NULL, 'COST_REFUND', '2023-05-01', NULL, 0, NULL, NULL, 10, 'EUR'),
    ('0f060000-0000-4000-8000-000000000207', other, '0f060000-0000-4000-8000-000000000107', NULL, 'SALE', '2024-01-01', 100, 50, NULL, NULL, NULL, NULL)
  ON CONFLICT DO NOTHING;

  -- Security businesses (301-303): entity, business, security business. 303 is held by `other`.
  INSERT INTO accounter_schema.financial_entities (id, type, owner_id, name) VALUES
    ('0f060000-0000-4000-8000-000000000301', 'business', owner, 'Fixture Apple Inc.'),
    ('0f060000-0000-4000-8000-000000000302', 'business', owner, 'Fixture iShares MSCI World'),
    ('0f060000-0000-4000-8000-000000000303', 'business', owner, 'Fixture Apple Inc. (other)')
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.businesses (id, owner_id, country) VALUES
    ('0f060000-0000-4000-8000-000000000301', owner, 'USA'),
    ('0f060000-0000-4000-8000-000000000302', owner, 'IRL'),
    ('0f060000-0000-4000-8000-000000000303', owner, 'USA')
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.businesses_securities
    (id, owner_id, isin, symbol, eng_name, heb_name, exchange, currency_code, item_type, stock_type, is_etf, is_foreign, issuer_country_code) VALUES
    ('0f060000-0000-4000-8000-000000000301', owner, 'US0378331005', 'AAPL', 'Apple Inc.', 'אפל', 'NASDAQ', 'USD', 'מניה', 'רגילה', false, true, 'US'),
    ('0f060000-0000-4000-8000-000000000302', owner, 'IE00B4L5Y983', 'IWDA', 'iShares Core MSCI World', NULL, 'LSE', 'USD', 'קרן סל', NULL, true, NULL, 'IE'),
    ('0f060000-0000-4000-8000-000000000303', other, 'US0378331005', 'AAPL', 'Apple Inc.', NULL, NULL, NULL, NULL, NULL, NULL, true, NULL)
  ON CONFLICT DO NOTHING;

  -- security_identifiers (311-315). 315 is `other`'s, with the same Poalim key as 311.
  INSERT INTO accounter_schema.security_identifiers (id, owner_id, business_id, identifier_type, identifier_value) VALUES
    ('0f060000-0000-4000-8000-000000000311', owner, '0f060000-0000-4000-8000-000000000301', 'POALIM_SECURITY_KEY', '1105467'),
    ('0f060000-0000-4000-8000-000000000312', owner, '0f060000-0000-4000-8000-000000000301', 'ISIN', 'US0378331005'),
    ('0f060000-0000-4000-8000-000000000313', owner, '0f060000-0000-4000-8000-000000000302', 'POALIM_SECURITY_KEY', '1159250'),
    ('0f060000-0000-4000-8000-000000000314', owner, '0f060000-0000-4000-8000-000000000302', 'ISIN', 'IE00B4L5Y983'),
    ('0f060000-0000-4000-8000-000000000315', other, '0f060000-0000-4000-8000-000000000303', 'POALIM_SECURITY_KEY', '1105467')
  ON CONFLICT DO NOTHING;

  -- poalim_securities reference rows (401-404). Two accounts hold 1105467; 404 is `other`'s.
  INSERT INTO accounter_schema.poalim_securities
    (id, owner_id, bank_number, branch_number, account_number, as_of_date, security_key, eng_name, heb_name,
     item_type, is_etf, is_foreign, currency_code, exchange, equity_type, equity_sub_type, eng_symbol, heb_symbol, symbol, stock_type) VALUES
    ('0f060000-0000-4000-8000-000000000401', owner, 12, 600, 123456, '2024-03-01 10:00:00+00', '1105467', 'APPLE INC', 'אפל', 'מניה', false, true, 'USD', 'NASDAQ', 1, 1, 'AAPL', NULL, 'AAPL', 'רגילה'),
    ('0f060000-0000-4000-8000-000000000402', owner, 12, 600, 654321, '2024-06-01 10:00:00+00', '1105467', 'APPLE INC NEW', 'אפל', 'מניה', false, true, 'USD', 'NASDAQ', 1, 1, 'AAPL', NULL, 'AAPL', NULL),
    ('0f060000-0000-4000-8000-000000000403', owner, 12, 600, 123456, '2024-03-01 10:00:00+00', '1159250', 'ISHARES CORE MSCI WORLD', 'איישרס', 'קרן סל', true, true, 'USD', 'LSE', 2, 5, 'IWDA', NULL, NULL, NULL),
    ('0f060000-0000-4000-8000-000000000404', other, 12, 600, 777777, '2024-09-01 10:00:00+00', '1105467', 'APPLE INC OTHER', 'אפל', 'מניה', NULL, true, 'USD', 'NASDAQ', 1, 1, NULL, NULL, NULL, NULL)
  ON CONFLICT DO NOTHING;

  -- poalim_securities_transactions (501-517). 510 is `other`'s. Distributions of 1105467: 504 and
  -- 511 (live, same size) and 512 (a cancellation, which pairs with the later one, 511); 509 is
  -- before a ledger lock by its value date; 505 is booked by c5 and 515 dismissed. Of 1159250: 506
  -- cancelled by 507, then 508 live.
  INSERT INTO accounter_schema.poalim_securities_transactions
    (id, owner_id, bank_number, branch_number, account_number, security, trade_date, value_date, settlement_date,
     trade_type, transaction_type, nv, trade_price, net_value_trade_currency, payment_type, payment_date, isin, symbol,
     eng_name, issuer_country_code, trade_currency, settlement_currency, commissions_currency,
     trade_gross_value_trade_currency, trade_gross_value_nis, net_value_nis, net_value_settlement_currency,
     trade_commission_value_nis, trade_commission_value_trade_currency, personal_currency_rate, is_cancel_transaction) VALUES
    ('0f060000-0000-4000-8000-000000000501', owner, 12, 600, 123456, '1105467', '2024-01-10', '2024-01-12', '2024-01-12',
     'קניה', 'קניה', 10, 185.5, -1860.5, NULL, NULL, 'US0378331005', 'AAPL', 'APPLE INC', 'US', 'USD', 'USD', 'USD',
     1855, 6748.49, -6766.68, -1860.5, 18.19, 5.5, 3.6377, NULL),
    ('0f060000-0000-4000-8000-000000000502', owner, 12, 600, 123456, '1105467', '2024-03-15', NULL, NULL,
     'מכירה', 'מכירה', -4, 172.25, 683.5, NULL, NULL, 'US0378331005', 'AAPL', 'APPLE INC', 'US', 'USD', 'USD', 'USD',
     689, 2507.96, 2487.94, 683.5, 20.02, 5.5, 3.64, NULL),
    ('0f060000-0000-4000-8000-000000000503', owner, 12, 600, 123456, '1159250', '2024-02-01', '2024-02-05', '2024-02-05',
     'קניה', 'קניה', 20, 90.1, -1807, NULL, NULL, 'IE00B4L5Y983', 'IWDA', 'ISHARES CORE MSCI WORLD', 'IE', 'USD', 'USD', 'USD',
     1802, 6560.0, -6578.2, -1807, 18.2, 5, 3.6404, NULL),
    ('0f060000-0000-4000-8000-000000000504', owner, 12, 600, 123456, '1105467', '2024-05-20', NULL, NULL,
     'הטבה חלוקת מניות', 'תשלומים ואירועי חברה', 2, NULL, NULL, 'דיבידנד בעין', '2024-05-20', 'US0378331005', 'AAPL', 'APPLE INC', 'US', NULL, NULL, NULL,
     NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    ('0f060000-0000-4000-8000-000000000505', owner, 12, 600, 123456, '1105467', '2024-06-10', NULL, NULL,
     'הטבה חלוקת מניות', 'תשלומים ואירועי חברה', 3, NULL, NULL, 'דיבידנד בעין', '2024-06-10', 'US0378331005', 'AAPL', 'APPLE INC', 'US', NULL, NULL, NULL,
     NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    ('0f060000-0000-4000-8000-000000000506', owner, 12, 600, 123456, '1159250', '2024-07-01', NULL, NULL,
     'הטבה חלוקת מניות', 'תשלומים ואירועי חברה', 5, NULL, NULL, 'דיבידנד בעין', '2024-07-01', 'IE00B4L5Y983', 'IWDA', NULL, 'IE', NULL, NULL, NULL,
     NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    ('0f060000-0000-4000-8000-000000000507', owner, 12, 600, 123456, '1159250', '2024-07-03', NULL, NULL,
     'הטבה חלוקת מניות', 'תשלומים ואירועי חברה', -5, NULL, NULL, 'דיבידנד בעין', '2024-07-03', 'IE00B4L5Y983', 'IWDA', NULL, 'IE', NULL, NULL, NULL,
     NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'כן'),
    ('0f060000-0000-4000-8000-000000000508', owner, 12, 600, 123456, '1159250', '2024-08-01', NULL, NULL,
     'הטבה חלוקת מניות', 'תשלומים ואירועי חברה', 5, NULL, NULL, 'דיבידנד בעין', '2024-08-01', 'IE00B4L5Y983', 'IWDA', NULL, 'IE', NULL, NULL, NULL,
     NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    ('0f060000-0000-4000-8000-000000000509', owner, 12, 600, 123456, '1105467', '2023-12-01', '2023-11-30', NULL,
     'הטבה חלוקת מניות', 'תשלומים ואירועי חברה', 1, NULL, NULL, 'דיבידנד בעין', '2023-12-01', 'US0378331005', 'AAPL', 'APPLE INC', 'US', NULL, NULL, NULL,
     NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    ('0f060000-0000-4000-8000-000000000510', other, 12, 600, 777777, '1105467', '2024-05-20', NULL, NULL,
     'הטבה חלוקת מניות', 'תשלומים ואירועי חברה', 2, NULL, NULL, 'דיבידנד בעין', '2024-05-20', 'US0378331005', 'AAPL', 'APPLE INC', 'US', NULL, NULL, NULL,
     NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    ('0f060000-0000-4000-8000-000000000511', owner, 12, 600, 123456, '1105467', '2024-05-25', NULL, NULL,
     'הטבה חלוקת מניות', 'תשלומים ואירועי חברה', 2, NULL, NULL, 'דיבידנד בעין', '2024-05-25', 'US0378331005', 'AAPL', 'APPLE INC', 'US', NULL, NULL, NULL,
     NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    ('0f060000-0000-4000-8000-000000000512', owner, 12, 600, 123456, '1105467', '2024-05-28', NULL, NULL,
     'הטבה חלוקת מניות', 'תשלומים ואירועי חברה', -2, NULL, NULL, 'דיבידנד בעין', '2024-05-28', 'US0378331005', 'AAPL', 'APPLE INC', 'US', NULL, NULL, NULL,
     NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'כן'),
    ('0f060000-0000-4000-8000-000000000513', owner, 12, 600, 123456, '1105467', '2024-09-01', NULL, NULL,
     'דבידנד תשלום', 'תשלומים ואירועי חברה', NULL, NULL, 2.5, 'דיבידנד', '2024-09-01', 'US0378331005', 'AAPL', 'APPLE INC', 'US', 'USD', 'USD', NULL,
     NULL, NULL, 9.1, 2.5, NULL, NULL, NULL, NULL),
    ('0f060000-0000-4000-8000-000000000514', owner, 12, 600, 654321, '1105467', '2024-04-01', '2024-04-03', '2024-04-03',
     'קניה', 'קניה', 1, 170, -175, NULL, NULL, 'US0378331005', 'AAPL', 'APPLE INC', 'US', 'USD', 'USD', 'USD',
     170, 629, -647.5, -175, 18.5, 5, 3.7, NULL),
    ('0f060000-0000-4000-8000-000000000515', owner, 12, 600, 123456, '1105467', '2024-10-01', NULL, NULL,
     'הטבה חלוקת מניות', 'תשלומים ואירועי חברה', 4, NULL, NULL, 'דיבידנד בעין', '2024-10-01', 'US0378331005', 'AAPL', 'APPLE INC', 'US', NULL, NULL, NULL,
     NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    ('0f060000-0000-4000-8000-000000000516', owner, 12, 600, 123456, '1105467', '2024-01-10', '2024-01-11', '2024-01-12',
     'קניה', 'קניה', 5, 185.6, -933, NULL, NULL, 'US0378331005', 'AAPL', 'APPLE INC', 'US', 'USD', 'USD', 'USD',
     928, 3375.81, -3394.0, -933, 18.19, 5, 3.6377, NULL),
    -- a security with no identifier row (no security business yet)
    ('0f060000-0000-4000-8000-000000000517', owner, 12, 600, 123456, '9999999', '2024-02-10', '2024-02-12', '2024-02-12',
     'קניה', 'קניה', 7, 12.5, -92.5, NULL, NULL, NULL, 'NEWCO', 'NEWCO LTD', NULL, 'USD', 'USD', 'USD',
     87.5, 318.5, -336.7, -92.5, 18.2, 5, 3.64, NULL)
  ON CONFLICT DO NOTHING;

  -- charges_securities_executions: 505 booked by c5, 515 dismissed (NULL charge), 510 by `other`
  INSERT INTO accounter_schema.charges_securities_executions (execution_id, charge_id, owner_id) VALUES
    ('0f060000-0000-4000-8000-000000000505', c5, owner),
    ('0f060000-0000-4000-8000-000000000515', NULL, owner),
    ('0f060000-0000-4000-8000-000000000501', c5, owner),
    ('0f060000-0000-4000-8000-000000000510', c0, other)
  ON CONFLICT DO NOTHING;
END $$;
