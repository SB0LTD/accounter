-- Verification rows for the scraper-ingestion module (raw bank/card tables and their insert
-- triggers). Idempotent; ids are fixed UUIDs in the 0f030000-... range.
--
-- The raw rows below fire their AFTER INSERT triggers when first applied, so each also gets its
-- transactions_raw_list entry, charge and transaction (with generated ids), as scraped data does.
-- ON CONFLICT DO NOTHING on a re-run skips the row and therefore the trigger.
--
-- Accounts (financial_accounts.account_number) the raw rows resolve to:
--   4580 cal card, 1234 isracard card, 5678 amex card, 0301234567 discount account,
--   9876 max card, 5326-1111 otsar card, 778899 otsar foreign, 445566 otsar ILS,
--   112233 poalim (ILS, foreign and SWIFT),
--   5326-2222 / 445567 accounts without an owner, 778800 a card where a bank account is expected.

DO $$
DECLARE
  tenant UUID := (SELECT owner_id FROM accounter_schema.user_context LIMIT 1);
BEGIN
  INSERT INTO accounter_schema.financial_accounts (id, account_number, type, owner, owner_id, private_business) VALUES
    ('0f030000-0000-4000-8000-000000000001', '4580', 'CREDIT_CARD', tenant, tenant, 'business'),
    ('0f030000-0000-4000-8000-000000000002', '1234', 'CREDIT_CARD', tenant, tenant, 'business'),
    ('0f030000-0000-4000-8000-000000000003', '5678', 'CREDIT_CARD', tenant, tenant, 'business'),
    ('0f030000-0000-4000-8000-000000000004', '0301234567', 'BANK_ACCOUNT', tenant, tenant, 'business'),
    ('0f030000-0000-4000-8000-000000000005', '9876', 'CREDIT_CARD', tenant, tenant, 'business'),
    ('0f030000-0000-4000-8000-000000000006', '5326-1111', 'CREDIT_CARD', tenant, tenant, 'business'),
    ('0f030000-0000-4000-8000-000000000007', '778899', 'BANK_ACCOUNT', tenant, tenant, 'business'),
    ('0f030000-0000-4000-8000-000000000008', '445566', 'BANK_ACCOUNT', tenant, tenant, 'business'),
    ('0f030000-0000-4000-8000-000000000009', '112233', 'BANK_ACCOUNT', tenant, tenant, 'business'),
    ('0f030000-0000-4000-8000-000000000010', '5326-2222', 'CREDIT_CARD', NULL, tenant, 'business'),
    ('0f030000-0000-4000-8000-000000000011', '445567', 'BANK_ACCOUNT', NULL, tenant, 'business'),
    ('0f030000-0000-4000-8000-000000000012', '778800', 'CREDIT_CARD', tenant, tenant, 'business')
  ON CONFLICT DO NOTHING;

  -- Cal
  INSERT INTO accounter_schema.cal_creditcard_transactions
    (id, card, trn_int_id, trn_numaretor, merchant_name, trn_purchase_date, trn_amt, trn_currency_symbol,
     trn_type, trn_type_code, deb_crd_date, amt_before_conv_and_index, deb_crd_currency_symbol, merchant_id)
  VALUES
    ('0f030000-0000-4000-8000-000000000101', 4580, 'F030-CAL-1', 1, 'Coffee Bar', '03/11/2026', 42.50, 'ILS',
     'regular', '5', '10/11/2026', 42.50, 'ILS', 'M-77')
  ON CONFLICT DO NOTHING;

  -- Bank Discount
  INSERT INTO accounter_schema.bank_discount_transactions
    (id, operation_date, value_date, operation_code, operation_description, operation_branch, operation_bank,
     account_number, operation_amount, balance_after_operation, operation_number, urn, is_last_seen)
  VALUES
    ('0f030000-0000-4000-8000-000000000102', '02/11/2026', '02/11/2026', '175', 'Transfer out', 12, 11,
     '0301234567', 150.00, 5000.00, 4455, 'F030-URN-1', true)
  ON CONFLICT DO NOTHING;

  -- Max
  INSERT INTO accounter_schema.max_creditcard_transactions
    (id, actual_payment_amount, arn, card_index, category_id, comments, deal_data_acq, deal_data_adjustment_type,
     deal_data_amount, deal_data_amount_ils, deal_data_amount_left, deal_data_arn, deal_data_authorization_number,
     deal_data_commission_vat, deal_data_exchange_direct, deal_data_exchange_rate, deal_data_interest_amount,
     deal_data_is_allowed_spread_with_benefit, deal_data_issuer_currency, deal_data_plan, deal_data_pos_entry_emv,
     deal_data_processing_date, deal_data_purchase_time, deal_data_ref_nbr, deal_data_show_cancel_debit,
     deal_data_show_spread, deal_data_show_spread_benefit_button, deal_data_show_spread_button,
     deal_data_show_spread_for_leumi, deal_data_tdm_card_token, deal_data_tdm_transaction_type,
     deal_data_transaction_type, deal_data_txn_code, deal_data_user_name, ethoca_ind, is_register_ch,
     is_spreading_autorization_allowed, issuer_id, merchant_max_phone, merchant, merchant_number, merchant_phone,
     merchant_tax_id, merchant_name, original_amount, original_currency, payment_date, plan_name, plan_type_id,
     promotion_club, purchase_date, ref_index, runtime_reference_internal_id, runtime_reference_type,
     short_card_number, spread_transaction_by_campain_ind, table_type, uid, user_index)
  VALUES
    ('0f030000-0000-4000-8000-000000000103', 99.90, 'ARN-F030-1', 0, 3, 'groceries', 'ACQ', 0,
     99.90, 99.90, 0, 'ARN-F030-1', 'AUTH-1',
     0, 'D', 1.00, 0,
     B'0', 'ILS', 5, 0,
     '2026-11-01', '13:45:10', 'REF-1', B'0',
     B'0', B'0', B'0',
     B'0', 'TOK', 0,
     1, 2, 'user', B'0', B'0',
     B'1', 1, B'0', 'SHUFERSAL', 'M-100', '03-5555555',
     '512345678', 'Shufersal', 99.90, 'ILS', '2026-11-10', 'regular', 1,
     'none', '2026-11-01', 7, 'RT-1', 1,
     '9876', B'0', 1, 'F030-MAX-1', 1)
  ON CONFLICT DO NOTHING;

  -- Isracard (domestic) and Amex (abroad)
  INSERT INTO accounter_schema.isracard_creditcard_transactions
    (id, card, card_index, supplier_id, supplier_name, full_purchase_date, voucher_number, currency_id,
     current_payment_currency, full_payment_date, deal_sum, payment_sum, full_supplier_name_heb, is_horaat_keva,
     table_page_num, is_error, is_captcha, is_button, more_info)
  VALUES
    ('0f030000-0000-4000-8000-000000000104', 1234, 0, 9001, 'SUPER', '05/11/2026', 555001, 'ש"ח',
     'ILS', '10/12/2026', '120.00', 120.00, 'SUPER YODA', 'false',
     B'0', 'false', 'false', 'false', NULL)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.amex_creditcard_transactions
    (id, card, card_index, supplier_id, supplier_name_outbound, full_supplier_name_outbound, city,
     full_purchase_date_outbound, voucher_number, voucher_number_ratz_outbound, currency_id,
     current_payment_currency, full_payment_date, deal_sum_outbound, payment_sum_outbound, is_horaat_keva,
     table_page_num, is_error, is_captcha, is_button)
  VALUES
    ('0f030000-0000-4000-8000-000000000105', 5678, 1, 0, 'AMAZON', 'AMAZON MKTPL', 'SEATTLE',
     '06/11/2026', 777002, 777, 'USD',
     'USD', '10/12/2026', 33.25, 33.25, 'false',
     B'0', 'false', 'false', 'false')
  ON CONFLICT DO NOTHING;

  -- Otsar Hahayal
  INSERT INTO accounter_schema.otsar_hahayal_ils_account_transactions
    (id, owner_id, account_number, account_type, branch_number, action_code, bfb_source, closing_balance,
     correspondent_account, correspondent_account_type, correspondent_bank, correspondent_branch, credit_amount,
     customer_name, date_of_business_day, date_of_registration, debit_amount, depositor_id, description,
     drill_down_url, drill_down_data, first_transaction_of_day, last_transaction_of_day, name, opening_balance,
     operation_source, reference, salary_ind, transaction_source, transaction_reason, origin_reference)
  VALUES
    ('0f030000-0000-4000-8000-000000000106', tenant, 445566, 1, 12, 5, 'BFB', 1000.00,
     0, 0, 0, 0, 0,
     ' Acme ', '2026-11-04T00:00:00Z', '2026-11-04T00:00:00Z', 250.00, 0, 'עמלת מסלול חודשית',
     '', '{"a": 1}', true, false, 'Acme Ltd', 1250.00,
     'online', 123, 0, 'web', '', '')
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.otsar_hahayal_foreign_account_transactions
    (id, owner_id, account, branch, account_type, currency, opening_balance, balance, value_date, credit, debit,
     description, sp, reference, date, sub_transactions)
  VALUES
    ('0f030000-0000-4000-8000-000000000107', tenant, 778899, 12, 'USD-ACC', 'USD', 100.00, 90.00, '2026-11-05', 0,
     10.00, 'עמלה בגין העברה', NULL, 'REF-1', '2026-11-05', '[]')
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.otsar_hahayal_creditcard_transactions
    (id, owner_id, resource_id, masked_pan, card_type, billing_period, date, charge_date, name, deal_amount,
     charge_amount, notes, wallet_type, charge_currency, deal_currency, counter)
  VALUES
    ('0f030000-0000-4000-8000-000000000108', tenant, '0f030000-0000-4000-8000-000000000201', '5326-1111', 1,
     '2026-11', '2026-11-03', '2026-11-10', 'דמי כרטיס', 15.00, 15.00, '', 0, 'שקל חדש', 'ILS', 0)
  ON CONFLICT DO NOTHING;

  -- Poalim foreign: a USD conversion leg (reference 555) and a USD transfer a SWIFT fee matches
  INSERT INTO accounter_schema.poalim_foreign_account_transactions
    (id, executing_date, formatted_executing_date, value_date, formatted_value_date, original_system_id,
     activity_description, event_amount, currency, current_balance, reference_catenated_number, reference_number,
     currency_rate, event_details, rate_fixing_code, contra_currency_code, event_activity_type_code,
     transaction_type, rate_fixing_short_description, currency_long_description, activity_type_code,
     event_number, validity_date, comment_existence_switch, account_name, contra_bank_number,
     contra_branch_number, contra_account_number, original_event_key, data_group_code, currency_swift_code,
     bank_number, branch_number, account_number)
  VALUES
    ('0f030000-0000-4000-8000-000000000109', '2026-11-02', '2026-11-02T00:00:00', '2026-11-02',
     '2026-11-02T00:00:00', 100, 'Conversion', 1000.00, 'USD', 21000.00, 0, 555,
     3.7000000, NULL, 0, 1, 1,
     'REGULAR', 'none', 'US Dollar', 884,
     1, '2026-11-02', B'0', 'Demo Ltd', 0,
     0, 0, B'0', B'0', 'USD',
     12, 12, 112233),
    ('0f030000-0000-4000-8000-000000000110', '2026-11-07', '2026-11-07T00:00:00', '2026-11-07',
     '2026-11-07T00:00:00', 100, 'Transfer', -5000.00, 'USD', 16000.00, 0, 777,
     0, 'GLOBEX CORP', 0, 1, 2,
     'REGULAR', 'none', 'US Dollar', 650,
     2, '2026-11-07', B'0', 'Demo Ltd', 99,
     800, 445566, B'0', B'0', 'USD',
     12, 12, 112233)
  ON CONFLICT DO NOTHING;

  -- Poalim ILS: a card payment
  INSERT INTO accounter_schema.poalim_ils_account_transactions
    (id, event_date, formatted_event_date, serial_number, activity_type_code, activity_description, text_code,
     reference_number, reference_catenated_number, value_date, formatted_value_date, event_amount,
     event_activity_type_code, current_balance, internal_link_code, original_event_create_date, transaction_type,
     data_group_code, expanded_event_date, executing_branch_number, event_id, different_date_indication,
     table_number, record_number, contra_bank_number, contra_branch_number, contra_account_number,
     contra_account_type_code, marketing_offer_context, comment_existence_switch, field_desc_display_switch,
     english_action_desc, beneficiary_details_data_party_name, bank_number, branch_number, account_number)
  VALUES
    ('0f030000-0000-4000-8000-000000000111', '2026-11-03', '2026-11-03T00:00:00', 1, 473, 'Card payment', 378,
     9001, 0, '2026-11-03', '2026-11-03T00:00:00', 80.00,
     2, 9920.00, 0, 20261103, 'REGULAR',
     0, 20261103, 12, 9001001, '0',
     1, 1, 12, 600, 0,
     0, B'0', B'0', B'0',
     'Card fee', NULL, 12, 12, 112233)
  ON CONFLICT DO NOTHING;

  -- Poalim SWIFT
  INSERT INTO accounter_schema.poalim_swift_account_transactions
    (id, account_number, branch_number, bank_number, start_date, formatted_start_date, swift_status_code,
     swift_status_desc, amount, currency_code_catenated_key, currency_long_description, charge_party_name,
     reference_number, transfer_catenated_id, data_origin_code, document_type_code,
     swift_value_date_currency_amount_32a, swift_currency_instructed_amount_33b, swift_exchange_rate_36,
     swift_remittance_information_70)
  VALUES
    ('0f030000-0000-4000-8000-000000000112', 112233, 12, 12, '20261107', '2026-11-07T00:00:00', '1',
     'done', '-5000', '19', 'US Dollar', 'GLOBEX CORP INTERNATIONAL',
     'SW-1', 'F030-SWIFT-1', '1', 1,
     '261107USD4985,00', 'USD5000,00', ' ',
     'Invoice 42')
  ON CONFLICT DO NOTHING;

  -- Poalim securities, security transactions, deposit tax events
  INSERT INTO accounter_schema.poalim_securities
    (id, owner_id, bank_number, branch_number, account_number, as_of_date, security_key, eng_name, heb_name,
     item_type, is_etf, is_foreign, currency_code, exchange, equity_type, equity_sub_type, symbol)
  VALUES
    ('0f030000-0000-4000-8000-000000000113', tenant, 12, 12, 112233, '2026-11-01T00:00:00Z', 'SEC-1', 'ACME INC',
     'אקמי', 'STOCK', false, true, 'USD', 'NASDAQ', 1, 2, 'ACME')
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.poalim_securities_transactions
    (id, owner_id, bank_number, branch_number, account_number, security, trade_date, value_date, trade_type,
     transaction_type, nv, trade_price, net_value_trade_currency, eng_name, trade_currency, occurrence)
  VALUES
    ('0f030000-0000-4000-8000-000000000114', tenant, 12, 12, 112233, 'SEC-1', '2026-11-03', '2026-11-05', 'BUY',
     'TRADE', 10, 100.50, 1005.00, 'ACME INC', 'USD', 1)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.poalim_deposit_tax_events
    (id, owner_id, bank_number, branch_number, account_number, event_serial_number, executing_date,
     formatted_executing_date, action_type_description, short_product_name, tax_event_amount, debit_amount,
     crdit_amount, additional_information_existence_switch)
  VALUES
    ('0f030000-0000-4000-8000-000000000115', tenant, 12, 12, 112233, 1, '2026-11-04', '2026-11-04T00:00:00Z',
     'Interest tax', 'Deposit', 12.34, 12.34, 0, 0)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.exchange_rates (exchange_date, usd, eur, gbp, cad, jpy, aud, sek)
  SELECT '2026-11-01', 3.700, 4.0100, 4.6500, 2.6500, 0.024500, 2.4000, 0.3500
  WHERE NOT EXISTS (SELECT 1 FROM accounter_schema.exchange_rates WHERE exchange_date = '2026-11-01');
END $$;
