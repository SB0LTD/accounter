--
-- PostgreSQL database dump
--

\restrict iLCfRlEh1C5LHWd7Q5UuxqBh4GYXJyd5VOBdCqkojzdprZehXwvmuvUMP6M9dTL

-- Dumped from database version 18.7 (Ubuntu 18.7-1.pgdg24.04+5)
-- Dumped by pg_dump version 18.7 (Ubuntu 18.7-1.pgdg24.04+5)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: accounter_schema; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA accounter_schema;


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: accountant_status; Type: TYPE; Schema: accounter_schema; Owner: -
--

CREATE TYPE accounter_schema.accountant_status AS ENUM (
    'UNAPPROVED',
    'APPROVED',
    'PENDING'
);


--
-- Name: business_trip_transaction_type; Type: TYPE; Schema: accounter_schema; Owner: -
--

CREATE TYPE accounter_schema.business_trip_transaction_type AS ENUM (
    'FLIGHT',
    'ACCOMMODATION',
    'TRAVEL_AND_SUBSISTENCE',
    'OTHER',
    'CAR_RENTAL'
);


--
-- Name: charge_type; Type: TYPE; Schema: accounter_schema; Owner: -
--

CREATE TYPE accounter_schema.charge_type AS ENUM (
    'CONVERSION',
    'PAYROLL',
    'FINANCIAL',
    'BANK_DEPOSIT',
    'BUSINESS_TRIP',
    'COMMON',
    'CREDITCARD_BANK',
    'DIVIDEND',
    'FOREIGN_SECURITIES',
    'INTERNAL',
    'VAT'
);


--
-- Name: currency; Type: TYPE; Schema: accounter_schema; Owner: -
--

CREATE TYPE accounter_schema.currency AS ENUM (
    'ILS',
    'USD',
    'EUR',
    'GBP',
    'USDC',
    'GRT',
    'ETH',
    'JPY',
    'AUD',
    'SEK',
    'CAD'
);


--
-- Name: depreciation_disposal_type; Type: TYPE; Schema: accounter_schema; Owner: -
--

CREATE TYPE accounter_schema.depreciation_disposal_type AS ENUM (
    'SALE',
    'COST_REFUND',
    'WRITE_OFF'
);


--
-- Name: depreciation_refund_mode; Type: TYPE; Schema: accounter_schema; Owner: -
--

CREATE TYPE accounter_schema.depreciation_refund_mode AS ENUM (
    'FROM_ACTIVATION',
    'FROM_REFUND_DATE'
);


--
-- Name: depreciation_types; Type: TYPE; Schema: accounter_schema; Owner: -
--

CREATE TYPE accounter_schema.depreciation_types AS ENUM (
    'MARKETING',
    'RESEARCH_AND_DEVELOPMENT',
    'GENERAL_AND_MANAGEMENT'
);


--
-- Name: document_status; Type: TYPE; Schema: accounter_schema; Owner: -
--

CREATE TYPE accounter_schema.document_status AS ENUM (
    'OPEN',
    'CLOSED',
    'MANUALLY_CLOSED',
    'CANCELLED',
    'CANCELLED_BY_OTHER_DOC'
);


--
-- Name: document_type; Type: TYPE; Schema: accounter_schema; Owner: -
--

CREATE TYPE accounter_schema.document_type AS ENUM (
    'INVOICE',
    'RECEIPT',
    'INVOICE_RECEIPT',
    'PROFORMA',
    'UNPROCESSED',
    'CREDIT_INVOICE',
    'OTHER'
);


--
-- Name: financial_account_type; Type: TYPE; Schema: accounter_schema; Owner: -
--

CREATE TYPE accounter_schema.financial_account_type AS ENUM (
    'BANK_ACCOUNT',
    'CREDIT_CARD',
    'CRYPTO_WALLET',
    'FOREIGN_SECURITIES',
    'BANK_DEPOSIT_ACCOUNT'
);


--
-- Name: flight_class; Type: TYPE; Schema: accounter_schema; Owner: -
--

CREATE TYPE accounter_schema.flight_class AS ENUM (
    'ECONOMY',
    'PREMIUM_ECONOMY',
    'BUSINESS',
    'FIRST_CLASS'
);


--
-- Name: grant_type_enum; Type: TYPE; Schema: accounter_schema; Owner: -
--

CREATE TYPE accounter_schema.grant_type_enum AS ENUM (
    'grant',
    'revoke'
);


--
-- Name: pcn874_record_type; Type: TYPE; Schema: accounter_schema; Owner: -
--

CREATE TYPE accounter_schema.pcn874_record_type AS ENUM (
    'S1',
    'S2',
    'L1',
    'L2',
    'M',
    'Y',
    'I',
    'T',
    'K',
    'R',
    'P',
    'H',
    'C'
);


--
-- Name: provider_key; Type: TYPE; Schema: accounter_schema; Owner: -
--

CREATE TYPE accounter_schema.provider_key AS ENUM (
    'green_invoice',
    'deel'
);


--
-- Name: security_identifier_type; Type: TYPE; Schema: accounter_schema; Owner: -
--

CREATE TYPE accounter_schema.security_identifier_type AS ENUM (
    'POALIM_SECURITY_KEY',
    'ISIN'
);


--
-- Name: tags_enum; Type: TYPE; Schema: accounter_schema; Owner: -
--

CREATE TYPE accounter_schema.tags_enum AS ENUM (
    'business',
    'Business Trip',
    'conversion',
    'creditcard',
    'financial',
    'investments',
    'mistake',
    'salary',
    'transportation'
);


--
-- Name: get_current_auth_type(); Type: FUNCTION; Schema: accounter_schema; Owner: -
--

CREATE FUNCTION accounter_schema.get_current_auth_type() RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
    DECLARE
      v_auth_type TEXT;
    BEGIN
      v_auth_type := NULLIF(current_setting('app.auth_type', true), '');
      RETURN v_auth_type;
    END;
    $$;


--
-- Name: get_current_business_id(); Type: FUNCTION; Schema: accounter_schema; Owner: -
--

CREATE FUNCTION accounter_schema.get_current_business_id() RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
    DECLARE
      v_business_id UUID;
    BEGIN
      -- STABLE: result won't change within transaction
      -- SECURITY DEFINER: runs with creator privileges to read session variables
      -- Handle both NULL and empty string cases
      v_business_id := NULLIF(current_setting('app.current_business_id', true), '')::uuid;
      
      IF v_business_id IS NULL THEN
        RAISE EXCEPTION 'No business context set - authentication required';
      END IF;
      
      RETURN v_business_id;
    END;
    $$;


--
-- Name: get_current_business_scope(); Type: FUNCTION; Schema: accounter_schema; Owner: -
--

CREATE FUNCTION accounter_schema.get_current_business_scope() RETURNS uuid[]
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
      DECLARE
        v_scope_text TEXT;
      BEGIN
        -- Read scope is serialized as a Postgres array literal, e.g. '{uuid1,uuid2}'.
        v_scope_text := NULLIF(current_setting('app.current_business_scope', true), '');

        -- Fallback to the single business context while the scope is not yet set,
        -- preserving pre-multi-business read behavior.
        IF v_scope_text IS NULL THEN
          RETURN ARRAY[accounter_schema.get_current_business_id()];
        END IF;

        RETURN v_scope_text::uuid[];
      END;
      $$;


--
-- Name: get_current_user_id(); Type: FUNCTION; Schema: accounter_schema; Owner: -
--

CREATE FUNCTION accounter_schema.get_current_user_id() RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
    DECLARE
      v_user_id UUID;
    BEGIN
      v_user_id := NULLIF(current_setting('app.current_user_id', true), '')::uuid;
      RETURN v_user_id;
    END;
    $$;


--
-- Name: insert_amex_transaction_handler(); Type: FUNCTION; Schema: accounter_schema; Owner: -
--

CREATE FUNCTION accounter_schema.insert_amex_transaction_handler() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
    merged_id      UUID;
    account_id_var UUID;
    owner_id_var   UUID;
    charge_id_var  UUID = NULL;
BEGIN
    -- filter summarize records
    IF (
           NEW.full_supplier_name_outbound NOT IN ('TOTAL FOR DATE', 'CASH ADVANCE FEE')
               OR NEW.full_supplier_name_outbound IS NULL
           ) AND (
           (NEW.supplier_name NOT IN ('סך חיוב בש"ח:', 'סך חיוב  ב-$:')
               AND NOT (NEW.supplier_name IN ('דמי כרטיס הנחה', 'פועלים- דמי כרט') AND NEW.payment_sum = 0.00))
               OR NEW.supplier_name IS NULL
           )
    THEN
        -- Create merged raw transactions record:
        INSERT INTO accounter_schema.transactions_raw_list (amex_id)
        VALUES (NEW.id)
        RETURNING id INTO merged_id;

        -- get account and owner IDs
        SELECT INTO account_id_var, owner_id_var id,
                                                 owner
        FROM accounter_schema.financial_accounts
        WHERE account_number = NEW.card::TEXT;

        -- check if matching charge exists:
        -- TBD

        -- create new charge
        IF (charge_id_var IS NULL) THEN
            INSERT INTO accounter_schema.charges (owner_id)
            VALUES (owner_id_var)
            RETURNING id INTO charge_id_var;
        END IF;

        -- check if new record is fee
        -- TBD

        -- check if new record contains fees
        -- TBD

        -- create new transaction
        INSERT INTO accounter_schema.transactions (owner_id, account_id, charge_id, source_id, source_description, currency,
                                                   event_date, debit_date, amount, current_balance, source_reference,
                                                   source_origin, counter_account, origin_key)
        VALUES (owner_id_var,
                account_id_var,
                charge_id_var,
                merged_id,
                CASE
                    WHEN NEW.full_supplier_name_outbound IS NULL THEN NEW.full_supplier_name_heb
                    WHEN NEW.full_supplier_name_heb IS NULL THEN (
                        COALESCE(NEW.full_supplier_name_outbound, '') ||
                        COALESCE('/' || NEW.city, '')
                        )
                    END,
                CAST(
                        (
                            CASE
                                WHEN NEW.currency_id = 'ש"ח' THEN 'ILS'
                                WHEN NEW.currency_id = 'NIS' THEN 'ILS'
                                WHEN NEW.currency_id = 'דולר' THEN 'USD'
                                WHEN NEW.currency_id = 'USD' THEN 'USD'
                                WHEN NEW.currency_id = 'EUR' THEN 'EUR'
                                WHEN NEW.currency_id = 'GBP' THEN 'GBP'
                                -- use ILS as default:
                                ELSE 'ILS' END
                            ) as accounter_schema.currency
                ),
                CASE
                    WHEN NEW.full_purchase_date IS NULL THEN to_date(NEW.full_purchase_date_outbound, 'DD/MM/YYYY')
                    WHEN NEW.full_purchase_date_outbound IS NULL THEN to_date(NEW.full_purchase_date, 'DD/MM/YYYY')
                    END,
                to_date(COALESCE(NEW.full_payment_date, NEW.charging_date), 'DD/MM/YYYY'),
                CASE
                    WHEN NEW.payment_sum IS NULL THEN (NEW.payment_sum_outbound * -1)
                    WHEN NEW.payment_sum_outbound IS NULL THEN (NEW.payment_sum * -1)
                    END,
                0,
                COALESCE(NEW.voucher_number::text,
                         NEW.voucher_number_ratz::text),
                'AMEX',
                CASE
                    WHEN NEW.supplier_id IS NOT NULL AND
                         NEW.supplier_id <> 0
                        THEN NEW.supplier_id::text::character varying
                    ELSE NEW.full_supplier_name_outbound
                    END,
                NEW.id::text);
    END IF;

    RETURN NEW;
END;
$_$;


--
-- Name: insert_bank_discount_transaction_handler(); Type: FUNCTION; Schema: accounter_schema; Owner: -
--

CREATE FUNCTION accounter_schema.insert_bank_discount_transaction_handler() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    merged_id      UUID;
    account_id_var UUID;
    owner_id_var   UUID;
    charge_id_var  UUID = NULL;
BEGIN
    -- Create merged raw transactions record:
    INSERT INTO accounter_schema.transactions_raw_list (bank_discount_id)
    VALUES (NEW.id)
    RETURNING id INTO merged_id;
    -- get account and owner IDs
    SELECT INTO account_id_var, owner_id_var id,
                                             owner
    FROM accounter_schema.financial_accounts
    WHERE account_number = NEW.account_number;
    -- check if matching charge exists:
    -- TBD
    -- create new charge
    IF (charge_id_var IS NULL) THEN
        INSERT INTO accounter_schema.charges (owner_id)
        VALUES (owner_id_var)
        RETURNING id INTO charge_id_var;
    END IF;
    -- check if new record is fee
    -- TBD
    -- check if new record contains fees
    -- TBD
    -- create new transaction
    INSERT INTO accounter_schema.transactions (owner_id,
                                               account_id,
                                               charge_id,
                                               source_id,
                                               source_description,
                                               currency,
                                               event_date,
                                               debit_date,
                                               amount,
                                               current_balance,
                                               source_reference,
                                               source_origin,
                                               counter_account,
                                               origin_key)
    VALUES (owner_id_var,
            account_id_var,
            charge_id_var,
            merged_id,
            NEW.operation_description,
            'ILS'::accounter_schema.currency,
            to_date(NEW.operation_date, 'DD/MM/YYYY'),
            to_date(NEW.value_date, 'DD/MM/YYYY'),
            NEW.operation_amount * -1,
            NEW.balance_after_operation,
            NEW.urn,
            'BANK_DISCOUNT',
            CASE
                WHEN NEW.operation_number IS NOT NULL AND
                     NEW.operation_number <> 0 THEN concat(
                        NEW.operation_bank, '-',
                        NEW.operation_branch, '-',
                        NEW.operation_number)
                ELSE NULL::text
                END,
            NEW.id);
    RETURN NEW;
END;
$$;


--
-- Name: insert_cal_creditcard_transaction_handler(); Type: FUNCTION; Schema: accounter_schema; Owner: -
--

CREATE FUNCTION accounter_schema.insert_cal_creditcard_transaction_handler() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    merged_id      UUID;
    account_id_var UUID;
    owner_id_var   UUID;
    charge_id_var  UUID = NULL;
BEGIN
    -- Create merged raw transactions record:
    INSERT INTO accounter_schema.transactions_raw_list (cal_id)
    VALUES (NEW.id)
    RETURNING id INTO merged_id;

    -- get account and owner IDs
    SELECT INTO account_id_var, owner_id_var id,
                                             owner
    FROM accounter_schema.financial_accounts
    WHERE account_number = NEW.card::TEXT;

    -- check if matching charge exists:
    -- TBD

    -- create new charge
    IF (charge_id_var IS NULL) THEN
        INSERT INTO accounter_schema.charges (owner_id)
        VALUES (owner_id_var)
        RETURNING id INTO charge_id_var;
    END IF;

    -- check if new record is fee
    -- TBD

    -- check if new record contains fees
    -- TBD

    -- create new transaction
    INSERT INTO accounter_schema.transactions (owner_id,
                                               account_id,
                                               charge_id,
                                               source_id,
                                               source_description,
                                               currency,
                                               event_date,
                                               debit_date,
                                               amount,
                                               current_balance,
                                               source_reference,
                                               source_origin,
                                               counter_account,
                                               origin_key)
    VALUES (owner_id_var,
            account_id_var,
            charge_id_var,
            merged_id,
            NEW.merchant_name,
            CAST(NEW.trn_currency_symbol as accounter_schema.currency),
            to_date(NEW.trn_purchase_date, 'DD/MM/YYYY'),
            to_date(NEW.deb_crd_date, 'DD/MM/YYYY'),
            NEW.trn_amt * -1,
            0,
            NEW.trn_int_id,
            'CAL',
            COALESCE(NEW.merchant_id,
                     NEW.merchant_name),
            NEW.id);

    RETURN NEW;
END;
$$;


--
-- Name: insert_creditcard_transaction_handler(); Type: FUNCTION; Schema: accounter_schema; Owner: -
--

CREATE FUNCTION accounter_schema.insert_creditcard_transaction_handler() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
    merged_id      UUID;
    account_id_var UUID;
    owner_id_var   UUID;
    charge_id_var  UUID = NULL;
BEGIN
    -- filter summarize records
    IF (
           NEW.full_supplier_name_outbound NOT IN ('TOTAL FOR DATE', 'CASH ADVANCE FEE')
               OR NEW.full_supplier_name_outbound IS NULL
           ) AND (
           (NEW.supplier_name NOT IN ('סך חיוב בש"ח:', 'סך חיוב  ב-$:')
               AND NOT (NEW.supplier_name IN ('דמי כרטיס הנחה', 'פועלים- דמי כרט') AND NEW.payment_sum = 0.00))
               OR NEW.supplier_name IS NULL
           )
    THEN
        -- Create merged raw transactions record:
        INSERT INTO accounter_schema.transactions_raw_list (creditcard_id)
        VALUES (NEW.id)
        RETURNING id INTO merged_id;

        -- get account and owner IDs
        SELECT INTO account_id_var, owner_id_var id,
                                                 owner
        FROM accounter_schema.financial_accounts
        WHERE account_number = NEW.card::TEXT;

        -- check if matching charge exists:
        -- TBD

        -- create new charge
        IF (charge_id_var IS NULL) THEN
            INSERT INTO accounter_schema.charges (owner_id)
            VALUES (owner_id_var)
            RETURNING id INTO charge_id_var;
        END IF;

        -- check if new record is fee
        -- TBD

        -- check if new record contains fees
        -- TBD

        -- create new transaction
        INSERT INTO accounter_schema.transactions (owner_id, account_id, charge_id, source_id, source_description, currency,
                                                   event_date, debit_date, amount, current_balance, source_reference,
                                                   source_origin, counter_account, origin_key)
        VALUES (owner_id_var,
                account_id_var,
                charge_id_var,
                merged_id,
                CASE
                    WHEN NEW.full_supplier_name_outbound IS NULL THEN NEW.full_supplier_name_heb
                    WHEN NEW.full_supplier_name_heb IS NULL THEN (
                        COALESCE(NEW.full_supplier_name_outbound, '') ||
                        COALESCE('/' || NEW.city, '')
                        )
                    END,
                CAST(
                        (
                            CASE
                                WHEN NEW.currency_id = 'ש"ח' THEN 'ILS'
                                WHEN NEW.currency_id = 'NIS' THEN 'ILS'
                                WHEN NEW.currency_id = 'דולר' THEN 'USD'
                                WHEN NEW.currency_id = 'USD' THEN 'USD'
                                WHEN NEW.currency_id = 'EUR' THEN 'EUR'
                                WHEN NEW.currency_id = 'GBP' THEN 'GBP'
                                -- use ILS as default:
                                ELSE 'ILS' END
                            ) as accounter_schema.currency
                ),
                CASE
                    WHEN NEW.full_purchase_date IS NULL THEN to_date(NEW.full_purchase_date_outbound, 'DD/MM/YYYY')
                    WHEN NEW.full_purchase_date_outbound IS NULL THEN to_date(NEW.full_purchase_date, 'DD/MM/YYYY')
                    END,
                to_date(COALESCE(NEW.full_payment_date, NEW.charging_date), 'DD/MM/YYYY'),
                CASE
                    WHEN NEW.payment_sum IS NULL THEN (NEW.payment_sum_outbound * -1)
                    WHEN NEW.payment_sum_outbound IS NULL THEN (NEW.payment_sum * -1)
                    END,
                0,
                COALESCE(NEW.voucher_number::text,
                         NEW.voucher_number_ratz::text),
                'ISRACARD',
                CASE
                    WHEN NEW.supplier_id IS NOT NULL AND
                         NEW.supplier_id <> 0
                        THEN NEW.supplier_id::text::character varying
                    ELSE NEW.full_supplier_name_outbound
                    END,
                NEW.id::text);
    END IF;

    RETURN NEW;
END;
$_$;


--
-- Name: insert_max_creditcard_transaction_handler(); Type: FUNCTION; Schema: accounter_schema; Owner: -
--

CREATE FUNCTION accounter_schema.insert_max_creditcard_transaction_handler() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    merged_id      UUID;
    account_id_var UUID;
    owner_id_var   UUID;
    charge_id_var  UUID = NULL;
BEGIN
    -- filter summarize records
    -- Create merged raw transactions record:
    INSERT INTO accounter_schema.transactions_raw_list (max_creditcard_id)
    VALUES (NEW.id)
    RETURNING id INTO merged_id;

    -- get account and owner IDs
    SELECT id, owner
    INTO account_id_var, owner_id_var
    FROM accounter_schema.financial_accounts
    WHERE account_number = NEW.short_card_number;

    IF account_id_var IS NULL THEN
        RAISE EXCEPTION 'No matching account found for card number: %', NEW.short_card_number;
    END IF;

    -- check if matching charge exists:
    -- TBD

    -- create new charge
    IF (charge_id_var IS NULL) THEN
        INSERT INTO accounter_schema.charges (owner_id)
        VALUES (owner_id_var)
        RETURNING id INTO charge_id_var;
    END IF;

    -- check if new record is fee
    -- TBD

    -- check if new record contains fees
    -- TBD

    IF NOT (NEW.original_currency = 'ILS') THEN
        RAISE EXCEPTION 'Unknown currency: %', NEW.original_currency;
    END IF;

    IF (NEW.actual_payment_amount IS NULL) THEN
        RAISE EXCEPTION 'Transaction amount cannot be null';
    END IF;

    -- create new transaction
    INSERT INTO accounter_schema.transactions (owner_id, account_id, charge_id, source_id, source_description, currency,
                                               event_date, debit_date, amount, current_balance, source_reference,
                                               currency_rate, debit_timestamp, source_origin, counter_account,
                                               origin_key)
    VALUES (owner_id_var,
            account_id_var,
            charge_id_var,
            merged_id,
            CONCAT_WS(' | ', NEW.merchant_name, NEW.comments),
            CAST(
                    (
                        CASE
                            WHEN NEW.original_currency = 'ILS' THEN 'ILS'
                            -- use ILS as default:
                            ELSE 'ILS' END
                        ) as accounter_schema.currency
            ),
            NEW.purchase_date,
            NEW.payment_date,
            NEW.actual_payment_amount * -1,
            0,
            NEW.arn,
            NEW.deal_data_exchange_rate,
            NEW.payment_date +
            NEW.deal_data_purchase_time,
            'MAX',
            CASE
                WHEN NEW.merchant_tax_id::text <> ''::text
                    THEN NEW.merchant_tax_id::text
                ELSE NEW.merchant_name
                END, NEW.id);

    RETURN NEW;
END ;
$$;


--
-- Name: insert_otsar_hahayal_creditcard_transaction_handler(); Type: FUNCTION; Schema: accounter_schema; Owner: -
--

CREATE FUNCTION accounter_schema.insert_otsar_hahayal_creditcard_transaction_handler() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
        merged_id      UUID;
        account_id_var UUID;
        owner_id_var   UUID;
        charge_id_var  UUID;
        currency_var   accounter_schema.currency;
        is_fee_var     BOOLEAN;
    BEGIN
        -- 1. raw list record
        INSERT INTO accounter_schema.transactions_raw_list (otsar_hahayal_creditcard_id)
        VALUES (NEW.id)
        RETURNING id INTO merged_id;

        -- 2. account + owner (credit card account keyed by resource_id)
        SELECT id, owner
        INTO account_id_var, owner_id_var
        FROM accounter_schema.financial_accounts
        WHERE account_number = NEW.masked_pan::TEXT AND type = 'CREDIT_CARD';

        IF account_id_var IS NULL OR owner_id_var IS NULL THEN
            RAISE EXCEPTION 'Credit card account not found or has no owner for masked PAN: %', NEW.masked_pan;
        END IF;

        -- 3. resolve currency
        currency_var := CASE NEW.charge_currency
          WHEN 'שקל חדש'    THEN 'ILS'::accounter_schema.currency
          WHEN 'דולר ארה"ב' THEN 'USD'::accounter_schema.currency
          WHEN 'אירו'        THEN 'EUR'::accounter_schema.currency
          ELSE NULL
        END;
        IF currency_var IS NULL THEN
          RAISE EXCEPTION 'Unknown charge_currency: %', NEW.charge_currency;
        END IF;

        -- 4. check if fee
        is_fee_var := (NEW.name LIKE '%דמי כרטיס%');

        -- 5. charge
        INSERT INTO accounter_schema.charges (owner_id)
        VALUES (owner_id_var)
        RETURNING id INTO charge_id_var;

        -- 6. transaction
        INSERT INTO accounter_schema.transactions (
            owner_id,
            account_id,
            charge_id,
            source_id,
            source_description,
            currency,
            event_date,
            debit_date,
            amount,
            current_balance,
            source_reference,
            source_origin,
            counter_account,
            is_fee,
            origin_key
        ) VALUES (
            owner_id_var,
            account_id_var,
            charge_id_var,
            merged_id,
            NULLIF(TRIM(CONCAT_WS(' ',
                NULLIF(TRIM(NEW.name), ''),
                NULLIF(TRIM(NEW.notes), '')
            )), ''),
            currency_var,
            NEW.date,
            NEW.charge_date,
            NEW.charge_amount * -1,
            0,
            NEW.resource_id::TEXT,
            'OTSAR_HAHAYAL_CREDIT_CARD',
            NULL,
            is_fee_var,
            NEW.id
        );

        RETURN NEW;
    END;
    $$;


--
-- Name: insert_otsar_hahayal_foreign_transaction_handler(); Type: FUNCTION; Schema: accounter_schema; Owner: -
--

CREATE FUNCTION accounter_schema.insert_otsar_hahayal_foreign_transaction_handler() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
        merged_id      UUID;
        account_id_var UUID;
        owner_id_var   UUID;
        charge_id_var  UUID;
        is_fee_var     BOOLEAN;
    BEGIN
        -- 1. raw list record
        INSERT INTO accounter_schema.transactions_raw_list (otsar_hahayal_foreign_id)
        VALUES (NEW.id)
        RETURNING id INTO merged_id;

        -- 2. account + owner
        SELECT id, owner
        INTO account_id_var, owner_id_var
        FROM accounter_schema.financial_accounts
        WHERE account_number = NEW.account::TEXT AND type = 'BANK_ACCOUNT';

        IF account_id_var IS NULL OR owner_id_var IS NULL THEN
            RAISE EXCEPTION 'Financial account not found or has no owner for account number: %', NEW.account_number;
        END IF;

        -- 3. check if fee
        is_fee_var := (
            NEW.description LIKE '%עמלה בגין%'
            OR NEW.description LIKE '%עמלת העברות%'
            OR NEW.description LIKE '%עמלות מכותבים%'
            OR NEW.description LIKE '%החזר תשלום עמלות%'
        );

        -- 4. charge
        INSERT INTO accounter_schema.charges (owner_id)
        VALUES (owner_id_var)
        RETURNING id INTO charge_id_var;

        -- 5. transaction
        INSERT INTO accounter_schema.transactions (
            owner_id,
            account_id,
            charge_id,
            source_id,
            source_description,
            currency,
            event_date,
            debit_date,
            amount,
            current_balance,
            source_reference,
            source_origin,
            counter_account,
            is_fee,
            origin_key
        ) VALUES (
            owner_id_var,
            account_id_var,
            charge_id_var,
            merged_id,
            NULLIF(TRIM(NEW.description), ''),
            NEW.currency::accounter_schema.currency,
            NEW.value_date,
            NEW.date,
            CASE
                WHEN NEW.debit <> 0 THEN NEW.debit * -1
                ELSE NEW.credit
            END,
            COALESCE(NEW.balance, 0),
            NEW.reference,
            'OTSAR_HAHAYAL',
            NULL,
            is_fee_var,
            NEW.id
        );

        RETURN NEW;
    END;
    $$;


--
-- Name: insert_otsar_hahayal_ils_transaction_handler(); Type: FUNCTION; Schema: accounter_schema; Owner: -
--

CREATE FUNCTION accounter_schema.insert_otsar_hahayal_ils_transaction_handler() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
        merged_id      UUID;
        account_id_var UUID;
        owner_id_var   UUID;
        charge_id_var  UUID;
        is_fee_var     BOOLEAN;
    BEGIN
        -- 1. raw list record
        INSERT INTO accounter_schema.transactions_raw_list (otsar_hahayal_ils_id)
        VALUES (NEW.id)
        RETURNING id INTO merged_id;

        -- 2. account + owner
        SELECT id, owner
        INTO account_id_var, owner_id_var
        FROM accounter_schema.financial_accounts
        WHERE account_number = NEW.account_number::TEXT AND type = 'BANK_ACCOUNT';

        IF account_id_var IS NULL OR owner_id_var IS NULL THEN
            RAISE EXCEPTION 'Financial account not found or has no owner for account number: %', NEW.account_number;
        END IF;

        -- 3. check if fee
        is_fee_var := (
            NEW.description LIKE '%עמלת מסלול%'
            OR NEW.description LIKE '%עמלת מטח%'
            OR NEW.description LIKE '%עמלת בנקאות ישירה%'
        );

        -- 4. charge
        INSERT INTO accounter_schema.charges (owner_id)
        VALUES (owner_id_var)
        RETURNING id INTO charge_id_var;

        -- 5. transaction
        INSERT INTO accounter_schema.transactions (
            owner_id,
            account_id,
            charge_id,
            source_id,
            source_description,
            currency,
            event_date,
            debit_date,
            amount,
            current_balance,
            source_reference,
            source_origin,
            counter_account,
            is_fee,
            origin_key
        ) VALUES (
            owner_id_var,
            account_id_var,
            charge_id_var,
            merged_id,
            NULLIF(TRIM(CONCAT_WS(' ',
                NULLIF(TRIM(NEW.name), ''),
                NULLIF(TRIM(NEW.customer_name), ''),
                NULLIF(TRIM(NEW.description), ''),
                NULLIF(TRIM(NEW.transaction_reason), '')
            )), ''),
            'ILS'::accounter_schema.currency,
            NEW.date_of_registration::DATE,
            NEW.date_of_business_day::DATE,
            CASE
                WHEN NEW.debit_amount <> 0 THEN NEW.debit_amount * -1
                ELSE NEW.credit_amount
            END,
            NEW.closing_balance,
            NEW.reference::TEXT,
            'OTSAR_HAHAYAL',
            CASE
                WHEN NEW.correspondent_account <> 0 THEN CONCAT(
                    NEW.correspondent_bank, '-',
                    NEW.correspondent_branch, '-',
                    NEW.correspondent_account,
                    ' (', NEW.correspondent_account_type, ')'
                )
                ELSE NULL
            END,
            is_fee_var,
            NEW.id
        );

        RETURN NEW;
    END;
    $$;


--
-- Name: insert_poalim_cad_transaction_handler(); Type: FUNCTION; Schema: accounter_schema; Owner: -
--

CREATE FUNCTION accounter_schema.insert_poalim_cad_transaction_handler() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    merged_id          UUID;
    account_id_var     UUID;
    owner_id_var       UUID;
    charge_id_var      UUID    = NULL;
    is_conversion      BOOLEAN = false;
    is_fee             BOOLEAN = false;
    transaction_id_var UUID    = NULL;
BEGIN
    -- Create merged raw transactions record:
    INSERT INTO accounter_schema.transactions_raw_list (poalim_cad_id)
    VALUES (NEW.id)
    RETURNING id INTO merged_id;

    -- get account and owner IDs
    SELECT INTO account_id_var, owner_id_var id,
                                             owner
    FROM accounter_schema.financial_accounts
    WHERE account_number = NEW.account_number::TEXT;

    -- handle conversions
    IF (new.activity_type_code IN (884, 957, 1058)) THEN
        is_conversion = true;

        -- check if matching charge exists:
        SELECT t.charge_id
        INTO charge_id_var
        FROM (SELECT 'eur', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_eur_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'gbp', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_gbp_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'ils', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_ils_account_transactions
              WHERE text_code IN (22, 23)) AS s
                 LEFT JOIN accounter_schema.transactions_raw_list tr
                           ON COALESCE(tr.poalim_ils_id, tr.poalim_eur_id, tr.poalim_gbp_id, tr.poalim_usd_id,
                                       tr.poalim_cad_id) = s.id
                 LEFT JOIN accounter_schema.transactions t
                           ON tr.id = t.source_id
        WHERE t.charge_id IS NOT NULL
          AND s.reference_number = NEW.reference_number
          AND s.reference_catenated_number = NEW.reference_catenated_number
          AND s.value_date = NEW.value_date;
    END IF;

    -- handle bank deposits
    IF (new.activity_type_code IN (1376, 1384, 169, 171, 172)) THEN
        -- check if matching charge exists:
        SELECT t.charge_id
        INTO charge_id_var
        FROM (SELECT 'eur', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_eur_account_transactions
              WHERE activity_type_code IN (1376, 1384)
              UNION
              SELECT 'gbp', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_gbp_account_transactions
              WHERE activity_type_code IN (1376, 1384)
              UNION
              SELECT 'ils', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_ils_account_transactions
              WHERE text_code IN (113, 117, 457)) AS s
                 LEFT JOIN accounter_schema.transactions_raw_list tr
                           ON COALESCE(tr.poalim_ils_id, tr.poalim_eur_id, tr.poalim_gbp_id, tr.poalim_usd_id,
                                       tr.poalim_cad_id) = s.id
                 LEFT JOIN accounter_schema.transactions t
                           ON tr.id = t.source_id
        WHERE t.charge_id IS NOT NULL
          AND s.reference_number = NEW.reference_number
          AND s.reference_catenated_number = NEW.reference_catenated_number
          AND s.value_date = NEW.value_date;
    END IF;

    -- if no match, create new charge
    IF (charge_id_var IS NULL) THEN
        INSERT INTO accounter_schema.charges (owner_id, type)
        VALUES (owner_id_var,
                CASE WHEN is_conversion IS TRUE THEN 'CONVERSION'::accounter_schema.charge_type END)
        RETURNING id INTO charge_id_var;
    END IF;

    -- check if new record is fee
    IF (new.activity_type_code = 1279 AND new.event_amount BETWEEN 0 AND 30)
    THEN
        is_fee = true;
    END IF;

    -- check if new record contains fees
    -- TBD

    -- create new transaction
    INSERT INTO accounter_schema.transactions (account_id, charge_id, source_id, source_description, currency,
                                               event_date, debit_date, amount, current_balance, is_fee,
                                               source_reference, source_origin, currency_rate, counter_account,
                                               origin_key)
    VALUES (account_id_var,
            charge_id_var,
            merged_id,
            concat(
                    new.activity_description,
                    ' ',
                    coalesce(new.event_details, ''),
                    ' ',
                    coalesce(new.account_name, '')
            ),
            'CAD',
            new.executing_date::text::date,
            new.value_date::text::date,
            (CASE
                 WHEN new.event_activity_type_code = 2 THEN (new.event_amount * -1)
                 ELSE new.event_amount END
                ),
            new.current_balance,
            is_fee,
            new.reference_number::text,
            'POALIM',
            NEW.currency_rate,
            CASE
                WHEN new.contra_account_number <> 0 THEN concat(
                        new.contra_bank_number, '-',
                        new.contra_branch_number, '-',
                        new.contra_account_number)
                ELSE NULL::text
                END, NEW.id)
    RETURNING id INTO transaction_id_var;

    RETURN NEW;
END;
$$;


--
-- Name: insert_poalim_deposit_transaction_handler(); Type: FUNCTION; Schema: accounter_schema; Owner: -
--

CREATE FUNCTION accounter_schema.insert_poalim_deposit_transaction_handler() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    merged_id          UUID;
    account_id_var     UUID;
    owner_id_var       UUID;
    charge_id_var      UUID = NULL;
    transaction_id_var UUID = NULL;
BEGIN
    -- Create merged raw transactions record:
    INSERT INTO accounter_schema.transactions_raw_list (poalim_deposit_id)
    VALUES (NEW.id)
    RETURNING id INTO merged_id;

    -- get account and owner IDs
    SELECT INTO account_id_var, owner_id_var id,
                                             owner
    FROM accounter_schema.financial_accounts
    WHERE account_number = CONCAT('poalim_deposit_', NEW.deposit_key::TEXT);

    -- create new charge
    INSERT INTO accounter_schema.charges (owner_id, type)
    VALUES (owner_id_var, 'BANK_DEPOSIT'::accounter_schema.charge_type)
    RETURNING id INTO charge_id_var;

    -- create new transaction
    INSERT INTO accounter_schema.transactions (owner_id, account_id, charge_id, source_id, currency,
                                               event_date, debit_date, amount, current_balance, source_reference,
                                               source_origin, origin_key)
    VALUES (owner_id_var,
            account_id_var,
            charge_id_var,
            merged_id,
            new.currency,
            new.date::text::date,
            new.date::text::date,
            new.amount, 0,
            NEW.deposit_key,
            'POALIM', NEW.id)
    RETURNING id INTO transaction_id_var;

    RETURN NEW;
END;
$$;


--
-- Name: insert_poalim_eur_transaction_handler(); Type: FUNCTION; Schema: accounter_schema; Owner: -
--

CREATE FUNCTION accounter_schema.insert_poalim_eur_transaction_handler() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    merged_id          UUID;
    account_id_var     UUID;
    owner_id_var       UUID;
    charge_id_var      UUID    = NULL;
    is_conversion      BOOLEAN = false;
    is_fee             BOOLEAN = false;
    transaction_id_var UUID    = NULL;
BEGIN
    -- Create merged raw transactions record:
    INSERT INTO accounter_schema.transactions_raw_list (poalim_eur_id)
    VALUES (NEW.id)
    RETURNING id INTO merged_id;

    -- get account and owner IDs
    SELECT INTO account_id_var, owner_id_var id,
                                             owner
    FROM accounter_schema.financial_accounts
    WHERE account_number = NEW.account_number::TEXT;

    -- handle conversions
    IF (new.activity_type_code in (884, 957, 1058)) THEN
        is_conversion = true;

        -- check if matching charge exists:
        SELECT t.charge_id
        INTO charge_id_var
        FROM (SELECT 'usd' AS currency, id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_usd_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'gbp', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_gbp_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'cad', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_cad_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'ils', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_ils_account_transactions
              WHERE text_code IN (22, 23)) AS s
                 LEFT JOIN accounter_schema.transactions_raw_list tr
                           ON COALESCE(tr.poalim_ils_id, tr.poalim_eur_id, tr.poalim_gbp_id, tr.poalim_usd_id,
                                       tr.poalim_cad_id) = s.id
                 LEFT JOIN accounter_schema.transactions t
                           ON tr.id = t.source_id
        WHERE t.charge_id IS NOT NULL
          AND s.reference_number = NEW.reference_number
          AND s.reference_catenated_number = NEW.reference_catenated_number
          AND s.value_date = NEW.value_date;
    END IF;

    -- if no match, create new charge
    IF (charge_id_var IS NULL) THEN
        INSERT INTO accounter_schema.charges (owner_id, type)
        VALUES (owner_id_var,
                CASE WHEN is_conversion IS TRUE THEN 'CONVERSION'::accounter_schema.charge_type END)
        RETURNING id INTO charge_id_var;
    END IF;

    -- check if new record is fee
    IF (new.activity_type_code = 1279 AND new.event_amount BETWEEN 0 AND 30)
    THEN
        is_fee = true;
    END IF;

    -- check if new record contains fees
    -- TBD

    -- create new transaction
    INSERT INTO accounter_schema.transactions (account_id, charge_id, source_id, source_description, currency,
                                               event_date, debit_date, amount, current_balance, is_fee,
                                               source_reference, source_origin, currency_rate, counter_account,
                                               origin_key)
    VALUES (account_id_var,
            charge_id_var,
            merged_id,
            concat(
                    new.activity_description,
                    ' ',
                    coalesce(new.event_details, ''),
                    ' ',
                    coalesce(new.account_name, '')
            ),
            'EUR',
            new.executing_date::text::date,
            new.value_date::text::date,
            (CASE
                 WHEN new.event_activity_type_code = 2 THEN (new.event_amount * -1)
                 ELSE new.event_amount END
                ),
            new.current_balance,
            is_fee,
            new.reference_number::text,
            'POALIM',
            NEW.currency_rate,
            CASE
                WHEN new.contra_account_number <> 0 THEN concat(
                        new.contra_bank_number, '-',
                        new.contra_branch_number, '-',
                        new.contra_account_number)
                ELSE NULL::text
                END, NEW.id)
    RETURNING id INTO transaction_id_var;

    RETURN NEW;
END;
$$;


--
-- Name: insert_poalim_foreign_transaction_handler(); Type: FUNCTION; Schema: accounter_schema; Owner: -
--

CREATE FUNCTION accounter_schema.insert_poalim_foreign_transaction_handler() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    merged_id          UUID;
    account_id_var     UUID;
    owner_id_var       UUID;
    charge_id_var      UUID    = NULL;
    is_conversion      BOOLEAN = false;
    is_fee             BOOLEAN = false;
BEGIN
    -- Create merged raw transactions record:
    INSERT INTO accounter_schema.transactions_raw_list (poalim_foreign_id)
    VALUES (NEW.id)
    RETURNING id INTO merged_id;

    -- get account and owner IDs
    SELECT INTO account_id_var, owner_id_var id,
                                             owner
    FROM accounter_schema.financial_accounts
    WHERE account_number = NEW.account_number::TEXT;

    -- handle conversions
    IF (new.activity_type_code in (884, 957, 1058, 1966)) THEN
        is_conversion = true;

        -- check if matching charge exists:
        SELECT t.charge_id
        INTO charge_id_var
        FROM (SELECT currency, id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_foreign_account_transactions
              WHERE activity_type_code IN (884, 957, 1058, 1966)
              UNION ALL
              SELECT 'ILS', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_ils_account_transactions
              WHERE text_code IN (22, 23, 861, 863)) AS s
                 LEFT JOIN accounter_schema.transactions_raw_list tr
                           ON COALESCE(tr.poalim_ils_id, tr.poalim_foreign_id) = s.id
                 LEFT JOIN accounter_schema.transactions t
                           ON tr.id = t.source_id
        WHERE t.charge_id IS NOT NULL
          AND t.owner_id = owner_id_var
          AND s.reference_number = NEW.reference_number
          AND s.reference_catenated_number = NEW.reference_catenated_number
          AND s.value_date = NEW.value_date;
    END IF;

    -- if no match, create new charge
    IF (charge_id_var IS NULL) THEN
        INSERT INTO accounter_schema.charges (owner_id, type)
        VALUES (owner_id_var,
                CASE WHEN is_conversion IS TRUE THEN 'CONVERSION'::accounter_schema.charge_type END)
        RETURNING id INTO charge_id_var;
    END IF;

    -- check if new record is fee
    IF ((new.activity_type_code = 1279 AND new.event_amount BETWEEN 0 AND 30)
        OR (new.activity_type_code = 884 AND new.original_system_id = 390))
    THEN
        is_fee = true;
    END IF;

    -- create new transaction
    INSERT INTO accounter_schema.transactions (account_id, charge_id, source_id, source_description, currency,
                                               event_date, debit_date, amount, current_balance, is_fee,
                                               source_reference, source_origin, currency_rate, counter_account,
                                               origin_key, owner_id)
    VALUES (account_id_var,
            charge_id_var,
            merged_id,
            concat_ws(' ',
                    new.activity_description,
                    new.event_details,
                    new.account_name
            ),
            new.currency,
            new.executing_date::text::date,
            new.value_date::text::date,
            (CASE
                 WHEN new.event_activity_type_code = 2 THEN (new.event_amount * -1)
                 ELSE new.event_amount END
                ),
            new.current_balance,
            is_fee,
            new.reference_number::text,
            'POALIM',
            NEW.currency_rate,
            CASE
                WHEN new.contra_account_number <> 0 THEN concat(
                        new.contra_bank_number, '-',
                        new.contra_branch_number, '-',
                        new.contra_account_number)
                ELSE NULL::text
                END, NEW.id, owner_id_var);

    RETURN NEW;
END;
$$;


--
-- Name: insert_poalim_gbp_transaction_handler(); Type: FUNCTION; Schema: accounter_schema; Owner: -
--

CREATE FUNCTION accounter_schema.insert_poalim_gbp_transaction_handler() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    merged_id          UUID;
    account_id_var     UUID;
    owner_id_var       UUID;
    charge_id_var      UUID    = NULL;
    is_conversion      BOOLEAN = false;
    is_fee             BOOLEAN = false;
    transaction_id_var UUID    = NULL;
BEGIN
    -- Create merged raw transactions record:
    INSERT INTO accounter_schema.transactions_raw_list (poalim_gbp_id)
    VALUES (NEW.id)
    RETURNING id INTO merged_id;

    -- get account and owner IDs
    SELECT INTO account_id_var, owner_id_var id,
                                             owner
    FROM accounter_schema.financial_accounts
    WHERE account_number = NEW.account_number::TEXT;

    -- handle conversions
    IF (new.activity_type_code IN (884, 957, 1058)) THEN
        is_conversion = true;

        -- check if matching charge exists:
        SELECT t.charge_id
        INTO charge_id_var
        FROM (SELECT 'usd' AS currency, id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_usd_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'eur', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_eur_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'cad', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_cad_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'ils', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_ils_account_transactions
              WHERE text_code IN (22, 23)) AS s
                 LEFT JOIN accounter_schema.transactions_raw_list tr
                           ON COALESCE(tr.poalim_ils_id, tr.poalim_eur_id, tr.poalim_gbp_id, tr.poalim_cad_id,
                                       tr.poalim_usd_id) = s.id
                 LEFT JOIN accounter_schema.transactions t
                           ON tr.id = t.source_id
        WHERE t.charge_id IS NOT NULL
          AND s.reference_number = NEW.reference_number
          AND s.reference_catenated_number = NEW.reference_catenated_number
          AND s.value_date = NEW.value_date;
    END IF;

    -- if no match, create new charge
    IF (charge_id_var IS NULL) THEN
        INSERT INTO accounter_schema.charges (owner_id, type)
        VALUES (owner_id_var,
                CASE WHEN is_conversion IS TRUE THEN 'CONVERSION'::accounter_schema.charge_type END)
        RETURNING id INTO charge_id_var;
    END IF;

    -- check if new record is fee
    IF (new.activity_type_code = 1279 AND new.event_amount BETWEEN 0 AND 30)
    THEN
        is_fee = true;
    END IF;

    -- check if new record contains fees
    -- TBD

    -- create new transaction
    INSERT INTO accounter_schema.transactions (account_id, charge_id, source_id, source_description, currency,
                                               event_date, debit_date, amount, current_balance, is_fee,
                                               source_reference, source_origin, currency_rate, counter_account,
                                               origin_key)
    VALUES (account_id_var,
            charge_id_var,
            merged_id,
            concat(
                    new.activity_description,
                    ' ',
                    coalesce(new.event_details, ''),
                    ' ',
                    coalesce(new.account_name, '')
            ),
            'GBP',
            new.executing_date::text::date,
            new.value_date::text::date,
            (CASE
                 WHEN new.event_activity_type_code = 2 THEN (new.event_amount * -1)
                 ELSE new.event_amount END
                ),
            new.current_balance,
            is_fee,
            new.reference_number::text,
            'POALIM',
            NEW.currency_rate,
            CASE
                WHEN new.contra_account_number <> 0 THEN concat(
                        new.contra_bank_number, '-',
                        new.contra_branch_number, '-',
                        new.contra_account_number)
                ELSE NULL::text
                END, NEW.id)
    RETURNING id INTO transaction_id_var;

    RETURN NEW;
END;
$$;


--
-- Name: insert_poalim_ils_transaction_handler(); Type: FUNCTION; Schema: accounter_schema; Owner: -
--

CREATE FUNCTION accounter_schema.insert_poalim_ils_transaction_handler() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    merged_id          UUID;
    account_id_var     UUID;
    owner_id_var       UUID;
    charge_id_var      UUID    = NULL;
    is_conversion      BOOLEAN = false;
    is_fee             BOOLEAN = false;
BEGIN
    -- Create merged raw transactions record:
    INSERT INTO accounter_schema.transactions_raw_list (poalim_ils_id)
    VALUES (NEW.id)
    RETURNING id INTO merged_id;

    -- get account and owner IDs
    SELECT INTO account_id_var, owner_id_var id,
                                             owner
    FROM accounter_schema.financial_accounts
    WHERE account_number = NEW.account_number::TEXT;

    -- handle conversions
    IF (NEW.text_code IN (22, 23, 861, 863)) THEN
        is_conversion = true;

        -- check if matching charge exists:
        SELECT t.charge_id
        INTO charge_id_var
        FROM (SELECT currency, id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_foreign_account_transactions
              WHERE activity_type_code IN (884, 957, 1058, 1966)) AS s
                 LEFT JOIN accounter_schema.transactions_raw_list tr
                           ON COALESCE(tr.poalim_ils_id, tr.poalim_foreign_id) = s.id
                 LEFT JOIN accounter_schema.transactions t
                           ON tr.id = t.source_id
        WHERE t.charge_id IS NOT NULL
          AND t.owner_id = owner_id_var
          AND s.reference_number = NEW.reference_number
          AND s.reference_catenated_number = NEW.reference_catenated_number
          AND s.value_date = NEW.value_date;
    END IF;

    -- if no match, create new charge
    IF (charge_id_var IS NULL) THEN
        INSERT INTO accounter_schema.charges (owner_id, type)
        VALUES (owner_id_var,
                CASE WHEN is_conversion IS TRUE THEN 'CONVERSION'::accounter_schema.charge_type END)
        RETURNING id INTO charge_id_var;
    END IF;

    -- check if new record is fee
    IF (
        (new.activity_type_code = 452 AND new.text_code IN (105, 547))
            OR (new.activity_type_code = 473 AND new.text_code IN (378, 395, 437, 502, 602, 603, 716, 771, 774))
            OR (new.activity_type_code = 471 AND new.text_code IN (615, 617))
        ) THEN
        is_fee = true;
    END IF;

    -- create new transaction
    INSERT INTO accounter_schema.transactions (account_id, charge_id, source_id, source_description, currency,
                                               event_date, debit_date, amount, current_balance, source_reference,
                                               source_origin, counter_account, is_fee, origin_key, owner_id)
    VALUES (account_id_var,
            charge_id_var,
            merged_id,
            concat_ws(' ',
                    new.activity_description,
                    new.beneficiary_details_data_party_name,
                    new.beneficiary_details_data_message_detail,
                    new.english_action_desc
            ),
            'ILS',
            new.event_date::text::date,
            new.event_date::text::date,
            (CASE
                 WHEN new.event_activity_type_code = 2 THEN (new.event_amount * -1)
                 ELSE new.event_amount END
                ),
            new.current_balance,
            new.reference_number::text,
            'POALIM',
            CASE
                WHEN new.contra_account_number <> 0 THEN concat(
                        new.contra_bank_number, '-',
                        new.contra_branch_number, '-',
                        new.contra_account_number)
                ELSE NULL::text
                END,
            is_fee,
            NEW.id,
            owner_id_var);

    RETURN NEW;
END;
$$;


--
-- Name: insert_poalim_swift_transaction_handler(); Type: FUNCTION; Schema: accounter_schema; Owner: -
--

CREATE FUNCTION accounter_schema.insert_poalim_swift_transaction_handler() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    merged_id                UUID;
    account_id_var           UUID;
    owner_id_var             UUID;
    charge_id_var            UUID = NULL;
    instructed_amount        NUMERIC;
    value_date_amount        NUMERIC;
    transaction_amount       NUMERIC;
    fee_amount               NUMERIC;
    currency_code            accounter_schema.currency;
    instructed_currency_code accounter_schema.currency;
    value_date_currency_code accounter_schema.currency;
    exchange_rate            NUMERIC;
    transaction_id_var       UUID = NULL;
BEGIN

    -- extract amount
    BEGIN
        instructed_amount := CASE
                                 WHEN NEW.swift_currency_instructed_amount_33b <> ' ' THEN REPLACE(
                                         RIGHT(NEW.swift_currency_instructed_amount_33b,
                                               LENGTH(NEW.swift_currency_instructed_amount_33b) - 3), ',',
                                         '.')::NUMERIC END;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Invalid instructed amount for SWIFT. got: [%]; error: %', NEW.swift_currency_instructed_amount_33b, SQLERRM;
    END;

    BEGIN
        value_date_amount := CASE
                                 WHEN NEW.swift_value_date_currency_amount_32a <> ' ' THEN REPLACE(
                                         RIGHT(NEW.swift_value_date_currency_amount_32a,
                                               LENGTH(NEW.swift_value_date_currency_amount_32a) - 9), ',',
                                         '.')::NUMERIC END;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Invalid value date amount for SWIFT. got: [%]; error: %', NEW.swift_value_date_currency_amount_32a, SQLERRM;
    END;

    transaction_amount := COALESCE(instructed_amount, value_date_amount);

    -- extract currency
    BEGIN
        instructed_currency_code := CASE
                                        WHEN NEW.swift_currency_instructed_amount_33b <> ' '
                                            THEN LEFT(NEW.swift_currency_instructed_amount_33b, 3)::accounter_schema.currency
            END;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Invalid instructed currency for SWIFT transaction. got: [%]; error: %', NEW.swift_currency_instructed_amount_33b, SQLERRM;
    END;

    BEGIN
        value_date_currency_code := CASE
                                        WHEN NEW.swift_value_date_currency_amount_32a <> ' '
                                            THEN RIGHT(LEFT(NEW.swift_value_date_currency_amount_32a,
                                                            9), 3)::accounter_schema.currency END;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Invalid value date currency for SWIFT transaction. got: [%]; error: %', NEW.swift_value_date_currency_amount_32a, SQLERRM;
    END;

    currency_code := COALESCE(instructed_currency_code, value_date_currency_code);

    --     handle multiple currencies
    BEGIN
        exchange_rate := CASE
                             WHEN NEW.swift_exchange_rate_36 <> ' '
                                 THEN REPLACE(NEW.swift_exchange_rate_36, ',', '.')::NUMERIC END;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Invalid exchange rate format in SWIFT fields. Got this: [%]; Error: %', NEW.swift_exchange_rate_36, SQLERRM;
    END;

    -- handle multiple currencies
    IF (instructed_amount IS NOT NULL AND value_date_currency_code <> instructed_currency_code) THEN
        IF (exchange_rate IS NULL) THEN
            RAISE EXCEPTION 'Invalid SWIFT transaction: multiple currencies without exchange rate. instructed amount: [%]; value date amount: [%]; exchange rate: [%]; Error: %', NEW.swift_currency_instructed_amount_33b, NEW.swift_value_date_currency_amount_32a, NEW.swift_exchange_rate_36, SQLERRM;
        END IF;
        transaction_amount := ROUND(instructed_amount * exchange_rate, 2);
    END IF;

    fee_amount := transaction_amount - value_date_amount;

    IF (fee_amount >= 0) THEN
        -- Create merged raw transactions record:
        INSERT INTO accounter_schema.transactions_raw_list (poalim_swift_id)
        VALUES (NEW.id)
        RETURNING id INTO merged_id;

        -- get account and owner IDs
        SELECT INTO account_id_var, owner_id_var id,
                                                 owner
        FROM accounter_schema.financial_accounts
        WHERE account_number = NEW.account_number::TEXT;

        IF (account_id_var IS NULL) THEN
            RAISE EXCEPTION 'Account not found for account number: %', NEW.account_number;
        END IF;

        -- check if matching charge exists for source:
        SELECT t.charge_id
        INTO charge_id_var
        FROM (SELECT formatted_value_date, event_details, id, currency, event_amount
              FROM accounter_schema.poalim_foreign_account_transactions) AS s
                 LEFT JOIN accounter_schema.transactions_raw_list tr
                           ON COALESCE(tr.poalim_ils_id, tr.poalim_foreign_id) = s.id
                 LEFT JOIN accounter_schema.transactions t
                           ON tr.id = t.source_id
        WHERE t.charge_id IS NOT NULL
          AND s.formatted_value_date = NEW.formatted_start_date
          AND currency_code = s.currency
          AND ((s.event_details LIKE '%' || TRIM(LEFT(NEW.charge_party_name, 13)) || '%'
            AND NEW.amount::NUMERIC = s.event_amount)
            OR (transaction_amount * -1 = s.event_amount));

        -- if no match, create new charge
        IF (charge_id_var IS NULL) THEN
            INSERT INTO accounter_schema.charges (owner_id)
            VALUES (owner_id_var)
            RETURNING id INTO charge_id_var;
        END IF;

        -- create new transaction for fee
        INSERT INTO accounter_schema.transactions (owner_id, account_id, charge_id, source_id, source_description, currency,
                                                   event_date, debit_date, amount, current_balance, business_id, is_fee,
                                                   source_reference, counter_account, source_origin, origin_key)
        VALUES (owner_id_var,
                account_id_var,
                charge_id_var,
                merged_id,
                CONCAT_WS(' ',
                          'Swift Fee:',
                          NEW.charge_party_name,
                          NEW.reference_number,
                          NEW.swift_remittance_information_70
                ),
                currency_code,
                NEW.formatted_start_date::DATE,
                NEW.formatted_start_date::DATE,
                fee_amount * -1,
                0,
                NULL,
                TRUE,
                NEW.reference_number,
                'SWIFT',
                'POALIM',
                NEW.id)
        RETURNING id INTO transaction_id_var;
    END IF;
    RETURN NEW;
END
$$;


--
-- Name: insert_poalim_usd_transaction_handler(); Type: FUNCTION; Schema: accounter_schema; Owner: -
--

CREATE FUNCTION accounter_schema.insert_poalim_usd_transaction_handler() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    merged_id          UUID;
    account_id_var     UUID;
    owner_id_var       UUID;
    charge_id_var      UUID    = NULL;
    is_conversion      BOOLEAN = false;
    is_fee             BOOLEAN = false;
    transaction_id_var UUID    = NULL;
BEGIN
    -- Create merged raw transactions record:
    INSERT INTO accounter_schema.transactions_raw_list (poalim_usd_id)
    VALUES (NEW.id)
    RETURNING id INTO merged_id;

    -- get account and owner IDs
    SELECT INTO account_id_var, owner_id_var id,
                                             owner
    FROM accounter_schema.financial_accounts
    WHERE account_number = NEW.account_number::TEXT;

    -- handle conversions
    IF (new.activity_type_code IN (884, 957, 1058)) THEN
        is_conversion = true;

        -- check if matching charge exists:
        SELECT t.charge_id
        INTO charge_id_var
        FROM (SELECT 'eur', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_eur_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'gbp', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_gbp_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'cad', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_cad_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'ils', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_ils_account_transactions
              WHERE text_code IN (22, 23)) AS s
                 LEFT JOIN accounter_schema.transactions_raw_list tr
                           ON COALESCE(tr.poalim_ils_id, tr.poalim_eur_id, tr.poalim_gbp_id, tr.poalim_cad_id,
                                       tr.poalim_usd_id) = s.id
                 LEFT JOIN accounter_schema.transactions t
                           ON tr.id = t.source_id
        WHERE t.charge_id IS NOT NULL
          AND s.reference_number = NEW.reference_number
          AND s.reference_catenated_number = NEW.reference_catenated_number
          AND s.value_date = NEW.value_date;
    END IF;

    -- handle bank deposits
    IF (new.activity_type_code IN (1376, 1384, 169, 171, 172)) THEN
        -- check if matching charge exists:
        SELECT t.charge_id
        INTO charge_id_var
        FROM (SELECT 'eur', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_eur_account_transactions
              WHERE activity_type_code IN (1376, 1384)
              UNION
              SELECT 'gbp', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_gbp_account_transactions
              WHERE activity_type_code IN (1376, 1384)
              UNION
              SELECT 'cad', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_cad_account_transactions
              WHERE activity_type_code IN (1376, 1384)
              UNION
              SELECT 'ils', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_ils_account_transactions
              WHERE text_code IN (113, 117, 457)) AS s
                 LEFT JOIN accounter_schema.transactions_raw_list tr
                           ON COALESCE(tr.poalim_ils_id, tr.poalim_eur_id, tr.poalim_gbp_id, tr.poalim_usd_id,
                                       tr.poalim_cad_id) = s.id
                 LEFT JOIN accounter_schema.transactions t
                           ON tr.id = t.source_id
        WHERE t.charge_id IS NOT NULL
          AND s.reference_number = NEW.reference_number
          AND s.reference_catenated_number = NEW.reference_catenated_number
          AND s.value_date = NEW.value_date;
    END IF;

    -- if no match, create new charge
    IF (charge_id_var IS NULL) THEN
        INSERT INTO accounter_schema.charges (owner_id, type)
        VALUES (owner_id_var,
                CASE WHEN is_conversion IS TRUE THEN 'CONVERSION'::accounter_schema.charge_type END)
        RETURNING id INTO charge_id_var;
    END IF;

    -- check if new record is fee
    IF (new.activity_type_code = 1279 AND new.event_amount BETWEEN 0 AND 30)
    THEN
        is_fee = true;
    END IF;

    -- check if new record contains fees
    -- TBD

    -- create new transaction
    INSERT INTO accounter_schema.transactions (account_id, charge_id, source_id, source_description, currency,
                                               event_date, debit_date, amount, current_balance, is_fee,
                                               source_reference, source_origin, currency_rate, counter_account,
                                               origin_key)
    VALUES (account_id_var,
            charge_id_var,
            merged_id,
            concat(
                    new.activity_description,
                    ' ',
                    coalesce(new.event_details, ''),
                    ' ',
                    coalesce(new.account_name, '')
            ),
            'USD',
            new.executing_date::text::date,
            new.value_date::text::date,
            (CASE
                 WHEN new.event_activity_type_code = 2 THEN (new.event_amount * -1)
                 ELSE new.event_amount END
                ),
            new.current_balance,
            is_fee,
            new.reference_number::text,
            'POALIM',
            NEW.currency_rate,
            CASE
                WHEN new.contra_account_number <> 0 THEN concat(
                        new.contra_bank_number, '-',
                        new.contra_branch_number, '-',
                        new.contra_account_number)
                ELSE NULL::text
                END,
            NEW.id)
    RETURNING id INTO transaction_id_var;

    RETURN NEW;
END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: accounter_schema; Owner: -
--

CREATE FUNCTION accounter_schema.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$;


--
-- Name: update_general_updated_at(); Type: FUNCTION; Schema: accounter_schema; Owner: -
--

CREATE FUNCTION accounter_schema.update_general_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
        NEW.updated_at = now();
        RETURN NEW;
    END;
    $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: amex_creditcard_transactions; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.amex_creditcard_transactions (
    specific_date character varying(30),
    card_index integer NOT NULL,
    deals_inbound character varying(3),
    supplier_id integer,
    supplier_name character varying(15),
    deal_sum_type character varying(1),
    payment_sum_sign character varying(1),
    purchase_date character varying(5),
    full_purchase_date text,
    more_info character varying(30),
    horaat_keva character varying(1),
    voucher_number integer,
    voucher_number_ratz integer,
    solek character varying(1),
    purchase_date_outbound character varying(5),
    full_purchase_date_outbound text,
    currency_id character varying(4),
    current_payment_currency character varying(3),
    city character varying(10),
    supplier_name_outbound character varying(15),
    full_supplier_name_outbound character varying(20),
    payment_date character varying(5),
    full_payment_date text,
    is_show_deals_outbound character varying(1),
    adendum character varying(30),
    voucher_number_ratz_outbound integer,
    is_show_link_for_supplier_details character varying(3),
    deal_sum character varying(12),
    payment_sum numeric(8,2),
    full_supplier_name_heb character varying(20),
    deal_sum_outbound numeric(9,2),
    payment_sum_outbound numeric(8,2),
    is_horaat_keva character varying(5) NOT NULL,
    stage character varying(30),
    return_code character varying(30),
    message character varying(30),
    return_message character varying(30),
    display_properties character varying(30),
    table_page_num bit(1) NOT NULL,
    is_error character varying(5) NOT NULL,
    is_captcha character varying(5) NOT NULL,
    is_button character varying(5) NOT NULL,
    site_name character varying(30),
    client_ip_address character varying(30),
    card integer NOT NULL,
    id uuid DEFAULT uuidv7() NOT NULL,
    charging_date text,
    kod_matbea_mekori text,
    esb_services_call text
);


--
-- Name: annual_audit_step_status; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.annual_audit_step_status (
    owner_id uuid NOT NULL,
    year smallint NOT NULL,
    step_id text NOT NULL,
    status text NOT NULL,
    notes text,
    evidence_json jsonb,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT annual_audit_step_status_status_check CHECK ((status = ANY (ARRAY['COMPLETED'::text, 'IN_PROGRESS'::text, 'PENDING'::text, 'BLOCKED'::text])))
);

ALTER TABLE ONLY accounter_schema.annual_audit_step_status FORCE ROW LEVEL SECURITY;


--
-- Name: api_key_permission_overrides; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.api_key_permission_overrides (
    id uuid DEFAULT uuidv7() NOT NULL,
    api_key_id uuid NOT NULL,
    permission_id text NOT NULL,
    grant_type accounter_schema.grant_type_enum NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE api_key_permission_overrides; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON TABLE accounter_schema.api_key_permission_overrides IS 'API-key-specific permission overrides (future use - not initially enforced)';


--
-- Name: COLUMN api_key_permission_overrides.id; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.api_key_permission_overrides.id IS 'Unique override identifier';


--
-- Name: COLUMN api_key_permission_overrides.api_key_id; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.api_key_permission_overrides.api_key_id IS 'API key this override applies to';


--
-- Name: COLUMN api_key_permission_overrides.permission_id; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.api_key_permission_overrides.permission_id IS 'Permission being granted or revoked';


--
-- Name: COLUMN api_key_permission_overrides.grant_type; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.api_key_permission_overrides.grant_type IS 'Whether this is a grant or revoke override';


--
-- Name: api_keys; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.api_keys (
    id uuid DEFAULT uuidv7() NOT NULL,
    business_id uuid NOT NULL,
    role_id text NOT NULL,
    key_hash text NOT NULL,
    name text NOT NULL,
    last_used_at timestamp with time zone,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT api_keys_revoked_at_check CHECK (((revoked_at IS NULL) OR (revoked_at > created_at)))
);


--
-- Name: TABLE api_keys; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON TABLE accounter_schema.api_keys IS 'API keys are independent of Auth0, used for programmatic access (e.g., scraper role)';


--
-- Name: COLUMN api_keys.id; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.api_keys.id IS 'Unique API key identifier';


--
-- Name: COLUMN api_keys.business_id; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.api_keys.business_id IS 'Business this API key belongs to';


--
-- Name: COLUMN api_keys.role_id; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.api_keys.role_id IS 'Role assigned to this API key (e.g., ''scraper'')';


--
-- Name: COLUMN api_keys.key_hash; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.api_keys.key_hash IS 'SHA-256 hash of the API key (never store plaintext keys)';


--
-- Name: COLUMN api_keys.name; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.api_keys.name IS 'Descriptive name for this API key (e.g., ''Production Scraper'')';


--
-- Name: COLUMN api_keys.last_used_at; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.api_keys.last_used_at IS 'Timestamp of last API key usage (updated hourly to prevent write amplification)';


--
-- Name: COLUMN api_keys.revoked_at; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.api_keys.revoked_at IS 'Timestamp when API key was revoked (NULL if active)';


--
-- Name: COLUMN api_keys.created_at; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.api_keys.created_at IS 'Timestamp when API key was created';


--
-- Name: audit_logs; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.audit_logs (
    id uuid DEFAULT uuidv7() NOT NULL,
    business_id uuid,
    user_id uuid,
    auth0_user_id text,
    action text NOT NULL,
    entity text,
    entity_id text,
    details jsonb,
    ip_address inet,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE audit_logs; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON TABLE accounter_schema.audit_logs IS 'Audit trail for critical security and business actions (e.g., login, user creation, sensitive data access)';


--
-- Name: COLUMN audit_logs.id; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.audit_logs.id IS 'Unique audit log entry identifier';


--
-- Name: COLUMN audit_logs.business_id; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.audit_logs.business_id IS 'Business associated with this action (NULL for system-wide actions or failed logins)';


--
-- Name: COLUMN audit_logs.user_id; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.audit_logs.user_id IS 'Local user identifier (from business_users table) who performed the action';


--
-- Name: COLUMN audit_logs.auth0_user_id; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.audit_logs.auth0_user_id IS 'Auth0 user identifier for audit trail (e.g., ''auth0|507f1f77bcf86cd799439011'')';


--
-- Name: COLUMN audit_logs.action; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.audit_logs.action IS 'Action type (e.g., ''USER_LOGIN'', ''INVOICE_UPDATE'', ''PERMISSION_CHANGE'')';


--
-- Name: COLUMN audit_logs.entity; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.audit_logs.entity IS 'Entity type affected by the action (e.g., ''Invoice'', ''User'', ''Document'')';


--
-- Name: COLUMN audit_logs.entity_id; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.audit_logs.entity_id IS 'Identifier of the affected entity';


--
-- Name: COLUMN audit_logs.details; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.audit_logs.details IS 'Additional action metadata (e.g., before/after state, error details)';


--
-- Name: COLUMN audit_logs.ip_address; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.audit_logs.ip_address IS 'IP address of the client that initiated the action';


--
-- Name: COLUMN audit_logs.created_at; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.audit_logs.created_at IS 'Timestamp when the action occurred';


--
-- Name: bank_deposits; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.bank_deposits (
    id uuid DEFAULT uuidv7() NOT NULL,
    name text NOT NULL,
    open_date date,
    close_date date,
    currency accounter_schema.currency,
    owner_id uuid NOT NULL,
    account_id uuid
);

ALTER TABLE ONLY accounter_schema.bank_deposits FORCE ROW LEVEL SECURITY;


--
-- Name: bank_discount_transactions; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.bank_discount_transactions (
    id uuid DEFAULT uuidv7() NOT NULL,
    operation_date character varying(255),
    value_date character varying(255),
    operation_code character varying(255),
    operation_description character varying(255),
    operation_description2 character varying(255),
    operation_description3 character varying(255),
    operation_branch integer,
    operation_bank integer,
    account_number character varying(255),
    channel character varying(255),
    channel_name character varying(255),
    check_number integer,
    institute_code character varying(255),
    operation_amount numeric(15,2),
    balance_after_operation numeric(15,2),
    operation_number integer,
    branch_treasury_number character varying(255),
    urn character varying(255),
    operation_details_service_name character varying(255),
    commission_channel_code character varying(255),
    commission_channel_name character varying(255),
    commission_type_name character varying(255),
    business_day_date character varying(255),
    event_name character varying(255),
    category_code integer,
    category_desc_code integer,
    category_description character varying(255),
    operation_description_to_display character varying(255),
    operation_order integer,
    is_last_seen boolean,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: business_tax_category_match; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.business_tax_category_match (
    business_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    tax_category_id uuid NOT NULL
);

ALTER TABLE ONLY accounter_schema.business_tax_category_match FORCE ROW LEVEL SECURITY;


--
-- Name: business_trip_charges; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.business_trip_charges (
    business_trip_id uuid,
    charge_id uuid NOT NULL,
    owner_id uuid NOT NULL
);

ALTER TABLE ONLY accounter_schema.business_trip_charges FORCE ROW LEVEL SECURITY;


--
-- Name: business_trips; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.business_trips (
    id uuid DEFAULT uuidv7() NOT NULL,
    name text NOT NULL,
    destination text,
    trip_purpose text,
    accountant_status accounter_schema.accountant_status DEFAULT 'UNAPPROVED'::accounter_schema.accountant_status NOT NULL,
    owner_id uuid NOT NULL
);

ALTER TABLE ONLY accounter_schema.business_trips FORCE ROW LEVEL SECURITY;


--
-- Name: business_trips_attendees; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.business_trips_attendees (
    attendee_business_id uuid NOT NULL,
    business_trip_id uuid NOT NULL,
    arrival date,
    departure date,
    owner_id uuid NOT NULL
);

ALTER TABLE ONLY accounter_schema.business_trips_attendees FORCE ROW LEVEL SECURITY;


--
-- Name: business_trips_employee_payments; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.business_trips_employee_payments (
    charge_id uuid NOT NULL,
    date date NOT NULL,
    amount numeric(9,2) NOT NULL,
    currency accounter_schema.currency NOT NULL,
    employee_business_id uuid NOT NULL,
    value_date date,
    id uuid NOT NULL,
    owner_id uuid NOT NULL
);

ALTER TABLE ONLY accounter_schema.business_trips_employee_payments FORCE ROW LEVEL SECURITY;


--
-- Name: business_trips_tax_variables; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.business_trips_tax_variables (
    date date NOT NULL,
    max_accommodation_per_night_first_7_nights numeric CONSTRAINT business_trips_tax_variable_max_accommodation_per_nigh_not_null NOT NULL,
    max_accommodation_per_night_nights_8_to_90 numeric CONSTRAINT business_trips_tax_variabl_max_accommodation_per_nigh_not_null1 NOT NULL,
    max_car_rental_per_day numeric NOT NULL,
    max_tns_with_accommodation numeric CONSTRAINT business_trips_tax_variable_max_tns_with_accommodation_not_null NOT NULL,
    max_tns_without_accommodation numeric CONSTRAINT business_trips_tax_variable_max_tns_without_accommodat_not_null NOT NULL
);


--
-- Name: business_trips_transactions; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.business_trips_transactions (
    id uuid DEFAULT uuidv7() NOT NULL,
    business_trip_id uuid NOT NULL,
    category accounter_schema.business_trip_transaction_type NOT NULL,
    owner_id uuid NOT NULL
);

ALTER TABLE ONLY accounter_schema.business_trips_transactions FORCE ROW LEVEL SECURITY;


--
-- Name: business_trips_transactions_accommodations; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.business_trips_transactions_accommodations (
    id uuid NOT NULL,
    country text,
    nights_count integer,
    attendees_stay jsonb[] DEFAULT ARRAY[]::jsonb[] CONSTRAINT business_trips_transactions_accommodati_attendees_stay_not_null NOT NULL,
    owner_id uuid NOT NULL
);

ALTER TABLE ONLY accounter_schema.business_trips_transactions_accommodations FORCE ROW LEVEL SECURITY;


--
-- Name: business_trips_transactions_car_rental; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.business_trips_transactions_car_rental (
    id uuid NOT NULL,
    days integer DEFAULT 0 NOT NULL,
    is_fuel_expense boolean DEFAULT false NOT NULL,
    owner_id uuid NOT NULL
);

ALTER TABLE ONLY accounter_schema.business_trips_transactions_car_rental FORCE ROW LEVEL SECURITY;


--
-- Name: business_trips_transactions_flights; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.business_trips_transactions_flights (
    id uuid NOT NULL,
    class accounter_schema.flight_class,
    attendees uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
    path text[],
    owner_id uuid NOT NULL
);

ALTER TABLE ONLY accounter_schema.business_trips_transactions_flights FORCE ROW LEVEL SECURITY;


--
-- Name: business_trips_transactions_match; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.business_trips_transactions_match (
    business_trip_transaction_id uuid CONSTRAINT business_trips_transactions_business_trip_transaction__not_null NOT NULL,
    transaction_id uuid NOT NULL,
    amount numeric NOT NULL,
    owner_id uuid NOT NULL
);

ALTER TABLE ONLY accounter_schema.business_trips_transactions_match FORCE ROW LEVEL SECURITY;


--
-- Name: business_trips_transactions_other; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.business_trips_transactions_other (
    id uuid NOT NULL,
    deductible_expense boolean,
    description text,
    owner_id uuid NOT NULL
);

ALTER TABLE ONLY accounter_schema.business_trips_transactions_other FORCE ROW LEVEL SECURITY;


--
-- Name: business_trips_transactions_tns; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.business_trips_transactions_tns (
    id uuid NOT NULL,
    expense_type text,
    owner_id uuid NOT NULL
);

ALTER TABLE ONLY accounter_schema.business_trips_transactions_tns FORCE ROW LEVEL SECURITY;


--
-- Name: business_users; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.business_users (
    user_id uuid DEFAULT uuidv7() NOT NULL,
    auth0_user_id text,
    business_id uuid NOT NULL,
    role_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE business_users; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON TABLE accounter_schema.business_users IS 'Links Auth0 users to businesses with assigned roles (supports M:N relationships)';


--
-- Name: COLUMN business_users.user_id; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.business_users.user_id IS 'Local user identifier, generated when invitation is created';


--
-- Name: COLUMN business_users.auth0_user_id; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.business_users.auth0_user_id IS 'Auth0 user identifier (e.g., ''auth0|507f1f77bcf86cd799439011''), populated after first login';


--
-- Name: COLUMN business_users.business_id; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.business_users.business_id IS 'Business this user belongs to';


--
-- Name: COLUMN business_users.role_id; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.business_users.role_id IS 'Role assigned to this user within this business';


--
-- Name: businesses; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.businesses (
    id uuid DEFAULT uuidv7() NOT NULL,
    vat_number text,
    hebrew_name text,
    address text,
    address_hebrew text,
    email text,
    website text,
    phone_number text,
    country character varying(3) DEFAULT 'ISR'::character varying NOT NULL,
    no_invoices_required boolean DEFAULT false NOT NULL,
    suggestion_data jsonb,
    can_settle_with_receipt boolean DEFAULT false NOT NULL,
    exempt_dealer boolean DEFAULT false NOT NULL,
    optional_vat boolean DEFAULT false NOT NULL,
    pcn874_record_type_override accounter_schema.pcn874_record_type,
    city character varying(50),
    zip_code character varying(15),
    owner_id uuid NOT NULL
);

ALTER TABLE ONLY accounter_schema.businesses FORCE ROW LEVEL SECURITY;


--
-- Name: businesses_admin; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.businesses_admin (
    id uuid NOT NULL,
    tax_siduri_number_2021 text,
    password text,
    username_vat_website text,
    website_login_screenshot text,
    nikuim text,
    pinkas_social_security_2021 text,
    tax_pinkas_number_2020 text,
    wizcloud_token text,
    wizcloud_company_id text,
    advance_tax_rate real,
    tax_nikuim_pinkas_number text,
    vat_report_cadence integer,
    pinkas_social_security_2022 text,
    tax_siduri_number_2022 text,
    registration_date date,
    business_registration_start_date date,
    company_tax_id character varying(9),
    advance_tax_rates jsonb[] DEFAULT '{}'::jsonb[] NOT NULL,
    tax_advances_ids jsonb[] DEFAULT '{}'::jsonb[] NOT NULL,
    social_security_employer_ids jsonb[] DEFAULT '{}'::jsonb[] NOT NULL,
    withholding_tax_annual_ids jsonb[] DEFAULT '{}'::jsonb[] NOT NULL,
    owner_id uuid NOT NULL
);

ALTER TABLE ONLY accounter_schema.businesses_admin FORCE ROW LEVEL SECURITY;


--
-- Name: businesses_securities; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.businesses_securities (
    id uuid NOT NULL,
    owner_id uuid NOT NULL,
    isin text NOT NULL,
    symbol text,
    eng_name text,
    heb_name text,
    exchange text,
    currency_code accounter_schema.currency,
    item_type text,
    stock_type text,
    is_etf boolean,
    is_foreign boolean,
    issuer_country_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY accounter_schema.businesses_securities FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE businesses_securities; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON TABLE accounter_schema.businesses_securities IS 'Marks a business as standing for a single traded security; presence of a row is what makes it one';


--
-- Name: COLUMN businesses_securities.isin; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.businesses_securities.isin IS 'The security''s identity. Sourced from accounter_schema.poalim_securities_transactions.isin';


--
-- Name: COLUMN businesses_securities.currency_code; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.businesses_securities.currency_code IS 'The currency the security trades in, normalized from the source label';


--
-- Name: cal_creditcard_transactions; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.cal_creditcard_transactions (
    id uuid DEFAULT uuidv7() NOT NULL,
    card integer NOT NULL,
    trn_int_id character varying(255),
    trn_numaretor integer,
    merchant_name character varying(255),
    trn_purchase_date character varying(255),
    trn_amt numeric(15,2),
    trn_currency_symbol character varying(10),
    trn_type character varying(255),
    trn_type_code character varying(255),
    deb_crd_date character varying(255),
    amt_before_conv_and_index numeric(15,2),
    deb_crd_currency_symbol character varying(10),
    merchant_address character varying(255),
    merchant_phone_no character varying(255),
    branch_code_desc character varying(255),
    trans_card_present_ind boolean,
    cur_payment_num integer,
    num_of_payments integer,
    token_ind integer,
    wallet_provider_code integer,
    wallet_provider_desc character varying(255),
    token_number_part4 character varying(4),
    cash_account_trn_amt numeric(15,2),
    charge_external_to_card_comment text,
    refund_ind boolean,
    is_immediate_comment_ind boolean,
    is_immediate_hhk_ind boolean,
    is_margarita boolean,
    is_spread_paymenst_abroad boolean,
    trn_exac_way integer,
    debit_spread_ind boolean,
    on_going_transactions_comment text,
    early_payment_ind boolean,
    merchant_id character varying(255),
    crd_ext_id_num_type_code character varying(255),
    trans_source character varying(255),
    is_abroad_transaction boolean,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: charge_balance_cancellation; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.charge_balance_cancellation (
    charge_id uuid NOT NULL,
    description text,
    business_id uuid NOT NULL,
    owner_id uuid NOT NULL
);

ALTER TABLE ONLY accounter_schema.charge_balance_cancellation FORCE ROW LEVEL SECURITY;


--
-- Name: charge_spread; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.charge_spread (
    charge_id uuid NOT NULL,
    year_of_relevance date NOT NULL,
    amount numeric(8,2),
    owner_id uuid NOT NULL
);

ALTER TABLE ONLY accounter_schema.charge_spread FORCE ROW LEVEL SECURITY;


--
-- Name: charge_tags; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.charge_tags (
    charge_id uuid NOT NULL,
    part real DEFAULT 1,
    tag_id uuid NOT NULL,
    owner_id uuid NOT NULL
);

ALTER TABLE ONLY accounter_schema.charge_tags FORCE ROW LEVEL SECURITY;


--
-- Name: charge_unbalanced_ledger_businesses; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.charge_unbalanced_ledger_businesses (
    charge_id uuid NOT NULL,
    business_id uuid NOT NULL,
    remark text,
    owner_id uuid NOT NULL
);

ALTER TABLE ONLY accounter_schema.charge_unbalanced_ledger_businesses FORCE ROW LEVEL SECURITY;


--
-- Name: charges; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.charges (
    id uuid DEFAULT uuidv7() NOT NULL,
    owner_id uuid NOT NULL,
    is_property boolean DEFAULT false NOT NULL,
    user_description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tax_category_id uuid,
    invoice_payment_currency_diff boolean,
    type accounter_schema.charge_type,
    optional_vat boolean DEFAULT false NOT NULL,
    accountant_status accounter_schema.accountant_status DEFAULT 'UNAPPROVED'::accounter_schema.accountant_status NOT NULL,
    documents_optional_flag boolean DEFAULT false NOT NULL
);

ALTER TABLE ONLY accounter_schema.charges FORCE ROW LEVEL SECURITY;


--
-- Name: charges_bank_deposits; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.charges_bank_deposits (
    id uuid NOT NULL,
    deposit_id text,
    account_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    new_deposit_id uuid
);

ALTER TABLE ONLY accounter_schema.charges_bank_deposits FORCE ROW LEVEL SECURITY;


--
-- Name: charges_securities_executions; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.charges_securities_executions (
    execution_id uuid NOT NULL,
    charge_id uuid,
    owner_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY accounter_schema.charges_securities_executions FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE charges_securities_executions; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON TABLE accounter_schema.charges_securities_executions IS 'Securities executions booked by a charge directly, for executions with no cash leg (stock distributions); a NULL charge_id marks one the user dismissed';


--
-- Name: clients; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.clients (
    business_id uuid CONSTRAINT businesses_green_invoice_match_business_id_not_null NOT NULL,
    green_invoice_id uuid CONSTRAINT businesses_green_invoice_match_green_invoice_id_not_null NOT NULL,
    remark text,
    emails text[],
    document_type accounter_schema.document_type DEFAULT 'PROFORMA'::accounter_schema.document_type CONSTRAINT businesses_green_invoice_match_document_type_not_null NOT NULL,
    hive_id text,
    integrations jsonb DEFAULT '{}'::jsonb,
    owner_id uuid NOT NULL
);

ALTER TABLE ONLY accounter_schema.clients FORCE ROW LEVEL SECURITY;


--
-- Name: clients_contracts; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.clients_contracts (
    id uuid DEFAULT uuidv7() NOT NULL,
    client_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    remarks text,
    document_type accounter_schema.document_type DEFAULT 'PROFORMA'::accounter_schema.document_type NOT NULL,
    amount double precision NOT NULL,
    currency accounter_schema.currency NOT NULL,
    billing_cycle text DEFAULT 'monthly'::text NOT NULL,
    product text,
    plan text,
    is_active boolean,
    signed_agreement text,
    ms_cloud text,
    purchase_orders text[] DEFAULT '{}'::text[] NOT NULL,
    operations_count bigint DEFAULT 0 NOT NULL,
    owner_id uuid NOT NULL
);

ALTER TABLE ONLY accounter_schema.clients_contracts FORCE ROW LEVEL SECURITY;


--
-- Name: corporate_tax_variables; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.corporate_tax_variables (
    corporate_id uuid NOT NULL,
    date date NOT NULL,
    tax_rate numeric NOT NULL,
    original_tax_rate numeric DEFAULT 23 NOT NULL,
    owner_id uuid NOT NULL
);

ALTER TABLE ONLY accounter_schema.corporate_tax_variables FORCE ROW LEVEL SECURITY;


--
-- Name: countries; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.countries (
    name text NOT NULL,
    code character varying(3) NOT NULL
);


--
-- Name: crypto_currencies; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.crypto_currencies (
    symbol text NOT NULL,
    name text NOT NULL,
    coingecko_id text,
    coinmarketcap_id integer
);


--
-- Name: crypto_exchange_rates; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.crypto_exchange_rates (
    date timestamp without time zone NOT NULL,
    coin_symbol text NOT NULL,
    value numeric NOT NULL,
    against accounter_schema.currency DEFAULT 'USD'::accounter_schema.currency NOT NULL,
    sample_date timestamp without time zone NOT NULL
);


--
-- Name: deel_invoices; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.deel_invoices (
    id character varying(21) NOT NULL,
    document_id uuid,
    amount numeric(11,2) NOT NULL,
    contract_id character varying(10),
    created_at timestamp with time zone NOT NULL,
    currency text NOT NULL,
    deel_fee numeric(9,2) NOT NULL,
    due_date timestamp with time zone NOT NULL,
    is_overdue boolean NOT NULL,
    issued_at timestamp with time zone NOT NULL,
    label text NOT NULL,
    paid_at timestamp with time zone NOT NULL,
    status character varying(12) NOT NULL,
    total numeric(11,2) NOT NULL,
    vat_id character varying(1),
    vat_percentage character varying(1),
    vat_total numeric(9,2),
    adjustment numeric(9,2) NOT NULL,
    approve_date timestamp with time zone,
    approvers text,
    bonus numeric(9,2) NOT NULL,
    commissions numeric(9,2) NOT NULL,
    contract_country character varying(2),
    contract_start_date timestamp with time zone,
    contractor_email text,
    contractor_employee_name text NOT NULL,
    contractor_unique_identifier uuid,
    deductions numeric(9,2) NOT NULL,
    expenses numeric(9,2) NOT NULL,
    frequency character varying(10),
    general_ledger_account character varying(1),
    others numeric(11,2) NOT NULL,
    overtime numeric(9,2) NOT NULL,
    payment_currency accounter_schema.currency NOT NULL,
    pro_rata numeric(9,2) NOT NULL,
    processing_fee numeric(9,2) NOT NULL,
    work numeric(11,2) NOT NULL,
    total_payment_currency numeric(9,2) NOT NULL,
    payment_id character varying(21) NOT NULL,
    group_id text,
    contract_type text,
    recipient_legal_entity_id uuid,
    owner_id uuid NOT NULL,
    billing_type character varying(20),
    document_type character varying(20)
);

ALTER TABLE ONLY accounter_schema.deel_invoices FORCE ROW LEVEL SECURITY;


--
-- Name: deel_workers; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.deel_workers (
    contract_id character varying(10) NOT NULL,
    contractor_id uuid NOT NULL,
    contractor_name text NOT NULL,
    contract_start_date timestamp with time zone NOT NULL,
    business_id uuid NOT NULL,
    owner_id uuid NOT NULL
);

ALTER TABLE ONLY accounter_schema.deel_workers FORCE ROW LEVEL SECURITY;


--
-- Name: depreciation; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.depreciation (
    id uuid DEFAULT uuidv7() NOT NULL,
    charge_id uuid NOT NULL,
    amount numeric,
    currency accounter_schema.currency,
    activation_date date NOT NULL,
    type accounter_schema.depreciation_types,
    category uuid NOT NULL,
    owner_id uuid NOT NULL,
    local_amount numeric,
    asset_tax_category_id uuid
);

ALTER TABLE ONLY accounter_schema.depreciation FORCE ROW LEVEL SECURITY;


--
-- Name: COLUMN depreciation.local_amount; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.depreciation.local_amount IS 'Cost basis in the local currency (ILS). Overrides converting a foreign-currency amount at the purchase-date exchange rate; NULL computes it';


--
-- Name: COLUMN depreciation.asset_tax_category_id; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.depreciation.asset_tax_category_id IS 'The asset''s cost account. NULL takes the tax category of the charge that bought the asset; set it when one charge buys several assets';


--
-- Name: depreciation_categories; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.depreciation_categories (
    id uuid DEFAULT uuidv7() NOT NULL,
    name text NOT NULL,
    percentage numeric(5,2) NOT NULL
);


--
-- Name: depreciation_disposals; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.depreciation_disposals (
    id uuid DEFAULT uuidv7() NOT NULL,
    owner_id uuid NOT NULL,
    depreciation_id uuid NOT NULL,
    charge_id uuid,
    type accounter_schema.depreciation_disposal_type NOT NULL,
    disposal_date date NOT NULL,
    disposed_cost numeric,
    proceeds numeric DEFAULT 0 NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    updated_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    refund_mode accounter_schema.depreciation_refund_mode,
    original_amount numeric,
    original_currency accounter_schema.currency,
    CONSTRAINT depreciation_disposals_disposed_cost_positive CHECK ((disposed_cost > (0)::numeric)),
    CONSTRAINT depreciation_disposals_proceeds_non_negative CHECK ((proceeds >= (0)::numeric))
);

ALTER TABLE ONLY accounter_schema.depreciation_disposals FORCE ROW LEVEL SECURITY;


--
-- Name: COLUMN depreciation_disposals.disposed_cost; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.depreciation_disposals.disposed_cost IS 'Local currency, excluding VAT: the part of the asset cost that leaves the books (sale, write-off), or the refunded amount that reduces the cost (cost refund)';


--
-- Name: COLUMN depreciation_disposals.proceeds; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.depreciation_disposals.proceeds IS 'Consideration for a sale, local currency, excluding VAT. 0 for a write-off; a cost refund has no proceeds (ignored for refunds stored before refund modes existed)';


--
-- Name: COLUMN depreciation_disposals.refund_mode; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.depreciation_disposals.refund_mode IS 'COST_REFUND only: how the refund corrects the asset cost. NULL means FROM_ACTIVATION';


--
-- Name: COLUMN depreciation_disposals.original_amount; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.depreciation_disposals.original_amount IS 'A cost refund of an asset recorded in a foreign currency, in that currency (original_currency). disposed_cost is then NULL: the local cost is converted when read';


--
-- Name: COLUMN depreciation_disposals.original_currency; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.depreciation_disposals.original_currency IS 'The currency of original_amount: the asset''s currency';


--
-- Name: dividends; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.dividends (
    id uuid DEFAULT uuidv7() NOT NULL,
    business_id uuid NOT NULL,
    amount numeric NOT NULL,
    date date NOT NULL,
    transaction_id uuid,
    owner_id uuid NOT NULL,
    withholding_tax_percentage_override numeric
);

ALTER TABLE ONLY accounter_schema.dividends FORCE ROW LEVEL SECURITY;


--
-- Name: documents; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.documents (
    id uuid DEFAULT uuidv7() NOT NULL,
    image_url text,
    file_url text,
    type accounter_schema.document_type DEFAULT 'UNPROCESSED'::accounter_schema.document_type NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT documents_modified_at_not_null NOT NULL,
    serial_number text,
    date date,
    total_amount double precision,
    currency_code accounter_schema.currency,
    vat_amount double precision,
    is_reviewed boolean DEFAULT false NOT NULL,
    debtor_id uuid,
    creditor_id uuid,
    no_vat_amount numeric,
    charge_id uuid,
    vat_report_date_override date,
    allocation_number character varying(9),
    exchange_rate_override numeric,
    file_hash text,
    description text,
    remarks text,
    owner_id uuid NOT NULL
);

ALTER TABLE ONLY accounter_schema.documents FORCE ROW LEVEL SECURITY;


--
-- Name: documents_issued; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.documents_issued (
    id uuid NOT NULL,
    external_id text NOT NULL,
    status accounter_schema.document_status DEFAULT 'OPEN'::accounter_schema.document_status NOT NULL,
    linked_document_ids uuid[],
    owner_id uuid NOT NULL
);

ALTER TABLE ONLY accounter_schema.documents_issued FORCE ROW LEVEL SECURITY;


--
-- Name: dynamic_report_comments; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.dynamic_report_comments (
    id uuid DEFAULT uuidv7() NOT NULL,
    owner_id uuid NOT NULL,
    thread_id uuid NOT NULL,
    author_id uuid NOT NULL,
    content text NOT NULL,
    from_date date NOT NULL,
    to_date date NOT NULL,
    scope_owner_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    edited_at timestamp with time zone,
    deleted_at timestamp with time zone,
    CONSTRAINT dynamic_report_comments_content_length CHECK ((((char_length(content) >= 1) AND (char_length(content) <= 10000)) AND (content ~ '[^[:space:]]'::text)))
);

ALTER TABLE ONLY accounter_schema.dynamic_report_comments FORCE ROW LEVEL SECURITY;


--
-- Name: dynamic_report_template_snapshots; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.dynamic_report_template_snapshots (
    id uuid DEFAULT uuidv7() NOT NULL,
    owner_id uuid NOT NULL,
    template_name text NOT NULL,
    from_date date NOT NULL,
    to_date date NOT NULL,
    scope_owner_id uuid NOT NULL,
    tree jsonb NOT NULL,
    leaf_values jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    leaf_fingerprints jsonb,
    leaf_approvals jsonb
);

ALTER TABLE ONLY accounter_schema.dynamic_report_template_snapshots FORCE ROW LEVEL SECURITY;


--
-- Name: dynamic_report_templates; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.dynamic_report_templates (
    name text NOT NULL,
    owner_id uuid NOT NULL,
    template text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_locked boolean DEFAULT false NOT NULL,
    from_date date,
    to_date date
);

ALTER TABLE ONLY accounter_schema.dynamic_report_templates FORCE ROW LEVEL SECURITY;


--
-- Name: dynamic_report_threads; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.dynamic_report_threads (
    id uuid DEFAULT uuidv7() NOT NULL,
    owner_id uuid NOT NULL,
    template_name text NOT NULL,
    node_id text NOT NULL,
    node_kind text NOT NULL,
    node_label text NOT NULL,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT dynamic_report_threads_node_id_length CHECK (((char_length(node_id) >= 1) AND (char_length(node_id) <= 200))),
    CONSTRAINT dynamic_report_threads_node_kind_check CHECK ((node_kind = ANY (ARRAY['leaf'::text, 'branch'::text])))
);

ALTER TABLE ONLY accounter_schema.dynamic_report_threads FORCE ROW LEVEL SECURITY;


--
-- Name: email_ingestion_alias_routing; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.email_ingestion_alias_routing (
    id uuid DEFAULT uuidv7() NOT NULL,
    alias text NOT NULL,
    owner_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY accounter_schema.email_ingestion_alias_routing FORCE ROW LEVEL SECURITY;


--
-- Name: email_ingestion_dedup_fingerprints; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.email_ingestion_dedup_fingerprints (
    id uuid DEFAULT uuidv7() NOT NULL,
    owner_id uuid NOT NULL,
    fingerprint text NOT NULL,
    outcome text NOT NULL,
    ingest_id uuid,
    correlation_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY accounter_schema.email_ingestion_dedup_fingerprints FORCE ROW LEVEL SECURITY;


--
-- Name: email_ingestion_grants; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.email_ingestion_grants (
    id uuid DEFAULT uuidv7() NOT NULL,
    jti text NOT NULL,
    owner_id uuid NOT NULL,
    message_id text NOT NULL,
    raw_message_hash text NOT NULL,
    action text DEFAULT 'ingest'::text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    business_id uuid,
    classification text
);

ALTER TABLE ONLY accounter_schema.email_ingestion_grants FORCE ROW LEVEL SECURITY;


--
-- Name: email_ingestion_idempotency_keys; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.email_ingestion_idempotency_keys (
    id uuid DEFAULT uuidv7() NOT NULL,
    idempotency_key text NOT NULL,
    owner_id uuid NOT NULL,
    outcome text NOT NULL,
    ingest_id uuid,
    audit_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY accounter_schema.email_ingestion_idempotency_keys FORCE ROW LEVEL SECURITY;


--
-- Name: email_ingestion_quarantine; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.email_ingestion_quarantine (
    id uuid DEFAULT uuidv7() NOT NULL,
    reason_code text NOT NULL,
    tenant_candidate uuid,
    message_id text,
    raw_message_hash text,
    correlation_id text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    retry_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY accounter_schema.email_ingestion_quarantine FORCE ROW LEVEL SECURITY;


--
-- Name: email_ingestion_replay_nonces; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.email_ingestion_replay_nonces (
    id uuid DEFAULT uuidv7() NOT NULL,
    nonce text NOT NULL,
    owner_id uuid,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY accounter_schema.email_ingestion_replay_nonces FORCE ROW LEVEL SECURITY;


--
-- Name: employees; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.employees (
    first_name text,
    last_name text,
    pension_fund_id uuid,
    pension_member_id text,
    national_id text,
    birth_date text,
    pension_policy_number text,
    training_fund_policy_number text,
    training_fund_start_date text,
    employer uuid,
    gender text,
    family_status text,
    role_status text,
    phone_number text,
    address text,
    israel_resident boolean,
    kibutz_member boolean,
    kupat_holim text,
    start_work_date date NOT NULL,
    email text,
    bank_number integer,
    account_number integer,
    branch_number integer,
    business_id uuid NOT NULL,
    end_work_date date,
    owner_id uuid NOT NULL
);

ALTER TABLE ONLY accounter_schema.employees FORCE ROW LEVEL SECURITY;


--
-- Name: etana_account_transactions; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.etana_account_transactions (
    transaction_id text NOT NULL,
    account_id text NOT NULL,
    "time" date NOT NULL,
    currency text NOT NULL,
    amount numeric NOT NULL,
    description text NOT NULL,
    fee numeric,
    fee_tx_id text,
    metadata text,
    action_type text NOT NULL,
    raw_data jsonb NOT NULL
);


--
-- Name: etherscan_transactions; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.etherscan_transactions (
    tx_id text NOT NULL,
    wallet_address text NOT NULL,
    contract_address text NOT NULL,
    from_address text NOT NULL,
    to_address text NOT NULL,
    currency text NOT NULL,
    transaction_hash text,
    amount numeric NOT NULL,
    value_date date NOT NULL,
    raw_data jsonb NOT NULL,
    event_date timestamp without time zone NOT NULL,
    gas_fee numeric,
    id uuid DEFAULT uuidv7() NOT NULL
);


--
-- Name: exchange_rates; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.exchange_rates (
    exchange_date date,
    usd numeric(4,3),
    eur numeric(5,4),
    gbp numeric(5,4),
    cad numeric(5,4),
    jpy numeric(7,6),
    aud numeric(5,4),
    sek numeric(5,4)
);


--
-- Name: transactions; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.transactions (
    id uuid DEFAULT uuidv7() NOT NULL,
    account_id uuid NOT NULL,
    charge_id uuid NOT NULL,
    source_id uuid NOT NULL,
    source_description text,
    currency accounter_schema.currency NOT NULL,
    event_date date NOT NULL,
    debit_date date,
    amount numeric NOT NULL,
    current_balance numeric NOT NULL,
    business_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    debit_date_override date,
    is_fee boolean DEFAULT false NOT NULL,
    source_reference text NOT NULL,
    source_origin text NOT NULL,
    counter_account text,
    debit_timestamp timestamp without time zone,
    currency_rate numeric DEFAULT 0 NOT NULL,
    origin_key text NOT NULL,
    owner_id uuid NOT NULL
);

ALTER TABLE ONLY accounter_schema.transactions FORCE ROW LEVEL SECURITY;


--
-- Name: extended_business_trip_transactions; Type: VIEW; Schema: accounter_schema; Owner: -
--

CREATE VIEW accounter_schema.extended_business_trip_transactions AS
 WITH transactions_by_business_trip_transaction AS (
         SELECT tm.business_trip_transaction_id,
            array_agg(DISTINCT t1.id) AS transaction_ids,
            array_agg(DISTINCT t1.charge_id) AS charge_ids,
            array_agg(DISTINCT t1.currency) AS currencies,
            sum(tm.amount) AS amount,
            min(t1.event_date) AS event_date,
            min(COALESCE(t1.debit_date_override, t1.debit_date)) AS debit_date
           FROM (accounter_schema.business_trips_transactions_match tm
             LEFT JOIN accounter_schema.transactions t1 ON ((t1.id = tm.transaction_id)))
          GROUP BY tm.business_trip_transaction_id
        )
 SELECT DISTINCT ON (btt.id) btt.id,
    btt.business_trip_id,
    t.transaction_ids,
        CASE
            WHEN (t.charge_ids IS NOT NULL) THEN t.charge_ids
            WHEN (ep.charge_id IS NOT NULL) THEN ARRAY[ep.charge_id]
            ELSE NULL::uuid[]
        END AS charge_ids,
    btt.category,
        CASE
            WHEN (t.business_trip_transaction_id IS NULL) THEN ep.date
            ELSE t.event_date
        END AS date,
        CASE
            WHEN (t.business_trip_transaction_id IS NULL) THEN ep.value_date
            ELSE t.debit_date
        END AS value_date,
        CASE
            WHEN (t.business_trip_transaction_id IS NULL) THEN
            CASE
                WHEN (ep.amount IS NULL) THEN NULL::numeric
                ELSE (ep.amount * ('-1'::integer)::numeric)
            END
            WHEN (array_length(t.currencies, 1) = 1) THEN t.amount
            ELSE NULL::numeric
        END AS amount,
        CASE
            WHEN (t.business_trip_transaction_id IS NULL) THEN ep.currency
            WHEN (array_length(t.currencies, 1) = 1) THEN t.currencies[1]
            ELSE NULL::accounter_schema.currency
        END AS currency,
    ep.employee_business_id,
    (t.business_trip_transaction_id IS NULL) AS payed_by_employee
   FROM ((accounter_schema.business_trips_transactions btt
     LEFT JOIN transactions_by_business_trip_transaction t ON ((t.business_trip_transaction_id = btt.id)))
     LEFT JOIN accounter_schema.business_trips_employee_payments ep ON ((ep.id = btt.id)));


--
-- Name: ledger_records; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.ledger_records (
    id uuid DEFAULT uuidv7() NOT NULL,
    owner_id uuid NOT NULL,
    charge_id uuid NOT NULL,
    debit_entity1 uuid,
    debit_foreign_amount1 numeric,
    debit_local_amount1 numeric,
    credit_entity1 uuid,
    credit_foreign_amount1 numeric,
    credit_local_amount1 numeric,
    debit_entity2 uuid,
    debit_foreign_amount2 numeric,
    debit_local_amount2 numeric,
    credit_entity2 uuid,
    credit_foreign_amount2 numeric,
    credit_local_amount2 numeric,
    currency accounter_schema.currency NOT NULL,
    invoice_date date NOT NULL,
    value_date date NOT NULL,
    description text,
    reference1 text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    locked boolean DEFAULT false
);

ALTER TABLE ONLY accounter_schema.ledger_records FORCE ROW LEVEL SECURITY;


--
-- Name: extended_charges; Type: VIEW; Schema: accounter_schema; Owner: -
--

CREATE VIEW accounter_schema.extended_charges AS
 WITH years_of_relevance AS (
         SELECT charge_spread.charge_id,
            array_agg(charge_spread.year_of_relevance) AS years_of_relevance
           FROM accounter_schema.charge_spread
          GROUP BY charge_spread.charge_id
        ), transactions_by_charge AS (
         SELECT transactions.charge_id,
            min(transactions.event_date) AS min_event_date,
            max(transactions.event_date) AS max_event_date,
            min(COALESCE(transactions.debit_date_override, transactions.debit_date)) AS min_debit_date,
            max(COALESCE(transactions.debit_date_override, transactions.debit_date)) AS max_debit_date,
            sum(transactions.amount) AS event_amount,
            count(*) AS transactions_count,
            (count(*) FILTER (WHERE ((transactions.business_id IS NULL) OR (COALESCE(transactions.debit_date_override, transactions.debit_date) IS NULL))) > 0) AS invalid_transactions,
            array_agg(DISTINCT transactions.currency) AS currency_array,
            array_agg(transactions.account_id) AS account,
            string_agg(((COALESCE(transactions.source_description, ''::text) || ' '::text) || COALESCE(transactions.source_reference, ''::text)), ' '::text) AS search_text
           FROM accounter_schema.transactions
          GROUP BY transactions.charge_id
        ), documents_by_charge AS (
         SELECT documents.charge_id,
            min(documents.date) FILTER (WHERE (documents.type = ANY (ARRAY['INVOICE'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type, 'RECEIPT'::accounter_schema.document_type, 'CREDIT_INVOICE'::accounter_schema.document_type]))) AS min_event_date,
            min(documents.date) AS min_any_event_date,
            max(documents.date) FILTER (WHERE (documents.type = ANY (ARRAY['INVOICE'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type, 'RECEIPT'::accounter_schema.document_type, 'CREDIT_INVOICE'::accounter_schema.document_type]))) AS max_event_date,
            max(documents.date) AS max_any_event_date,
            sum((documents.total_amount * (
                CASE
                    WHEN (documents.creditor_id = charges.owner_id) THEN 1
                    ELSE '-1'::integer
                END)::double precision)) FILTER (WHERE ((businesses.can_settle_with_receipt = true) AND (documents.type = ANY (ARRAY['RECEIPT'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type])))) AS receipt_event_amount,
            sum((documents.total_amount * (
                CASE
                    WHEN (documents.creditor_id = charges.owner_id) THEN 1
                    ELSE '-1'::integer
                END)::double precision)) FILTER (WHERE (documents.type = ANY (ARRAY['INVOICE'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type, 'CREDIT_INVOICE'::accounter_schema.document_type]))) AS invoice_event_amount,
            sum((documents.vat_amount * (
                CASE
                    WHEN (documents.creditor_id = charges.owner_id) THEN 1
                    ELSE '-1'::integer
                END)::double precision)) FILTER (WHERE ((businesses.can_settle_with_receipt = true) AND (documents.type = ANY (ARRAY['RECEIPT'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type])))) AS receipt_vat_amount,
            sum((documents.vat_amount * (
                CASE
                    WHEN (documents.creditor_id = charges.owner_id) THEN 1
                    ELSE '-1'::integer
                END)::double precision)) FILTER (WHERE (documents.type = ANY (ARRAY['INVOICE'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type, 'CREDIT_INVOICE'::accounter_schema.document_type]))) AS invoice_vat_amount,
            count(*) FILTER (WHERE (documents.type = ANY (ARRAY['INVOICE'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type, 'CREDIT_INVOICE'::accounter_schema.document_type]))) AS invoices_count,
            count(*) FILTER (WHERE (documents.type = ANY (ARRAY['RECEIPT'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type]))) AS receipts_count,
            count(*) AS documents_count,
            (count(*) FILTER (WHERE (((documents.type = ANY (ARRAY['INVOICE'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type, 'RECEIPT'::accounter_schema.document_type, 'CREDIT_INVOICE'::accounter_schema.document_type])) AND ((documents.debtor_id IS NULL) OR (documents.creditor_id IS NULL) OR (documents.date IS NULL) OR (documents.serial_number IS NULL) OR (documents.vat_amount IS NULL) OR (documents.total_amount IS NULL) OR (documents.charge_id IS NULL) OR (documents.currency_code IS NULL))) OR (documents.type = 'UNPROCESSED'::accounter_schema.document_type))) > 0) AS invalid_documents,
            array_agg(documents.currency_code) FILTER (WHERE (((businesses.can_settle_with_receipt = true) AND (documents.type = ANY (ARRAY['RECEIPT'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type]))) OR (documents.type = ANY (ARRAY['INVOICE'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type, 'CREDIT_INVOICE'::accounter_schema.document_type])))) AS currency_array,
            COALESCE(bool_or((documents_issued.status = 'OPEN'::accounter_schema.document_status)), false) AS open_docs_flag,
            string_agg(((((COALESCE(documents.description, ''::text) || ' '::text) || COALESCE(documents.remarks, ''::text)) || ' '::text) || COALESCE(documents.serial_number, ''::text)), ' '::text) AS search_text
           FROM (((accounter_schema.documents
             LEFT JOIN accounter_schema.charges ON ((documents.charge_id = charges.id)))
             LEFT JOIN accounter_schema.businesses ON ((((documents.creditor_id = charges.owner_id) AND (documents.debtor_id = businesses.id)) OR ((documents.creditor_id = businesses.id) AND (documents.debtor_id = charges.owner_id)))))
             LEFT JOIN accounter_schema.documents_issued ON ((documents.id = documents_issued.id)))
          GROUP BY documents.charge_id
        ), businesses_by_charge AS (
         SELECT base.charge_id,
            array_remove(base.business_array, charges.owner_id) AS business_array,
            array_remove(base.filtered_business_array, charges.owner_id) AS filtered_business_array
           FROM (( SELECT b_1.charge_id,
                    array_agg(DISTINCT b_1.business_id) AS business_array,
                    array_remove(array_agg(DISTINCT
                        CASE
                            WHEN b_1.is_fee THEN NULL::uuid
                            ELSE b_1.business_id
                        END), NULL::uuid) AS filtered_business_array
                   FROM ( SELECT transactions.charge_id,
                            transactions.business_id,
                            transactions.is_fee
                           FROM accounter_schema.transactions
                          WHERE (transactions.business_id IS NOT NULL)
                        UNION
                         SELECT documents.charge_id,
                            documents.creditor_id,
                            false AS bool
                           FROM accounter_schema.documents
                          WHERE (documents.creditor_id IS NOT NULL)
                        UNION
                         SELECT documents.charge_id,
                            documents.debtor_id,
                            false AS bool
                           FROM accounter_schema.documents
                          WHERE (documents.debtor_id IS NOT NULL)
                        UNION
                         SELECT ledger_records.charge_id,
                            ledger_records.credit_entity1,
                            true AS bool
                           FROM accounter_schema.ledger_records
                          WHERE (ledger_records.credit_entity1 IS NOT NULL)
                        UNION
                         SELECT ledger_records.charge_id,
                            ledger_records.credit_entity2,
                            true AS bool
                           FROM accounter_schema.ledger_records
                          WHERE (ledger_records.credit_entity2 IS NOT NULL)
                        UNION
                         SELECT ledger_records.charge_id,
                            ledger_records.debit_entity1,
                            true AS bool
                           FROM accounter_schema.ledger_records
                          WHERE (ledger_records.debit_entity1 IS NOT NULL)
                        UNION
                         SELECT ledger_records.charge_id,
                            ledger_records.debit_entity2,
                            true AS bool
                           FROM accounter_schema.ledger_records
                          WHERE (ledger_records.debit_entity2 IS NOT NULL)) b_1
                  GROUP BY b_1.charge_id) base
             LEFT JOIN accounter_schema.charges ON ((base.charge_id = charges.id)))
        ), tags_by_charge AS (
         SELECT tags_1.charge_id,
            array_agg(tags_1.tag_id) AS tags_array
           FROM accounter_schema.charge_tags tags_1
          GROUP BY tags_1.charge_id
        ), ledger_by_charge AS (
         SELECT count(DISTINCT l2.id) AS ledger_count,
            array_remove(array_agg(DISTINCT l2.financial_entity), NULL::uuid) AS ledger_financial_entities,
            min(l2.value_date) AS min_value_date,
            max(l2.value_date) AS max_value_date,
            min(l2.invoice_date) AS min_invoice_date,
            max(l2.invoice_date) AS max_invoice_date,
            l2.charge_id
           FROM ( SELECT ledger_records.charge_id,
                    ledger_records.id,
                    ledger_records.value_date,
                    ledger_records.invoice_date,
                    unnest(ARRAY[ledger_records.credit_entity1, ledger_records.credit_entity2, ledger_records.debit_entity1, ledger_records.debit_entity2]) AS financial_entity
                   FROM accounter_schema.ledger_records) l2
          GROUP BY l2.charge_id
        )
 SELECT c.id,
    c.owner_id,
    (d.id IS NOT NULL) AS is_property,
    c.accountant_status,
    c.user_description,
    c.created_at,
    c.updated_at,
    COALESCE(c.tax_category_id, tcm.tax_category_id) AS tax_category_id,
    COALESCE((documents_by_charge.invoice_event_amount)::numeric, (documents_by_charge.receipt_event_amount)::numeric, transactions_by_charge.event_amount) AS event_amount,
    transactions_by_charge.min_event_date AS transactions_min_event_date,
    transactions_by_charge.max_event_date AS transactions_max_event_date,
    transactions_by_charge.min_debit_date AS transactions_min_debit_date,
    transactions_by_charge.max_debit_date AS transactions_max_debit_date,
    transactions_by_charge.event_amount AS transactions_event_amount,
        CASE
            WHEN (array_length(transactions_by_charge.currency_array, 1) = 1) THEN transactions_by_charge.currency_array[1]
            ELSE NULL::accounter_schema.currency
        END AS transactions_currency,
    transactions_by_charge.transactions_count,
    transactions_by_charge.invalid_transactions,
    COALESCE(documents_by_charge.min_event_date, documents_by_charge.min_any_event_date) AS documents_min_date,
    COALESCE(documents_by_charge.max_event_date, documents_by_charge.max_any_event_date) AS documents_max_date,
    COALESCE(documents_by_charge.invoice_event_amount, documents_by_charge.receipt_event_amount) AS documents_event_amount,
    COALESCE(documents_by_charge.invoice_vat_amount, documents_by_charge.receipt_vat_amount) AS documents_vat_amount,
        CASE
            WHEN (array_length(documents_by_charge.currency_array, 1) = 1) THEN documents_by_charge.currency_array[1]
            ELSE NULL::accounter_schema.currency
        END AS documents_currency,
    documents_by_charge.invoices_count,
    documents_by_charge.receipts_count,
    documents_by_charge.documents_count,
    documents_by_charge.invalid_documents,
    documents_by_charge.open_docs_flag,
    businesses_by_charge.business_array,
    b.id AS business_id,
    COALESCE(b.can_settle_with_receipt, false) AS can_settle_with_receipt,
    tags_by_charge.tags_array AS tags,
    btc.business_trip_id,
    ledger_by_charge.ledger_count,
    ledger_by_charge.ledger_financial_entities,
    ledger_by_charge.min_value_date AS ledger_min_value_date,
    ledger_by_charge.max_value_date AS ledger_max_value_date,
    ledger_by_charge.min_invoice_date AS ledger_min_invoice_date,
    ledger_by_charge.max_invoice_date AS ledger_max_invoice_date,
    y.years_of_relevance,
    c.invoice_payment_currency_diff,
    c.type,
    c.optional_vat,
    COALESCE(b.no_invoices_required, false) AS no_invoices_required,
    c.documents_optional_flag,
    lower(concat_ws(' '::text, c.user_description, transactions_by_charge.search_text, documents_by_charge.search_text)) AS merged_search_text
   FROM ((((((((((accounter_schema.charges c
     LEFT JOIN transactions_by_charge ON ((transactions_by_charge.charge_id = c.id)))
     LEFT JOIN documents_by_charge ON ((documents_by_charge.charge_id = c.id)))
     LEFT JOIN businesses_by_charge ON ((businesses_by_charge.charge_id = c.id)))
     LEFT JOIN accounter_schema.businesses b ON (((b.id = businesses_by_charge.filtered_business_array[1]) AND (array_length(businesses_by_charge.filtered_business_array, 1) = 1))))
     LEFT JOIN accounter_schema.business_tax_category_match tcm ON (((tcm.business_id = b.id) AND (tcm.owner_id = c.owner_id))))
     LEFT JOIN tags_by_charge ON ((c.id = tags_by_charge.charge_id)))
     LEFT JOIN accounter_schema.business_trip_charges btc ON ((btc.charge_id = c.id)))
     LEFT JOIN ledger_by_charge ON ((ledger_by_charge.charge_id = c.id)))
     LEFT JOIN years_of_relevance y ON ((y.charge_id = c.id)))
     LEFT JOIN accounter_schema.depreciation d ON ((d.charge_id = c.id)));


--
-- Name: tags; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.tags (
    id uuid DEFAULT uuidv7() NOT NULL,
    parent uuid,
    name text NOT NULL,
    owner_id uuid NOT NULL
);

ALTER TABLE ONLY accounter_schema.tags FORCE ROW LEVEL SECURITY;


--
-- Name: extended_tags; Type: VIEW; Schema: accounter_schema; Owner: -
--

CREATE VIEW accounter_schema.extended_tags AS
 WITH RECURSIVE get_ancestor(id, parent, name, names_path, ids_path, owner_id) AS (
         SELECT t.id,
            t.parent,
            t.name,
            NULL::text[] AS text,
            NULL::uuid[] AS uuid,
            t.owner_id
           FROM accounter_schema.tags t
          WHERE (t.parent IS NULL)
        UNION
         SELECT t.id,
            t.parent,
            t.name,
                CASE
                    WHEN (g.names_path IS NULL) THEN ARRAY[g.name]
                    ELSE array_append(g.names_path, g.name)
                END AS array_append,
                CASE
                    WHEN (g.ids_path IS NULL) THEN ARRAY[g.id]
                    ELSE array_append(g.ids_path, g.id)
                END AS array_append,
            t.owner_id
           FROM (get_ancestor g
             JOIN accounter_schema.tags t ON ((t.parent = g.id)))
        )
 SELECT id,
    parent,
    name,
    names_path,
    ids_path,
    owner_id
   FROM get_ancestor;


--
-- Name: financial_accounts; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.financial_accounts (
    account_number text NOT NULL,
    private_business text DEFAULT 'business'::text NOT NULL,
    owner uuid,
    bank_number integer,
    branch_number integer,
    extended_bank_number integer,
    party_preferred_indication integer,
    party_account_involvement_code integer,
    account_deal_date integer,
    account_update_date integer,
    meteg_doar_net integer,
    kod_harshaat_peilut integer,
    account_closing_reason_code integer,
    account_agreement_opening_date integer,
    service_authorization_desc text,
    branch_type_code integer,
    mymail_entitlement_switch integer,
    id uuid DEFAULT uuidv7() NOT NULL,
    type accounter_schema.financial_account_type NOT NULL,
    product_label text,
    account_name text,
    owner_id uuid NOT NULL
);

ALTER TABLE ONLY accounter_schema.financial_accounts FORCE ROW LEVEL SECURITY;


--
-- Name: COLUMN financial_accounts.meteg_doar_net; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.financial_accounts.meteg_doar_net IS 'Getting mail only online or physical
    0 - Also physical
    1 - Only online';


--
-- Name: financial_accounts_tax_categories; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.financial_accounts_tax_categories (
    financial_account_id uuid NOT NULL,
    currency accounter_schema.currency NOT NULL,
    tax_category_id uuid NOT NULL,
    owner_id uuid NOT NULL
);

ALTER TABLE ONLY accounter_schema.financial_accounts_tax_categories FORCE ROW LEVEL SECURITY;


--
-- Name: financial_bank_accounts; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.financial_bank_accounts (
    id uuid NOT NULL,
    bank_number integer NOT NULL,
    branch_number integer NOT NULL,
    extended_bank_number integer,
    party_preferred_indication integer,
    party_account_involvement_code integer,
    account_deal_date integer,
    account_update_date integer,
    meteg_doar_net integer,
    kod_harshaat_peilut integer,
    account_closing_reason_code integer,
    account_agreement_opening_date integer,
    service_authorization_desc text,
    branch_type_code integer,
    mymail_entitlement_switch integer,
    product_label text,
    iban character varying(34),
    swift_code character varying(255),
    owner_id uuid NOT NULL
);

ALTER TABLE ONLY accounter_schema.financial_bank_accounts FORCE ROW LEVEL SECURITY;


--
-- Name: financial_entities; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.financial_entities (
    id uuid DEFAULT uuidv7() NOT NULL,
    type text,
    owner_id uuid,
    name text NOT NULL,
    sort_code integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    irs_code smallint,
    is_active boolean DEFAULT true NOT NULL
);

ALTER TABLE ONLY accounter_schema.financial_entities FORCE ROW LEVEL SECURITY;


--
-- Name: invitations; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.invitations (
    id uuid DEFAULT uuidv7() NOT NULL,
    business_id uuid NOT NULL,
    email text NOT NULL,
    role_id text NOT NULL,
    auth0_user_created boolean DEFAULT false NOT NULL,
    auth0_user_id text,
    invited_by_user_id uuid,
    invited_by_business_id uuid,
    accepted_at timestamp with time zone,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    token_hash text NOT NULL,
    user_id uuid NOT NULL
);


--
-- Name: TABLE invitations; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON TABLE accounter_schema.invitations IS 'Pre-registration flow: invitation created → Auth0 user created (blocked) → user sets password → accepts invitation → Auth0 user unblocked';


--
-- Name: COLUMN invitations.id; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.invitations.id IS 'Unique invitation identifier';


--
-- Name: COLUMN invitations.business_id; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.invitations.business_id IS 'Business the user is being invited to';


--
-- Name: COLUMN invitations.email; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.invitations.email IS 'Email address of the invited user';


--
-- Name: COLUMN invitations.role_id; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.invitations.role_id IS 'Role to assign to the user upon acceptance';


--
-- Name: COLUMN invitations.auth0_user_created; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.invitations.auth0_user_created IS 'Tracks whether Auth0 Management API call succeeded';


--
-- Name: COLUMN invitations.auth0_user_id; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.invitations.auth0_user_id IS 'Auth0 user ID from pre-registration (e.g., ''auth0|507f1f77bcf86cd799439011''), used for cleanup';


--
-- Name: COLUMN invitations.invited_by_user_id; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.invitations.invited_by_user_id IS 'User ID of the admin who created this invitation';


--
-- Name: COLUMN invitations.invited_by_business_id; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.invitations.invited_by_business_id IS 'Business ID context of the admin who created this invitation (should match business_id)';


--
-- Name: COLUMN invitations.accepted_at; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.invitations.accepted_at IS 'Timestamp when invitation was accepted (NULL until accepted, single-use token tracking)';


--
-- Name: COLUMN invitations.expires_at; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.invitations.expires_at IS 'Invitation expiration timestamp (typically 7 days from creation)';


--
-- Name: COLUMN invitations.created_at; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.invitations.created_at IS 'Timestamp when invitation was created';


--
-- Name: COLUMN invitations.token_hash; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.invitations.token_hash IS 'SHA-256 hash of invitation token (never store plaintext token)';


--
-- Name: COLUMN invitations.user_id; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.invitations.user_id IS 'Deterministic local user identifier linked to this invitation';


--
-- Name: isracard_creditcard_transactions; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.isracard_creditcard_transactions (
    specific_date character varying(30),
    card_index integer NOT NULL,
    deals_inbound character varying(3),
    supplier_id integer,
    supplier_name character varying(15),
    deal_sum_type character varying(1),
    payment_sum_sign character varying(1),
    purchase_date character varying(5),
    full_purchase_date text,
    more_info character varying(30),
    horaat_keva character varying(1),
    voucher_number integer,
    voucher_number_ratz integer,
    solek character varying(1),
    purchase_date_outbound character varying(5),
    full_purchase_date_outbound text,
    currency_id character varying(4),
    current_payment_currency character varying(3),
    city character varying(10),
    supplier_name_outbound character varying(15),
    full_supplier_name_outbound character varying(20),
    payment_date character varying(5),
    full_payment_date text,
    is_show_deals_outbound character varying(1),
    adendum character varying(30),
    voucher_number_ratz_outbound integer,
    is_show_link_for_supplier_details character varying(3),
    deal_sum character varying(12),
    payment_sum numeric(8,2),
    full_supplier_name_heb character varying(20),
    deal_sum_outbound numeric(9,2),
    payment_sum_outbound numeric(8,2),
    is_horaat_keva character varying(5) NOT NULL,
    stage character varying(30),
    return_code character varying(30),
    message character varying(30),
    return_message character varying(30),
    display_properties character varying(30),
    table_page_num bit(1) NOT NULL,
    is_error character varying(5) NOT NULL,
    is_captcha character varying(5) NOT NULL,
    is_button character varying(5) NOT NULL,
    site_name character varying(30),
    client_ip_address character varying(30),
    card integer NOT NULL,
    id uuid DEFAULT uuidv7() NOT NULL,
    charging_date text,
    kod_matbea_mekori text,
    esb_services_call text
);


--
-- Name: kraken_ledger_records; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.kraken_ledger_records (
    ledger_id text NOT NULL,
    account_nickname text NOT NULL,
    action_type text NOT NULL,
    currency text NOT NULL,
    amount numeric NOT NULL,
    balance numeric NOT NULL,
    fee numeric NOT NULL,
    value_date timestamp without time zone NOT NULL,
    trade_ref_id text,
    raw_data jsonb NOT NULL
);


--
-- Name: kraken_trades; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.kraken_trades (
    trade_id text NOT NULL,
    account_nickname text NOT NULL,
    pair text NOT NULL,
    value_date timestamp without time zone NOT NULL,
    order_type text NOT NULL,
    price numeric NOT NULL,
    cost numeric NOT NULL,
    fee numeric NOT NULL,
    vol numeric NOT NULL,
    margin numeric NOT NULL,
    raw_data jsonb NOT NULL
);


--
-- Name: max_creditcard_transactions; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.max_creditcard_transactions (
    id uuid DEFAULT uuidv7() NOT NULL,
    actual_payment_amount numeric(9,2) NOT NULL,
    arn text NOT NULL,
    card_index integer NOT NULL,
    category_id integer NOT NULL,
    comments text NOT NULL,
    deal_data_acq character varying(10) NOT NULL,
    deal_data_adjustment_amount character varying(10),
    deal_data_adjustment_type numeric(9,2) NOT NULL,
    deal_data_amount numeric(9,2) NOT NULL,
    deal_data_amount_ils numeric(9,2) NOT NULL,
    deal_data_amount_left numeric(9,2) NOT NULL,
    deal_data_arn character varying(25) NOT NULL,
    deal_data_authorization_number character varying(15) CONSTRAINT max_creditcard_transactions_deal_data_authorization_nu_not_null NOT NULL,
    deal_data_card_name character varying(10),
    deal_data_card_token character varying(10),
    deal_data_commission_vat numeric(9,2) NOT NULL,
    deal_data_direct_exchange character varying(10),
    deal_data_exchange_commission_amount character varying(10),
    deal_data_exchange_commission_maam character varying(10),
    deal_data_exchange_commission_type character varying(10),
    deal_data_exchange_direct character varying(10) NOT NULL,
    deal_data_exchange_rate numeric(9,2) NOT NULL,
    deal_data_index_rate_base character varying(10),
    deal_data_index_rate_pmt character varying(10),
    deal_data_interest_amount numeric(9,2) NOT NULL,
    deal_data_is_allowed_spread_with_benefit bit(1) CONSTRAINT max_creditcard_transactions_deal_data_is_allowed_sprea_not_null NOT NULL,
    deal_data_issuer_currency character varying(10) NOT NULL,
    deal_data_issuer_exchange_rate character varying(10),
    deal_data_original_term character varying(10),
    deal_data_percent_maam numeric(9,2),
    deal_data_plan numeric(9,2) NOT NULL,
    deal_data_pos_entry_emv numeric(9,2) NOT NULL,
    deal_data_processing_date date NOT NULL,
    deal_data_purchase_amount character varying(10),
    deal_data_purchase_time time without time zone,
    deal_data_ref_nbr character varying(25) NOT NULL,
    deal_data_show_cancel_debit bit(1) CONSTRAINT max_creditcard_transactions_deal_data_show_cancel_debi_not_null NOT NULL,
    deal_data_show_spread bit(1) NOT NULL,
    deal_data_show_spread_benefit_button bit(1) CONSTRAINT max_creditcard_transactions_deal_data_show_spread_bene_not_null NOT NULL,
    deal_data_show_spread_button bit(1) CONSTRAINT max_creditcard_transactions_deal_data_show_spread_butt_not_null NOT NULL,
    deal_data_show_spread_for_leumi bit(1) CONSTRAINT max_creditcard_transactions_deal_data_show_spread_for__not_null NOT NULL,
    deal_data_tdm_card_token character varying(10) NOT NULL,
    deal_data_tdm_transaction_type integer CONSTRAINT max_creditcard_transactions_deal_data_tdm_transaction__not_null NOT NULL,
    deal_data_transaction_type integer NOT NULL,
    deal_data_txn_code integer NOT NULL,
    deal_data_user_name character varying(30) NOT NULL,
    deal_data_withdrawal_commission_amount character varying(10),
    discount_key_amount character varying(10),
    discount_key_rec_type character varying(10),
    ethoca_ind bit(1) NOT NULL,
    funds_transfer_comment text,
    funds_transfer_receiver_or_transfer text,
    is_register_ch bit(1) NOT NULL,
    is_spreading_autorization_allowed bit(1) CONSTRAINT max_creditcard_transactions_is_spreading_autorization__not_null NOT NULL,
    issuer_id integer NOT NULL,
    merchant_address text,
    merchant_coordinates character varying(10),
    merchant_max_phone bit(1) NOT NULL,
    merchant text NOT NULL,
    merchant_commercial_name text,
    merchant_number character varying(10) NOT NULL,
    merchant_phone character varying(15) NOT NULL,
    merchant_tax_id character varying(9) NOT NULL,
    merchant_name text NOT NULL,
    original_amount numeric(9,2) NOT NULL,
    original_currency character varying(4) NOT NULL,
    payment_currency integer,
    payment_date date NOT NULL,
    plan_name text NOT NULL,
    plan_type_id integer NOT NULL,
    promotion_amount numeric(9,2),
    promotion_club text NOT NULL,
    promotion_type character varying(10),
    purchase_date date NOT NULL,
    receipt_p_d_f character varying(10),
    ref_index integer NOT NULL,
    runtime_reference_internal_id character varying(36) CONSTRAINT max_creditcard_transactions_runtime_reference_internal_not_null NOT NULL,
    runtime_reference_type integer NOT NULL,
    runtime_reference_id character varying(36),
    short_card_number character varying(4),
    spread_transaction_by_campain_ind bit(1) CONSTRAINT max_creditcard_transactions_spread_transaction_by_camp_not_null NOT NULL,
    spread_transaction_by_campain_number integer,
    table_type integer NOT NULL,
    tag character varying(10),
    uid text NOT NULL,
    up_sale_for_transaction_result character varying(10),
    user_index integer NOT NULL
);


--
-- Name: migration; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.migration (
    name text NOT NULL,
    hash text NOT NULL,
    date timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: misc_expenses; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.misc_expenses (
    id uuid DEFAULT uuidv7() NOT NULL,
    charge_id uuid NOT NULL,
    amount numeric NOT NULL,
    currency accounter_schema.currency NOT NULL,
    description text,
    creditor_id uuid NOT NULL,
    debtor_id uuid NOT NULL,
    invoice_date date NOT NULL,
    value_date timestamp without time zone NOT NULL,
    owner_id uuid NOT NULL
);

ALTER TABLE ONLY accounter_schema.misc_expenses FORCE ROW LEVEL SECURITY;


--
-- Name: otsar_hahayal_creditcard_transactions; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.otsar_hahayal_creditcard_transactions (
    id uuid DEFAULT uuidv7() NOT NULL,
    owner_id uuid,
    resource_id uuid NOT NULL,
    masked_pan text NOT NULL,
    card_type integer NOT NULL,
    billing_period text NOT NULL,
    date date NOT NULL,
    charge_date date NOT NULL,
    name text NOT NULL,
    deal_amount numeric NOT NULL,
    charge_amount numeric NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    wallet_type integer NOT NULL,
    charge_currency text NOT NULL,
    deal_currency text NOT NULL,
    counter integer DEFAULT 0 NOT NULL
);

ALTER TABLE ONLY accounter_schema.otsar_hahayal_creditcard_transactions FORCE ROW LEVEL SECURITY;


--
-- Name: otsar_hahayal_foreign_account_transactions; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.otsar_hahayal_foreign_account_transactions (
    id uuid DEFAULT uuidv7() NOT NULL,
    owner_id uuid,
    account integer NOT NULL,
    branch integer NOT NULL,
    account_type text CONSTRAINT otsar_hahayal_foreign_account_transaction_account_type_not_null NOT NULL,
    currency text NOT NULL,
    opening_balance numeric CONSTRAINT otsar_hahayal_foreign_account_transact_opening_balance_not_null NOT NULL,
    balance numeric,
    value_date date NOT NULL,
    credit numeric NOT NULL,
    debit numeric NOT NULL,
    description text NOT NULL,
    sp integer,
    reference text NOT NULL,
    date date NOT NULL,
    sub_transactions jsonb DEFAULT '[]'::jsonb CONSTRAINT otsar_hahayal_foreign_account_transac_sub_transactions_not_null NOT NULL
);

ALTER TABLE ONLY accounter_schema.otsar_hahayal_foreign_account_transactions FORCE ROW LEVEL SECURITY;


--
-- Name: otsar_hahayal_ils_account_transactions; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.otsar_hahayal_ils_account_transactions (
    id uuid DEFAULT uuidv7() NOT NULL,
    owner_id uuid,
    account_number integer NOT NULL,
    account_type integer NOT NULL,
    branch_number integer NOT NULL,
    action_code integer NOT NULL,
    bfb_source character varying(10) NOT NULL,
    closing_balance numeric NOT NULL,
    correspondent_account integer CONSTRAINT otsar_hahayal_ils_account_transa_correspondent_account_not_null NOT NULL,
    correspondent_account_type integer CONSTRAINT otsar_hahayal_ils_account_t_correspondent_account_type_not_null NOT NULL,
    correspondent_bank integer CONSTRAINT otsar_hahayal_ils_account_transacti_correspondent_bank_not_null NOT NULL,
    correspondent_branch integer CONSTRAINT otsar_hahayal_ils_account_transac_correspondent_branch_not_null NOT NULL,
    credit_amount numeric NOT NULL,
    customer_name text NOT NULL,
    date_of_business_day timestamp with time zone CONSTRAINT otsar_hahayal_ils_account_transac_date_of_business_day_not_null NOT NULL,
    date_of_registration timestamp with time zone CONSTRAINT otsar_hahayal_ils_account_transac_date_of_registration_not_null NOT NULL,
    debit_amount numeric NOT NULL,
    depositor_id integer NOT NULL,
    description text NOT NULL,
    drill_down_url text NOT NULL,
    drill_down_data jsonb,
    first_transaction_of_day boolean CONSTRAINT otsar_hahayal_ils_account_tra_first_transaction_of_day_not_null NOT NULL,
    last_transaction_of_day boolean CONSTRAINT otsar_hahayal_ils_account_tran_last_transaction_of_day_not_null NOT NULL,
    name text NOT NULL,
    opening_balance numeric NOT NULL,
    operation_source text CONSTRAINT otsar_hahayal_ils_account_transaction_operation_source_not_null NOT NULL,
    reference integer NOT NULL,
    salary_ind integer NOT NULL,
    transaction_source text CONSTRAINT otsar_hahayal_ils_account_transacti_transaction_source_not_null NOT NULL,
    transaction_reason text CONSTRAINT otsar_hahayal_ils_account_transacti_transaction_reason_not_null NOT NULL,
    origin_reference text DEFAULT ''::text CONSTRAINT otsar_hahayal_ils_account_transaction_origin_reference_not_null NOT NULL
);

ALTER TABLE ONLY accounter_schema.otsar_hahayal_ils_account_transactions FORCE ROW LEVEL SECURITY;


--
-- Name: pcn874; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.pcn874 (
    business_id uuid NOT NULL,
    month_date date NOT NULL,
    content text NOT NULL,
    owner_id uuid NOT NULL
);

ALTER TABLE ONLY accounter_schema.pcn874 FORCE ROW LEVEL SECURITY;


--
-- Name: pension_funds; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.pension_funds (
    name text NOT NULL,
    otsar_id text,
    id uuid NOT NULL,
    type text,
    management_fees numeric(9,2),
    links text[],
    bank_account_bank_number integer,
    bank_account_branch_number integer,
    bank_account_account_number integer,
    bank_account_name text,
    email text,
    managing_company_name text,
    managing_company_id text,
    emails text[],
    owner_id uuid NOT NULL
);

ALTER TABLE ONLY accounter_schema.pension_funds FORCE ROW LEVEL SECURITY;


--
-- Name: permissions; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.permissions (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE permissions; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON TABLE accounter_schema.permissions IS 'Available permissions in the system (future use - not initially enforced)';


--
-- Name: COLUMN permissions.id; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.permissions.id IS 'Permission identifier (slug format, e.g., ''manage:users'')';


--
-- Name: COLUMN permissions.name; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.permissions.name IS 'Display name for the permission (e.g., ''Manage Users'')';


--
-- Name: poalim_cad_account_transactions; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.poalim_cad_account_transactions (
    metadata_attributes_original_event_key json,
    metadata_attributes_contra_branch_number json,
    metadata_attributes_contra_account_number json,
    metadata_attributes_contra_bank_number json,
    metadata_attributes_contra_account_field_name_lable json,
    metadata_attributes_data_group_code json,
    metadata_attributes_currency_rate json,
    metadata_attributes_contra_currency_code json,
    metadata_attributes_rate_fixing_code json,
    executing_date date NOT NULL,
    formatted_executing_date character varying(24) CONSTRAINT poalim_cad_account_transactio_formatted_executing_date_not_null NOT NULL,
    value_date date NOT NULL,
    formatted_value_date character varying(24) NOT NULL,
    original_system_id integer NOT NULL,
    activity_description character varying(30) NOT NULL,
    event_amount numeric(10,2) NOT NULL,
    current_balance numeric(10,2) NOT NULL,
    reference_catenated_number integer CONSTRAINT poalim_cad_account_transact_reference_catenated_number_not_null NOT NULL,
    reference_number integer NOT NULL,
    currency_rate numeric(10,7) NOT NULL,
    event_details character varying(20),
    rate_fixing_code integer NOT NULL,
    contra_currency_code integer NOT NULL,
    event_activity_type_code integer CONSTRAINT poalim_cad_account_transactio_event_activity_type_code_not_null NOT NULL,
    transaction_type character varying(7) NOT NULL,
    rate_fixing_short_description character varying(9) CONSTRAINT poalim_cad_account_transact_rate_fixing_short_descript_not_null NOT NULL,
    currency_long_description text CONSTRAINT poalim_cad_account_transacti_currency_long_description_not_null NOT NULL,
    activity_type_code integer NOT NULL,
    event_number integer NOT NULL,
    validity_date date NOT NULL,
    comments character varying(30),
    comment_existence_switch bit(1) CONSTRAINT poalim_cad_account_transactio_comment_existence_switch_not_null NOT NULL,
    account_name character varying(30),
    contra_bank_number integer NOT NULL,
    contra_branch_number integer NOT NULL,
    contra_account_number integer NOT NULL,
    original_event_key bit(1) NOT NULL,
    contra_account_field_name_lable character varying(30),
    data_group_code bit(1) NOT NULL,
    rate_fixing_description character varying(34),
    url_address_niar character varying(30),
    currency_swift_code character varying(3) NOT NULL,
    url_address character varying(80),
    bank_number integer NOT NULL,
    branch_number integer NOT NULL,
    account_number integer NOT NULL,
    id uuid DEFAULT uuidv7() NOT NULL
);


--
-- Name: poalim_deposit_tax_events; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.poalim_deposit_tax_events (
    id uuid DEFAULT uuidv7() NOT NULL,
    owner_id uuid NOT NULL,
    bank_number integer NOT NULL,
    branch_number integer NOT NULL,
    account_number integer NOT NULL,
    event_serial_number integer NOT NULL,
    executing_date date NOT NULL,
    formatted_executing_date timestamp with time zone,
    action_type_description text NOT NULL,
    short_product_name text,
    tax_action_type_description text,
    tax_event_amount numeric NOT NULL,
    debit_currency_shorted_description text,
    debit_amount numeric NOT NULL,
    crdit_amount numeric NOT NULL,
    additional_information_existence_switch integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY accounter_schema.poalim_deposit_tax_events FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE poalim_deposit_tax_events; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON TABLE accounter_schema.poalim_deposit_tax_events IS 'Poalim deposits tax events (interest realized per deposit event, paid out or capitalized, and the tax charged / credited on it), 1:1 with savingsAndCurrentProductsTaxEvents[]';


--
-- Name: poalim_deposits_account_transactions; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.poalim_deposits_account_transactions (
    data_0_short_product_name character varying(5) CONSTRAINT poalim_deposits_account_tran_data_0_short_product_name_not_null NOT NULL,
    data_0_principal_amount numeric(8,2) CONSTRAINT poalim_deposits_account_transa_data_0_principal_amount_not_null NOT NULL,
    data_0_revalued_total_amount numeric(8,2) CONSTRAINT poalim_deposits_account_tra_data_0_revalued_total_amou_not_null NOT NULL,
    data_0_end_exit_date date CONSTRAINT poalim_deposits_account_transacti_data_0_end_exit_date_not_null NOT NULL,
    data_0_payment_date date CONSTRAINT poalim_deposits_account_transactio_data_0_payment_date_not_null NOT NULL,
    data_0_stated_annual_interest_rate bit(1) CONSTRAINT poalim_deposits_account_tra_data_0_stated_annual_inter_not_null NOT NULL,
    data_0_hebrew_purpose_description character varying(10) CONSTRAINT poalim_deposits_account_tra_data_0_hebrew_purpose_desc_not_null NOT NULL,
    data_0_objective_amount bit(1) CONSTRAINT poalim_deposits_account_transa_data_0_objective_amount_not_null NOT NULL,
    data_0_objective_date bit(1) CONSTRAINT poalim_deposits_account_transact_data_0_objective_date_not_null NOT NULL,
    data_0_agreement_opening_date date CONSTRAINT poalim_deposits_account_tra_data_0_agreement_opening_d_not_null NOT NULL,
    data_0_event_withdrawal_amount bit(1) CONSTRAINT poalim_deposits_account_tra_data_0_event_withdrawal_am_not_null NOT NULL,
    data_0_start_exit_date date CONSTRAINT poalim_deposits_account_transac_data_0_start_exit_date_not_null NOT NULL,
    data_0_period_until_next_event integer CONSTRAINT poalim_deposits_account_tra_data_0_period_until_next_e_not_null NOT NULL,
    data_0_renewal_description character varying(12) CONSTRAINT poalim_deposits_account_tra_data_0_renewal_description_not_null NOT NULL,
    data_0_requested_renewal_number bit(1) CONSTRAINT poalim_deposits_account_tra_data_0_requested_renewal_n_not_null NOT NULL,
    data_0_interest_base_description character varying(5) CONSTRAINT poalim_deposits_account_tra_data_0_interest_base_descr_not_null NOT NULL,
    data_0_interest_type_description character varying(5) CONSTRAINT poalim_deposits_account_tra_data_0_interest_type_descr_not_null NOT NULL,
    data_0_spread_percent numeric(5,2) CONSTRAINT poalim_deposits_account_transact_data_0_spread_percent_not_null NOT NULL,
    data_0_variable_interest_description character varying(22) CONSTRAINT poalim_deposits_account_tra_data_0_variable_interest_d_not_null NOT NULL,
    data_0_adjusted_interest numeric(4,2) CONSTRAINT poalim_deposits_account_trans_data_0_adjusted_interest_not_null NOT NULL,
    data_0_interest_calculating_method_description character varying(6) CONSTRAINT poalim_deposits_account_tra_data_0_interest_calculatin_not_null NOT NULL,
    data_0_interest_crediting_method_description character varying(12) CONSTRAINT poalim_deposits_account_tra_data_0_interest_crediting__not_null NOT NULL,
    data_0_interest_payment_description character varying(4) CONSTRAINT poalim_deposits_account_tra_data_0_interest_payment_de_not_null NOT NULL,
    data_0_nominal_interest numeric(4,2) CONSTRAINT poalim_deposits_account_transa_data_0_nominal_interest_not_null NOT NULL,
    data_0_deposit_serial_id integer CONSTRAINT poalim_deposits_account_trans_data_0_deposit_serial_id_not_null NOT NULL,
    data_0_linkage_base_description character varying(30),
    data_0_renewal_counter integer CONSTRAINT poalim_deposits_account_transac_data_0_renewal_counter_not_null NOT NULL,
    data_0_product_free_text character varying(30) CONSTRAINT poalim_deposits_account_trans_data_0_product_free_text_not_null NOT NULL,
    data_0_party_text_id bigint CONSTRAINT poalim_deposits_account_transacti_data_0_party_text_id_not_null NOT NULL,
    data_0_actual_index_rate bit(1) CONSTRAINT poalim_deposits_account_trans_data_0_actual_index_rate_not_null NOT NULL,
    data_0_interest_type_code integer CONSTRAINT poalim_deposits_account_tran_data_0_interest_type_code_not_null NOT NULL,
    data_0_product_number integer CONSTRAINT poalim_deposits_account_transact_data_0_product_number_not_null NOT NULL,
    data_0_product_purpose_code bit(1) CONSTRAINT poalim_deposits_account_tra_data_0_product_purpose_cod_not_null NOT NULL,
    data_0_detailed_account_type_code integer CONSTRAINT poalim_deposits_account_tra_data_0_detailed_account_ty_not_null NOT NULL,
    data_0_formatted_end_exit_date character varying(24) CONSTRAINT poalim_deposits_account_tra_data_0_formatted_end_exit__not_null NOT NULL,
    data_0_formatted_payment_date character varying(24) CONSTRAINT poalim_deposits_account_tra_data_0_formatted_payment_d_not_null NOT NULL,
    data_0_formatted_objective_date character varying(30),
    data_0_formatted_agreement_opening_date character varying(24) CONSTRAINT poalim_deposits_account_tra_data_0_formatted_agreement_not_null NOT NULL,
    data_0_formatted_start_exit_date character varying(24) CONSTRAINT poalim_deposits_account_tra_data_0_formatted_start_exi_not_null NOT NULL,
    data_0_lien_description character varying(11),
    data_0_withdrawal_enabling_indication bit(1) CONSTRAINT poalim_deposits_account_tra_data_0_withdrawal_enabling_not_null NOT NULL,
    data_0_renewal_enabling_indication bit(1) CONSTRAINT poalim_deposits_account_tra_data_0_renewal_enabling_in_not_null NOT NULL,
    data_0_standing_order_enabling_indication bit(1) CONSTRAINT poalim_deposits_account_tra_data_0_standing_order_enab_not_null NOT NULL,
    data_0_addition_enabling_indication bit(1) CONSTRAINT poalim_deposits_account_tra_data_0_addition_enabling_i_not_null NOT NULL,
    data_0_time_unit_description character varying(4) CONSTRAINT poalim_deposits_account_tra_data_0_time_unit_descripti_not_null NOT NULL,
    data_0_formatted_revalued_total_amount character varying(30),
    data_0_warning_existance_indication bit(1) CONSTRAINT poalim_deposits_account_tra_data_0_warning_existance_i_not_null NOT NULL,
    data_0_renewal_date_explanation character varying(18) CONSTRAINT poalim_deposits_account_tra_data_0_renewal_date_explan_not_null NOT NULL,
    source character varying(22) NOT NULL,
    validity_date date NOT NULL,
    validity_time integer NOT NULL,
    israeli_currency_deposit_principal_balance_amount numeric(8,2) CONSTRAINT poalim_deposits_account_tra_israeli_currency_deposit_p_not_null NOT NULL,
    deposits_revalued_amount numeric(8,2) CONSTRAINT poalim_deposits_account_trans_deposits_revalued_amount_not_null NOT NULL,
    formatted_validity_time character varying(5) CONSTRAINT poalim_deposits_account_transa_formatted_validity_time_not_null NOT NULL,
    formatted_date character varying(24) NOT NULL,
    amount numeric(8,2) NOT NULL,
    revaluated_amount numeric(8,2) NOT NULL,
    account_number integer NOT NULL,
    branch_number integer NOT NULL,
    bank_number integer NOT NULL,
    CONSTRAINT data_0_hebrew_purpose_description_enum CHECK (((data_0_hebrew_purpose_description)::text = 'לא רלוונטי'::text)),
    CONSTRAINT data_0_interest_base_description_enum CHECK (((data_0_interest_base_description)::text = 'פריים'::text)),
    CONSTRAINT data_0_interest_calculating_method_description_enum CHECK (((data_0_interest_calculating_method_description)::text = 'קו ישר'::text)),
    CONSTRAINT data_0_interest_crediting_method_description_enum CHECK (((data_0_interest_crediting_method_description)::text = 'לקרן הפיקדון'::text)),
    CONSTRAINT data_0_interest_payment_description_enum CHECK (((data_0_interest_payment_description)::text = 'תחנה'::text)),
    CONSTRAINT data_0_interest_type_description_enum CHECK (((data_0_interest_type_description)::text = 'משתנה'::text)),
    CONSTRAINT data_0_lien_description_enum CHECK (((data_0_lien_description)::text = ANY (ARRAY[('משועבד'::character varying)::text, ('מבטיח אשראי'::character varying)::text]))),
    CONSTRAINT data_0_renewal_date_explanation_enum CHECK (((data_0_renewal_date_explanation)::text = ANY (ARRAY[('תחנה קרובה'::character varying)::text, ('ייפרע לעו"ש בתאריך'::character varying)::text]))),
    CONSTRAINT data_0_renewal_description_enum CHECK (((data_0_renewal_description)::text = ANY (ARRAY[('פיקדון מתחדש'::character varying)::text, ('יפרע לעו"ש'::character varying)::text]))),
    CONSTRAINT data_0_short_product_name_enum CHECK (((data_0_short_product_name)::text = 'פריים'::text)),
    CONSTRAINT data_0_time_unit_description_enum CHECK (((data_0_time_unit_description)::text = 'ימים'::text)),
    CONSTRAINT source_enum CHECK (((source)::text = 'israeliCurrencyDeposit'::text))
);


--
-- Name: poalim_eur_account_transactions; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.poalim_eur_account_transactions (
    metadata_attributes_original_event_key json,
    metadata_attributes_contra_branch_number json,
    metadata_attributes_contra_account_number json,
    metadata_attributes_contra_bank_number json,
    metadata_attributes_contra_account_field_name_lable json,
    metadata_attributes_data_group_code json,
    metadata_attributes_currency_rate json,
    metadata_attributes_contra_currency_code json,
    metadata_attributes_rate_fixing_code json,
    executing_date date NOT NULL,
    formatted_executing_date character varying(24) CONSTRAINT poalim_eur_account_transactio_formatted_executing_date_not_null NOT NULL,
    value_date date NOT NULL,
    formatted_value_date character varying(24) NOT NULL,
    original_system_id integer NOT NULL,
    activity_description character varying(30) NOT NULL,
    event_amount numeric(10,2) NOT NULL,
    current_balance numeric(10,2) NOT NULL,
    reference_catenated_number integer CONSTRAINT poalim_eur_account_transact_reference_catenated_number_not_null NOT NULL,
    reference_number integer NOT NULL,
    currency_rate numeric(10,7) NOT NULL,
    event_details character varying(20),
    rate_fixing_code integer NOT NULL,
    contra_currency_code integer NOT NULL,
    event_activity_type_code integer CONSTRAINT poalim_eur_account_transactio_event_activity_type_code_not_null NOT NULL,
    transaction_type character varying(7) NOT NULL,
    rate_fixing_short_description character varying(9) CONSTRAINT poalim_eur_account_transact_rate_fixing_short_descript_not_null NOT NULL,
    currency_long_description text CONSTRAINT poalim_eur_account_transacti_currency_long_description_not_null NOT NULL,
    activity_type_code integer NOT NULL,
    event_number integer NOT NULL,
    validity_date date NOT NULL,
    comments character varying(30),
    comment_existence_switch bit(1) CONSTRAINT poalim_eur_account_transactio_comment_existence_switch_not_null NOT NULL,
    account_name character varying(30),
    contra_bank_number integer NOT NULL,
    contra_branch_number integer NOT NULL,
    contra_account_number integer NOT NULL,
    original_event_key bit(1) NOT NULL,
    contra_account_field_name_lable character varying(30),
    data_group_code bit(1) NOT NULL,
    rate_fixing_description character varying(34),
    url_address_niar character varying(30),
    currency_swift_code character varying(3) NOT NULL,
    url_address character varying(80),
    bank_number integer NOT NULL,
    branch_number integer NOT NULL,
    account_number integer NOT NULL,
    id uuid DEFAULT uuidv7() NOT NULL
);


--
-- Name: poalim_foreign_account_transactions; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.poalim_foreign_account_transactions (
    metadata_attributes_original_event_key json,
    metadata_attributes_contra_branch_number json,
    metadata_attributes_contra_account_number json,
    metadata_attributes_contra_bank_number json,
    metadata_attributes_contra_account_field_name_lable json,
    metadata_attributes_data_group_code json,
    metadata_attributes_currency_rate json,
    metadata_attributes_contra_currency_code json,
    metadata_attributes_rate_fixing_code json,
    executing_date date NOT NULL,
    formatted_executing_date character varying(24) CONSTRAINT poalim_foreign_account_transa_formatted_executing_date_not_null NOT NULL,
    value_date date NOT NULL,
    formatted_value_date character varying(24) CONSTRAINT poalim_foreign_account_transactio_formatted_value_date_not_null NOT NULL,
    original_system_id integer NOT NULL,
    activity_description character varying(30) CONSTRAINT poalim_foreign_account_transactio_activity_description_not_null NOT NULL,
    event_amount numeric(10,2) NOT NULL,
    currency accounter_schema.currency NOT NULL,
    current_balance numeric(10,2) NOT NULL,
    reference_catenated_number integer CONSTRAINT poalim_foreign_account_tran_reference_catenated_number_not_null NOT NULL,
    reference_number integer NOT NULL,
    currency_rate numeric(10,7) NOT NULL,
    event_details character varying(20),
    rate_fixing_code integer NOT NULL,
    contra_currency_code integer CONSTRAINT poalim_foreign_account_transactio_contra_currency_code_not_null NOT NULL,
    event_activity_type_code integer CONSTRAINT poalim_foreign_account_transa_event_activity_type_code_not_null NOT NULL,
    transaction_type character varying(7) NOT NULL,
    rate_fixing_short_description character varying(9) CONSTRAINT poalim_foreign_account_tran_rate_fixing_short_descript_not_null NOT NULL,
    currency_long_description text CONSTRAINT poalim_foreign_account_trans_currency_long_description_not_null NOT NULL,
    activity_type_code integer NOT NULL,
    event_number integer NOT NULL,
    validity_date date NOT NULL,
    comments character varying(30),
    comment_existence_switch bit(1) CONSTRAINT poalim_foreign_account_transa_comment_existence_switch_not_null NOT NULL,
    account_name character varying(30),
    contra_bank_number integer NOT NULL,
    contra_branch_number integer CONSTRAINT poalim_foreign_account_transactio_contra_branch_number_not_null NOT NULL,
    contra_account_number integer CONSTRAINT poalim_foreign_account_transacti_contra_account_number_not_null NOT NULL,
    original_event_key bit(1) NOT NULL,
    contra_account_field_name_lable character varying(30),
    data_group_code bit(1) NOT NULL,
    rate_fixing_description character varying(34),
    url_address_niar character varying(30),
    currency_swift_code character varying(3) CONSTRAINT poalim_foreign_account_transaction_currency_swift_code_not_null NOT NULL,
    url_address character varying(80),
    bank_number integer NOT NULL,
    branch_number integer NOT NULL,
    account_number integer NOT NULL,
    id uuid DEFAULT uuidv7() NOT NULL
);


--
-- Name: poalim_gbp_account_transactions; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.poalim_gbp_account_transactions (
    metadata_attributes_original_event_key json,
    metadata_attributes_contra_branch_number json,
    metadata_attributes_contra_account_number json,
    metadata_attributes_contra_bank_number json,
    metadata_attributes_contra_account_field_name_lable json,
    metadata_attributes_data_group_code json,
    metadata_attributes_currency_rate json,
    metadata_attributes_contra_currency_code json,
    metadata_attributes_rate_fixing_code json,
    executing_date date NOT NULL,
    formatted_executing_date character varying(24) CONSTRAINT poalim_gbp_account_transactio_formatted_executing_date_not_null NOT NULL,
    value_date date NOT NULL,
    formatted_value_date character varying(24) NOT NULL,
    original_system_id integer NOT NULL,
    activity_description character varying(30) NOT NULL,
    event_amount numeric(10,2) NOT NULL,
    current_balance numeric(10,2) NOT NULL,
    reference_catenated_number integer CONSTRAINT poalim_gbp_account_transact_reference_catenated_number_not_null NOT NULL,
    reference_number integer NOT NULL,
    currency_rate numeric(10,7) NOT NULL,
    event_details character varying(20),
    rate_fixing_code integer NOT NULL,
    contra_currency_code integer NOT NULL,
    event_activity_type_code integer CONSTRAINT poalim_gbp_account_transactio_event_activity_type_code_not_null NOT NULL,
    transaction_type character varying(7) NOT NULL,
    rate_fixing_short_description character varying(9) CONSTRAINT poalim_gbp_account_transact_rate_fixing_short_descript_not_null NOT NULL,
    currency_long_description text CONSTRAINT poalim_gbp_account_transacti_currency_long_description_not_null NOT NULL,
    activity_type_code integer NOT NULL,
    event_number integer NOT NULL,
    validity_date date NOT NULL,
    comments character varying(30),
    comment_existence_switch bit(1) CONSTRAINT poalim_gbp_account_transactio_comment_existence_switch_not_null NOT NULL,
    account_name character varying(30),
    contra_bank_number integer NOT NULL,
    contra_branch_number integer NOT NULL,
    contra_account_number integer NOT NULL,
    original_event_key bit(1) NOT NULL,
    contra_account_field_name_lable character varying(30),
    data_group_code bit(1) NOT NULL,
    rate_fixing_description character varying(34),
    url_address_niar character varying(30),
    currency_swift_code character varying(3) NOT NULL,
    url_address character varying(80),
    bank_number integer NOT NULL,
    branch_number integer NOT NULL,
    account_number integer NOT NULL,
    id uuid DEFAULT uuidv7() NOT NULL
);


--
-- Name: poalim_ils_account_transactions; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.poalim_ils_account_transactions (
    event_date date NOT NULL,
    formatted_event_date character varying(24) NOT NULL,
    serial_number integer NOT NULL,
    activity_type_code integer NOT NULL,
    activity_description character varying(14) NOT NULL,
    text_code integer NOT NULL,
    reference_number bigint NOT NULL,
    reference_catenated_number integer CONSTRAINT poalim_ils_account_transact_reference_catenated_number_not_null NOT NULL,
    value_date date NOT NULL,
    formatted_value_date character varying(24) NOT NULL,
    event_amount numeric(9,2) NOT NULL,
    event_activity_type_code integer CONSTRAINT poalim_ils_account_transactio_event_activity_type_code_not_null NOT NULL,
    current_balance numeric(9,2) NOT NULL,
    internal_link_code integer NOT NULL,
    original_event_create_date integer CONSTRAINT poalim_ils_account_transact_original_event_create_date_not_null NOT NULL,
    formatted_original_event_create_date character varying(30),
    transaction_type character varying(7) NOT NULL,
    data_group_code integer NOT NULL,
    beneficiary_details_data character varying(30),
    expanded_event_date bigint NOT NULL,
    executing_branch_number integer CONSTRAINT poalim_ils_account_transaction_executing_branch_number_not_null NOT NULL,
    event_id bigint NOT NULL,
    details text,
    pfm_details text,
    different_date_indication character varying(1) CONSTRAINT poalim_ils_account_transacti_different_date_indication_not_null NOT NULL,
    rejected_data_event_pertaining_indication character varying(1),
    table_number integer NOT NULL,
    record_number integer NOT NULL,
    contra_bank_number integer NOT NULL,
    contra_branch_number integer NOT NULL,
    contra_account_number integer NOT NULL,
    contra_account_type_code integer CONSTRAINT poalim_ils_account_transactio_contra_account_type_code_not_null NOT NULL,
    marketing_offer_context bit(1) CONSTRAINT poalim_ils_account_transaction_marketing_offer_context_not_null NOT NULL,
    comment_existence_switch bit(1) CONSTRAINT poalim_ils_account_transactio_comment_existence_switch_not_null NOT NULL,
    english_action_desc character varying(20),
    field_desc_display_switch bit(1) CONSTRAINT poalim_ils_account_transacti_field_desc_display_switch_not_null NOT NULL,
    url_address_niar character varying(30),
    offer_activity_context character varying(33),
    comment character varying(30),
    beneficiary_details_data_party_name character varying(24),
    beneficiary_details_data_message_headline character varying(5),
    beneficiary_details_data_party_headline character varying(6),
    beneficiary_details_data_message_detail character varying(34),
    beneficiary_details_data_table_number integer,
    beneficiary_details_data_record_number integer,
    activity_description_include_value_date character varying(33),
    bank_number integer NOT NULL,
    branch_number integer NOT NULL,
    account_number integer NOT NULL,
    id uuid DEFAULT uuidv7() NOT NULL
);


--
-- Name: COLUMN poalim_ils_account_transactions.serial_number; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.poalim_ils_account_transactions.serial_number IS 'Serial number is how we order transactions in the same day, if they have the same amount.
    Lower number is earlier in the day.
    So you can''t have multiple rows with the same date, amount and same serial number.
    This is also referenced in the end of the expanded_event_date row';


--
-- Name: COLUMN poalim_ils_account_transactions.comment_existence_switch; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.poalim_ils_account_transactions.comment_existence_switch IS 'Can change and get the same value on existing transaction again if the user added a comment';


--
-- Name: COLUMN poalim_ils_account_transactions.comment; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.poalim_ils_account_transactions.comment IS 'Can change and get the same value on existing transaction again if the user added a comment';


--
-- Name: poalim_securities; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.poalim_securities (
    id uuid DEFAULT uuidv7() NOT NULL,
    owner_id uuid NOT NULL,
    bank_number integer NOT NULL,
    branch_number integer NOT NULL,
    account_number integer NOT NULL,
    as_of_date timestamp with time zone NOT NULL,
    security_key text NOT NULL,
    eng_name text NOT NULL,
    heb_name text NOT NULL,
    item_type text NOT NULL,
    is_etf boolean,
    is_foreign boolean NOT NULL,
    currency_code text NOT NULL,
    exchange text NOT NULL,
    equity_type integer NOT NULL,
    allowed_order_direction text,
    equity_sub_type integer NOT NULL,
    eng_symbol text,
    heb_symbol text,
    symbol text,
    expiration_date text,
    stock_type text,
    creation_equity_num text,
    contract_type text
);

ALTER TABLE ONLY accounter_schema.poalim_securities FORCE ROW LEVEL SECURITY;


--
-- Name: COLUMN poalim_securities.security_key; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.poalim_securities.security_key IS 'Source field "-Key": Poalim''s security identifier, joins to AccountPosition.Balance.EquityNumber';


--
-- Name: COLUMN poalim_securities.currency_code; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.poalim_securities.currency_code IS 'Kept as TEXT rather than accounter_schema.currency for source fidelity (JPY and others appear)';


--
-- Name: COLUMN poalim_securities.expiration_date; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.poalim_securities.expiration_date IS 'Source field is always null in observed data; kept TEXT rather than DATE until the format is known';


--
-- Name: poalim_securities_transactions; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.poalim_securities_transactions (
    id uuid DEFAULT uuidv7() NOT NULL,
    owner_id uuid NOT NULL,
    bank_number integer NOT NULL,
    branch_number integer NOT NULL,
    account_number integer NOT NULL,
    security text NOT NULL,
    trade_date date NOT NULL,
    value_date date,
    settlement_date date,
    trade_type text NOT NULL,
    transaction_type text NOT NULL,
    nv numeric,
    trade_price numeric,
    net_value_trade_currency numeric,
    payment_type text,
    payment_date date,
    ex_date date,
    cancel_date date,
    isin text,
    symbol text,
    symbol_osi text,
    eng_name text,
    heb_name text,
    eng_name_full text,
    heb_name_full text,
    security_group text,
    security_sub_group text,
    issue_currency text,
    issuer_country text,
    issuer_country_code text,
    issuer_exchange text,
    exchange_country text,
    is_tradable text,
    is_us_equity text,
    is_jumbo boolean,
    implied_asset_mult numeric,
    expiry_date text,
    trade_currency text,
    settlement_currency text,
    commissions_currency text,
    payment_currency text,
    trade_gross_value_trade_currency numeric,
    trade_gross_value_nis numeric,
    net_value_nis numeric,
    net_value_settlement_currency numeric,
    settlement_price numeric,
    trade_commission_percent numeric,
    trade_commission_value_nis numeric,
    trade_commission_value_trade_currency numeric,
    agent_commission_value_trade_currency numeric,
    management_fees_percent numeric,
    management_fees_value_nis numeric,
    management_fees_value_trade_currency numeric,
    israe_tax_value numeric,
    israel_tax_percent numeric,
    israel_tax_value_by_payments_settlement_currency numeric,
    foreign_tax_percent numeric,
    foreign_tax_value_settlement_currency numeric,
    capital_tax_percent numeric,
    capital_tax_value_settlement_currency numeric,
    post_deduction_tax_value_nis numeric,
    previous_actions_deductions numeric,
    post_action_deduction_balance numeric,
    nominal_profit_loss_nis numeric,
    nominal_profit_loss_linkage numeric,
    real_profit_loss_nis numeric,
    accumulated_interest numeric,
    fund_plus_accumulated_inerest_value numeric,
    peyment_pecentage numeric,
    payment_linking_value numeric,
    ex_date_balance numeric,
    issue_currency_to_trade_currency_rate numeric,
    trade_currnecy_rate numeric,
    personal_currency_rate numeric,
    payment_name text,
    order_origin text,
    order_type text,
    order_subject text,
    ordered_nv numeric,
    executed_nv numeric,
    ordered_value numeric,
    execution_date date,
    last_tranaction_date date,
    is_cancel_transaction text,
    executing_branch text,
    financial_account_branch text,
    financial_account_number text,
    account_name text,
    occurrence smallint DEFAULT 1 NOT NULL
);

ALTER TABLE ONLY accounter_schema.poalim_securities_transactions FORCE ROW LEVEL SECURITY;


--
-- Name: COLUMN poalim_securities_transactions.security; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.poalim_securities_transactions.security IS 'Source field "Security": Poalim''s security identifier, joins to accounter_schema.poalim_securities.security_key';


--
-- Name: COLUMN poalim_securities_transactions.expiry_date; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.poalim_securities_transactions.expiry_date IS 'Source field is always null in observed data; kept TEXT rather than TIMESTAMPTZ until the format is known';


--
-- Name: COLUMN poalim_securities_transactions.israe_tax_value; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.poalim_securities_transactions.israe_tax_value IS 'Source field "IsraeTaxValue" — the missing "l" is the bank''s, kept for source fidelity';


--
-- Name: COLUMN poalim_securities_transactions.fund_plus_accumulated_inerest_value; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.poalim_securities_transactions.fund_plus_accumulated_inerest_value IS 'Source field "FundPlusAccumulatedInerestValue" — spelling is the bank''s, kept for source fidelity';


--
-- Name: COLUMN poalim_securities_transactions.peyment_pecentage; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.poalim_securities_transactions.peyment_pecentage IS 'Source field "PeymentPecentage" — spelling is the bank''s, kept for source fidelity';


--
-- Name: COLUMN poalim_securities_transactions.trade_currnecy_rate; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.poalim_securities_transactions.trade_currnecy_rate IS 'Source field "TradeCurrnecyRate" — spelling is the bank''s, kept for source fidelity';


--
-- Name: COLUMN poalim_securities_transactions.execution_date; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.poalim_securities_transactions.execution_date IS 'The bank sends the sentinel 0001-01-01 for executions with no recorded execution date';


--
-- Name: COLUMN poalim_securities_transactions.last_tranaction_date; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.poalim_securities_transactions.last_tranaction_date IS 'Source field "LastTranactionDate" — spelling is the bank''s, kept for source fidelity';


--
-- Name: COLUMN poalim_securities_transactions.occurrence; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.poalim_securities_transactions.occurrence IS 'Ordinal (1..n) among executions that share every other dedup-key field. The response has no per-execution id, so this is what keeps two same-day, same-size executions apart';


--
-- Name: poalim_swift_account_transactions; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.poalim_swift_account_transactions (
    start_date text,
    formatted_start_date text,
    swift_status_code text,
    swift_status_desc text,
    amount text,
    currency_code_catenated_key text,
    currency_long_description text,
    charge_party_name text,
    reference_number text,
    transfer_catenated_id text,
    data_origin_code text,
    swift_isn_serial_number text,
    swift_bank_code text,
    order_customer_name text,
    beneficiary_english_street_name text,
    beneficiary_english_city_name text,
    beneficiary_english_country_name text,
    swift_senders_reference_20 text,
    swift_bank_operation_code_23b text,
    swift_value_date_currency_amount_32a text,
    swift_currency_instructed_amount_33b text,
    swift_ordering_customer_50k_1 text,
    swift_ordering_customer_50k_2 text,
    swift_ordering_customer_50k_3 text,
    swift_ordering_customer_50k_4 text,
    swift_ordering_customer_50k_5 text,
    swift_ordering_institution_52a text,
    swift_senders_correspondent_53a text,
    swift_beneficiary_customer_59_1 text,
    swift_beneficiary_customer_59_2 text,
    swift_beneficiary_customer_59_3 text,
    swift_beneficiary_customer_59_4 text,
    swift_beneficiary_customer_59_5 text,
    swift_remittance_information_70_1 text,
    swift_remittance_information_70_2 text,
    swift_details_of_charges_71a text,
    account_number integer,
    branch_number integer,
    bank_number integer,
    swift_senders_charges_71f text,
    swift_ordering_institution_52d_1 text,
    swift_ordering_institution_52d_2 text,
    swift_ordering_institution_52d_3 text,
    swift_receivers_correspondent_54a text,
    id uuid DEFAULT uuidv7() NOT NULL,
    swift_instruction_code_23e text,
    swift_exchange_rate_36 text,
    swift_account_with_institution_57 text,
    swift_senders_to_receiver_information_72 text,
    swift_regulatory_reporting_77b text,
    swift_ordering_customer_50k text,
    swift_ordering_institution_52d text,
    swift_beneficiary_customer_59 text,
    swift_remittance_information_70 text,
    document_type_code integer
);


--
-- Name: poalim_usd_account_transactions; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.poalim_usd_account_transactions (
    metadata_attributes_original_event_key json,
    metadata_attributes_contra_branch_number json,
    metadata_attributes_contra_account_number json,
    metadata_attributes_contra_bank_number json,
    metadata_attributes_contra_account_field_name_lable json,
    metadata_attributes_data_group_code json,
    metadata_attributes_currency_rate json,
    metadata_attributes_contra_currency_code json,
    metadata_attributes_rate_fixing_code json,
    executing_date date NOT NULL,
    formatted_executing_date character varying(24) CONSTRAINT poalim_usd_account_transactio_formatted_executing_date_not_null NOT NULL,
    value_date date NOT NULL,
    formatted_value_date character varying(24) NOT NULL,
    original_system_id integer NOT NULL,
    activity_description character varying(30) NOT NULL,
    event_amount numeric(10,2) NOT NULL,
    current_balance numeric(10,2) NOT NULL,
    reference_catenated_number integer CONSTRAINT poalim_usd_account_transact_reference_catenated_number_not_null NOT NULL,
    reference_number integer NOT NULL,
    currency_rate numeric(10,7) NOT NULL,
    event_details character varying(20),
    rate_fixing_code integer NOT NULL,
    contra_currency_code integer NOT NULL,
    event_activity_type_code integer CONSTRAINT poalim_usd_account_transactio_event_activity_type_code_not_null NOT NULL,
    transaction_type character varying(7) NOT NULL,
    rate_fixing_short_description character varying(9) CONSTRAINT poalim_usd_account_transact_rate_fixing_short_descript_not_null NOT NULL,
    currency_long_description text CONSTRAINT poalim_usd_account_transacti_currency_long_description_not_null NOT NULL,
    activity_type_code integer NOT NULL,
    event_number integer NOT NULL,
    validity_date date NOT NULL,
    comments character varying(30),
    comment_existence_switch bit(1) CONSTRAINT poalim_usd_account_transactio_comment_existence_switch_not_null NOT NULL,
    account_name character varying(30),
    contra_bank_number integer NOT NULL,
    contra_branch_number integer NOT NULL,
    contra_account_number integer NOT NULL,
    original_event_key bit(1) NOT NULL,
    contra_account_field_name_lable character varying(30),
    data_group_code bit(1) NOT NULL,
    rate_fixing_description character varying(34),
    url_address_niar character varying(30),
    currency_swift_code character varying(3) NOT NULL,
    url_address character varying(80),
    bank_number integer NOT NULL,
    branch_number integer NOT NULL,
    account_number integer NOT NULL,
    id uuid DEFAULT uuidv7() NOT NULL
);


--
-- Name: price_index_bases; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.price_index_bases (
    index_code integer NOT NULL,
    base_label text NOT NULL,
    first_period date NOT NULL,
    chain_coefficient numeric,
    chained_factor numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT price_index_bases_first_period_check CHECK ((EXTRACT(day FROM first_period) = (1)::numeric))
);


--
-- Name: COLUMN price_index_bases.chain_coefficient; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.price_index_bases.chain_coefficient IS 'CBS coefficient linking this base to the previous one; NULL for the oldest base';


--
-- Name: COLUMN price_index_bases.chained_factor; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.price_index_bases.chained_factor IS 'Product of chain coefficients down to the oldest base; value * chained_factor = chained value';


--
-- Name: price_index_values; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.price_index_values (
    index_code integer NOT NULL,
    period date NOT NULL,
    value numeric NOT NULL,
    base_label text NOT NULL,
    chained_value numeric NOT NULL,
    monthly_change_pct numeric,
    yearly_change_pct numeric,
    published_on date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT price_index_values_period_check CHECK ((EXTRACT(day FROM period) = (1)::numeric))
);


--
-- Name: COLUMN price_index_values.value; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.price_index_values.value IS 'Index value as published by CBS, in base_label';


--
-- Name: COLUMN price_index_values.published_on; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.price_index_values.published_on IS 'Publication date; the index is the "known" index from the following day (Income Tax Ordinance s.88)';


--
-- Name: provider_credentials; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.provider_credentials (
    owner_id uuid NOT NULL,
    provider accounter_schema.provider_key NOT NULL,
    payload text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    business_id uuid
);

ALTER TABLE ONLY accounter_schema.provider_credentials FORCE ROW LEVEL SECURITY;


--
-- Name: recovery; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.recovery (
    year integer NOT NULL,
    day_value numeric(6,2) NOT NULL
);


--
-- Name: report_1214_profiles; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.report_1214_profiles (
    owner_id uuid NOT NULL,
    year smallint NOT NULL,
    company jsonb DEFAULT '{}'::jsonb NOT NULL,
    declarations jsonb DEFAULT '{}'::jsonb NOT NULL,
    preparer jsonb DEFAULT '{}'::jsonb NOT NULL,
    attachments jsonb DEFAULT '{}'::jsonb NOT NULL,
    bank_account jsonb DEFAULT '{}'::jsonb NOT NULL,
    other_taxable_income jsonb DEFAULT '{}'::jsonb NOT NULL,
    capital_gains_summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    qualifying_company jsonb DEFAULT '{}'::jsonb NOT NULL,
    related_companies jsonb DEFAULT '[]'::jsonb NOT NULL,
    rd_investments jsonb DEFAULT '[]'::jsonb NOT NULL,
    amount_overrides jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT report_1214_profiles_arrays_check CHECK (((jsonb_typeof(related_companies) = 'array'::text) AND (jsonb_typeof(rd_investments) = 'array'::text))),
    CONSTRAINT report_1214_profiles_objects_check CHECK (((jsonb_typeof(company) = 'object'::text) AND (jsonb_typeof(declarations) = 'object'::text) AND (jsonb_typeof(preparer) = 'object'::text) AND (jsonb_typeof(attachments) = 'object'::text) AND (jsonb_typeof(bank_account) = 'object'::text) AND (jsonb_typeof(other_taxable_income) = 'object'::text) AND (jsonb_typeof(capital_gains_summary) = 'object'::text) AND (jsonb_typeof(qualifying_company) = 'object'::text) AND (jsonb_typeof(amount_overrides) = 'object'::text))),
    CONSTRAINT report_1214_profiles_year_check CHECK (((year >= 2000) AND (year <= 2100)))
);

ALTER TABLE ONLY accounter_schema.report_1214_profiles FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE report_1214_profiles; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON TABLE accounter_schema.report_1214_profiles IS 'Form 1214 (OPCN 1214) user-entered data per owner and tax year. JSONB shapes mirror the camelCase input types of @accounter/opcn1214-generator (src/model/input.ts, Report1214Input).';


--
-- Name: COLUMN report_1214_profiles.company; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.report_1214_profiles.company IS 'Overrides and extras for CompanyDetails (phone, fax, email, occupation, mailing / business / books addresses).';


--
-- Name: COLUMN report_1214_profiles.declarations; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.report_1214_profiles.declarations IS 'Report1214Input.declarations (Declarations).';


--
-- Name: COLUMN report_1214_profiles.preparer; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.report_1214_profiles.preparer IS 'Report1214Input.preparer (PreparerDetails); {} when there is none.';


--
-- Name: COLUMN report_1214_profiles.attachments; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.report_1214_profiles.attachments IS 'Report1214Input.attachments (certificate counts).';


--
-- Name: COLUMN report_1214_profiles.bank_account; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.report_1214_profiles.bank_account IS 'Report1214Input.bankAccount ({ bank, branch, account }); {} when the account on file is unchanged.';


--
-- Name: COLUMN report_1214_profiles.other_taxable_income; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.report_1214_profiles.other_taxable_income IS 'Report1214Input.otherTaxableIncome.';


--
-- Name: COLUMN report_1214_profiles.capital_gains_summary; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.report_1214_profiles.capital_gains_summary IS 'Report1214Input.capitalGainsSummary.';


--
-- Name: COLUMN report_1214_profiles.qualifying_company; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.report_1214_profiles.qualifying_company IS 'Report1214Input.qualifyingCompany.';


--
-- Name: COLUMN report_1214_profiles.related_companies; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.report_1214_profiles.related_companies IS 'Report1214Input.relatedCompanies (RelatedCompany[], at most 3, validated by the generator).';


--
-- Name: COLUMN report_1214_profiles.rd_investments; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.report_1214_profiles.rd_investments IS 'Report1214Input.rdInvestments (RdInvestment[], at most 5, validated by the generator).';


--
-- Name: COLUMN report_1214_profiles.amount_overrides; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.report_1214_profiles.amount_overrides IS 'Main-form amounts entered by hand, { "<code>": number }; they win over computed amounts.';


--
-- Name: role_permissions; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.role_permissions (
    role_id text NOT NULL,
    permission_id text NOT NULL
);


--
-- Name: TABLE role_permissions; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON TABLE accounter_schema.role_permissions IS 'Default permission sets for roles (future use - not initially enforced)';


--
-- Name: roles; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.roles (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE roles; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON TABLE accounter_schema.roles IS 'Available roles in the system (e.g., business_owner, accountant, employee, scraper)';


--
-- Name: COLUMN roles.id; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.roles.id IS 'Role identifier (slug format, e.g., ''business_owner'')';


--
-- Name: COLUMN roles.name; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.roles.name IS 'Display name for the role (e.g., ''Business Owner'')';


--
-- Name: salaries; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.salaries (
    direct_payment_amount numeric(9,2) NOT NULL,
    employee text,
    employer uuid NOT NULL,
    month text NOT NULL,
    base_salary numeric(9,2),
    social_security_amount_employee numeric(9,2),
    health_payment_amount numeric(9,2),
    tax_amount numeric(9,2),
    pension_employer_amount numeric(9,2),
    pension_employee_amount numeric(9,2),
    vacation_days_balance numeric(9,2),
    sickness_days_balance numeric(9,2),
    pension_employee_percentage real,
    pension_employer_percentage real,
    compensations_employer_percentage real,
    training_fund_employer_amount numeric(9,2),
    training_fund_employee_amount numeric(9,2),
    training_fund_employer_percentage real,
    training_fund_employee_percentage real,
    compensations_employer_amount numeric(9,2),
    pension_fund_id uuid,
    training_fund_id uuid,
    work_days numeric(9,2),
    hours numeric(9,2),
    hourly_rate numeric(9,2),
    added_vacation_days numeric(9,2),
    social_security_amount_employer numeric(9,2),
    global_additional_hours numeric(9,2),
    zkufot integer,
    employee_id uuid NOT NULL,
    recovery numeric(9,2),
    gift numeric(9,2),
    bonus numeric(9,2),
    vacation_takeout numeric(9,2),
    charge_id uuid,
    job_percentage numeric(5,2) DEFAULT 100 NOT NULL,
    travel_and_subsistence numeric(9,2),
    owner_id uuid NOT NULL
);

ALTER TABLE ONLY accounter_schema.salaries FORCE ROW LEVEL SECURITY;


--
-- Name: security_identifiers; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.security_identifiers (
    id uuid DEFAULT uuidv7() NOT NULL,
    owner_id uuid NOT NULL,
    business_id uuid NOT NULL,
    identifier_type accounter_schema.security_identifier_type NOT NULL,
    identifier_value text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY accounter_schema.security_identifiers FORCE ROW LEVEL SECURITY;


--
-- Name: shareholders; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.shareholders (
    id uuid DEFAULT uuidv7() NOT NULL,
    owner_id uuid NOT NULL,
    year smallint NOT NULL,
    business_id uuid,
    id_number character varying(9) NOT NULL,
    full_name text NOT NULL,
    is_controlling boolean DEFAULT false NOT NULL,
    dividend_rights_percent numeric(7,4),
    voting_rights_percent numeric(7,4),
    other_rights_percent numeric(7,4),
    is_material boolean,
    salary_months_1_to_9 numeric,
    salary_months_10_to_12 numeric,
    other_payments numeric,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shareholders_dividend_rights_percent_check CHECK (((dividend_rights_percent >= (0)::numeric) AND (dividend_rights_percent <= (100)::numeric))),
    CONSTRAINT shareholders_id_number_check CHECK (((id_number)::text ~ '^[0-9]{9}$'::text)),
    CONSTRAINT shareholders_other_rights_percent_check CHECK (((other_rights_percent >= (0)::numeric) AND (other_rights_percent <= (100)::numeric))),
    CONSTRAINT shareholders_voting_rights_percent_check CHECK (((voting_rights_percent >= (0)::numeric) AND (voting_rights_percent <= (100)::numeric))),
    CONSTRAINT shareholders_year_check CHECK (((year >= 2000) AND (year <= 2100)))
);

ALTER TABLE ONLY accounter_schema.shareholders FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE shareholders; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON TABLE accounter_schema.shareholders IS 'Shareholders per owner and tax year (form 1214 records 1020, reusable by 1214b and dividends). Columns mirror Shareholder in @accounter/opcn1214-generator (src/model/input.ts).';


--
-- Name: COLUMN shareholders.business_id; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.shareholders.business_id IS 'Optional link to the shareholder''s own financial entity.';


--
-- Name: COLUMN shareholders.id_number; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.shareholders.id_number IS 'Israeli ID or company number, stored zero-padded to 9 digits (the generator accepts 1-9 digits and pads them), or a shared placeholder: 999999964 (not registered in Israel) / 999999998 (public holding). Unique per owner and year except for the placeholders.';


--
-- Name: COLUMN shareholders.sort_order; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.shareholders.sort_order IS 'Order of the shareholder in the report.';


--
-- Name: sort_codes; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.sort_codes (
    key integer NOT NULL,
    name text NOT NULL,
    default_irs_code smallint,
    owner_id uuid NOT NULL
);

ALTER TABLE ONLY accounter_schema.sort_codes FORCE ROW LEVEL SECURITY;


--
-- Name: super_admins; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.super_admins (
    auth0_user_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    note text
);

ALTER TABLE ONLY accounter_schema.super_admins FORCE ROW LEVEL SECURITY;


--
-- Name: tax_categories; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.tax_categories (
    id uuid DEFAULT uuidv7() NOT NULL,
    hashavshevet_name text,
    tax_excluded boolean DEFAULT false NOT NULL,
    owner_id uuid NOT NULL
);

ALTER TABLE ONLY accounter_schema.tax_categories FORCE ROW LEVEL SECURITY;


--
-- Name: transactions_raw_list; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.transactions_raw_list (
    id uuid DEFAULT uuidv7() NOT NULL,
    creditcard_id uuid,
    poalim_ils_id uuid,
    kraken_id text,
    etana_id text,
    etherscan_id uuid,
    poalim_swift_id uuid,
    amex_id uuid,
    cal_id uuid,
    bank_discount_id uuid,
    max_creditcard_id uuid,
    poalim_foreign_id uuid,
    otsar_hahayal_ils_id uuid,
    otsar_hahayal_foreign_id uuid,
    otsar_hahayal_creditcard_id uuid,
    CONSTRAINT transactions_raw_list_check CHECK (((((((((((((((((creditcard_id IS NOT NULL))::integer + ((poalim_ils_id IS NOT NULL))::integer) + ((poalim_foreign_id IS NOT NULL))::integer) + ((poalim_swift_id IS NOT NULL))::integer) + ((kraken_id IS NOT NULL))::integer) + ((etana_id IS NOT NULL))::integer) + ((etherscan_id IS NOT NULL))::integer) + ((amex_id IS NOT NULL))::integer) + ((cal_id IS NOT NULL))::integer) + ((bank_discount_id IS NOT NULL))::integer) + ((max_creditcard_id IS NOT NULL))::integer) + ((otsar_hahayal_ils_id IS NOT NULL))::integer) + ((otsar_hahayal_foreign_id IS NOT NULL))::integer) + ((otsar_hahayal_creditcard_id IS NOT NULL))::integer) = 1))
);


--
-- Name: user_context; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.user_context (
    owner_id uuid NOT NULL,
    default_local_currency accounter_schema.currency DEFAULT 'ILS'::accounter_schema.currency NOT NULL,
    default_fiat_currency_for_crypto_conversions accounter_schema.currency DEFAULT 'USD'::accounter_schema.currency CONSTRAINT user_context_default_fiat_currency_for_crypto_conversi_not_null NOT NULL,
    default_tax_category_id uuid NOT NULL,
    vat_business_id uuid NOT NULL,
    input_vat_tax_category_id uuid NOT NULL,
    output_vat_tax_category_id uuid NOT NULL,
    tax_business_id uuid NOT NULL,
    tax_expenses_tax_category_id uuid NOT NULL,
    social_security_business_id uuid NOT NULL,
    exchange_rate_tax_category_id uuid NOT NULL,
    income_exchange_rate_tax_category_id uuid NOT NULL,
    exchange_rate_revaluation_tax_category_id uuid NOT NULL,
    fee_tax_category_id uuid NOT NULL,
    general_fee_tax_category_id uuid NOT NULL,
    fine_tax_category_id uuid NOT NULL,
    untaxable_gifts_tax_category_id uuid NOT NULL,
    balance_cancellation_tax_category_id uuid NOT NULL,
    development_foreign_tax_category_id uuid NOT NULL,
    development_local_tax_category_id uuid NOT NULL,
    accumulated_depreciation_tax_category_id uuid,
    rnd_depreciation_expenses_tax_category_id uuid,
    gnm_depreciation_expenses_tax_category_id uuid,
    marketing_depreciation_expenses_tax_category_id uuid,
    bank_deposit_interest_income_tax_category_id uuid,
    business_trip_tax_category_id uuid,
    business_trip_tag_id uuid,
    expenses_to_pay_tax_category_id uuid NOT NULL,
    expenses_in_advance_tax_category_id uuid NOT NULL,
    income_to_collect_tax_category_id uuid NOT NULL,
    income_in_advance_tax_category_id uuid,
    zkufot_expenses_tax_category_id uuid,
    zkufot_income_tax_category_id uuid,
    social_security_expenses_tax_category_id uuid,
    salary_expenses_tax_category_id uuid,
    training_fund_expenses_tax_category_id uuid,
    pension_fund_expenses_tax_category_id uuid,
    compensation_fund_expenses_tax_category_id uuid,
    batched_employees_business_id uuid,
    batched_funds_business_id uuid,
    tax_deductions_business_id uuid,
    recovery_reserve_expenses_tax_category_id uuid,
    recovery_reserve_tax_category_id uuid,
    vacation_reserve_expenses_tax_category_id uuid,
    vacation_reserve_tax_category_id uuid,
    poalim_business_id uuid,
    discount_business_id uuid,
    isracard_business_id uuid,
    amex_business_id uuid,
    cal_business_id uuid,
    etana_business_id uuid,
    kraken_business_id uuid,
    etherscan_business_id uuid,
    swift_business_id uuid,
    bank_deposit_business_id uuid,
    dividend_withholding_tax_business_id uuid,
    dividend_tax_category_id uuid,
    salary_excess_expenses_tax_category_id uuid NOT NULL,
    ledger_lock date,
    foreign_securities_business_id uuid,
    foreign_securities_fees_category_id uuid,
    locality character varying(3) DEFAULT 'ISR'::character varying NOT NULL,
    property_output_vat_tax_category_id uuid,
    date_established date,
    initial_accounter_year smallint,
    otsar_hahayal_business_id uuid,
    otsar_hahayal_credit_card_business_id uuid,
    securities_context jsonb DEFAULT '{}'::jsonb NOT NULL,
    bank_deposit_withholding_tax_category_id uuid,
    depreciation_disposal_gain_tax_category_id uuid,
    depreciation_disposal_loss_tax_category_id uuid,
    depreciation_correction_tax_category_id uuid,
    CONSTRAINT user_context_securities_context_is_object CHECK ((jsonb_typeof(securities_context) = 'object'::text))
);

ALTER TABLE ONLY accounter_schema.user_context FORCE ROW LEVEL SECURITY;


--
-- Name: COLUMN user_context.foreign_securities_business_id; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.user_context.foreign_securities_business_id IS 'DEPRECATED: superseded by securities_context.foreignSecuritiesBusinessId. No longer read or written by the server; kept for rollback until it is dropped.';


--
-- Name: COLUMN user_context.foreign_securities_fees_category_id; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON COLUMN accounter_schema.user_context.foreign_securities_fees_category_id IS 'DEPRECATED: superseded by securities_context.taxCategories.foreignSecuritiesFees. No longer read or written by the server; kept for rollback until it is dropped.';


--
-- Name: user_permission_overrides; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.user_permission_overrides (
    id uuid DEFAULT uuidv7() NOT NULL,
    user_id uuid NOT NULL,
    business_id uuid NOT NULL,
    permission_id text NOT NULL,
    grant_type accounter_schema.grant_type_enum NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE user_permission_overrides; Type: COMMENT; Schema: accounter_schema; Owner: -
--

COMMENT ON TABLE accounter_schema.user_permission_overrides IS 'User-specific permission overrides (future use - not initially enforced)';


--
-- Name: users; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.users (
    name text NOT NULL,
    id uuid NOT NULL,
    created timestamp with time zone DEFAULT now() NOT NULL,
    role text
);


--
-- Name: vat_value; Type: TABLE; Schema: accounter_schema; Owner: -
--

CREATE TABLE accounter_schema.vat_value (
    date date NOT NULL,
    percentage numeric(3,2) NOT NULL
);


--
-- Name: amex_creditcard_transactions amex_creditcard_transactions_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.amex_creditcard_transactions
    ADD CONSTRAINT amex_creditcard_transactions_pk PRIMARY KEY (id);


--
-- Name: annual_audit_step_status annual_audit_step_status_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.annual_audit_step_status
    ADD CONSTRAINT annual_audit_step_status_pk PRIMARY KEY (owner_id, year, step_id);


--
-- Name: api_key_permission_overrides api_key_permission_overrides_api_key_id_permission_id_key; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.api_key_permission_overrides
    ADD CONSTRAINT api_key_permission_overrides_api_key_id_permission_id_key UNIQUE (api_key_id, permission_id);


--
-- Name: api_key_permission_overrides api_key_permission_overrides_pkey; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.api_key_permission_overrides
    ADD CONSTRAINT api_key_permission_overrides_pkey PRIMARY KEY (id);


--
-- Name: api_keys api_keys_key_hash_key; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.api_keys
    ADD CONSTRAINT api_keys_key_hash_key UNIQUE (key_hash);


--
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: bank_deposits bank_deposits_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.bank_deposits
    ADD CONSTRAINT bank_deposits_pk PRIMARY KEY (id);


--
-- Name: bank_discount_transactions bank_discount_transactions_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.bank_discount_transactions
    ADD CONSTRAINT bank_discount_transactions_pk PRIMARY KEY (id);


--
-- Name: business_tax_category_match business_tax_category_match_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_tax_category_match
    ADD CONSTRAINT business_tax_category_match_pk PRIMARY KEY (business_id, owner_id);


--
-- Name: business_trip_charges business_trip_charges_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_trip_charges
    ADD CONSTRAINT business_trip_charges_pk PRIMARY KEY (charge_id);


--
-- Name: business_trips_attendees business_trips_attendees_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_trips_attendees
    ADD CONSTRAINT business_trips_attendees_pk PRIMARY KEY (business_trip_id, attendee_business_id);


--
-- Name: business_trips_employee_payments business_trips_employee_payments_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_trips_employee_payments
    ADD CONSTRAINT business_trips_employee_payments_pk PRIMARY KEY (id);


--
-- Name: business_trips_tax_variables business_trips_tax_variables_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_trips_tax_variables
    ADD CONSTRAINT business_trips_tax_variables_pk PRIMARY KEY (date);


--
-- Name: business_trips_transactions_accommodations business_trips_transactions_accommodations_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_trips_transactions_accommodations
    ADD CONSTRAINT business_trips_transactions_accommodations_pk PRIMARY KEY (id);


--
-- Name: business_trips_transactions_car_rental business_trips_transactions_car_rental_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_trips_transactions_car_rental
    ADD CONSTRAINT business_trips_transactions_car_rental_pk PRIMARY KEY (id);


--
-- Name: business_trips_transactions_flights business_trips_transactions_flights_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_trips_transactions_flights
    ADD CONSTRAINT business_trips_transactions_flights_pk PRIMARY KEY (id);


--
-- Name: business_trips_transactions_other business_trips_transactions_other_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_trips_transactions_other
    ADD CONSTRAINT business_trips_transactions_other_pk PRIMARY KEY (id);


--
-- Name: business_trips_transactions business_trips_transactions_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_trips_transactions
    ADD CONSTRAINT business_trips_transactions_pk PRIMARY KEY (id);


--
-- Name: business_trips_transactions_tns business_trips_transactions_tns_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_trips_transactions_tns
    ADD CONSTRAINT business_trips_transactions_tns_pk PRIMARY KEY (id);


--
-- Name: business_users business_users_pkey; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_users
    ADD CONSTRAINT business_users_pkey PRIMARY KEY (user_id, business_id);


--
-- Name: businesses_admin businesses_admin_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.businesses_admin
    ADD CONSTRAINT businesses_admin_pk PRIMARY KEY (id);


--
-- Name: clients businesses_green_invoice_match_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.clients
    ADD CONSTRAINT businesses_green_invoice_match_pk PRIMARY KEY (business_id);


--
-- Name: clients businesses_green_invoice_match_pk_2; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.clients
    ADD CONSTRAINT businesses_green_invoice_match_pk_2 UNIQUE (green_invoice_id);


--
-- Name: businesses businesses_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.businesses
    ADD CONSTRAINT businesses_pk PRIMARY KEY (id);


--
-- Name: businesses_securities businesses_securities_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.businesses_securities
    ADD CONSTRAINT businesses_securities_pk PRIMARY KEY (id);


--
-- Name: cal_creditcard_transactions cal_creditcard_transactions_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.cal_creditcard_transactions
    ADD CONSTRAINT cal_creditcard_transactions_pk PRIMARY KEY (id);


--
-- Name: cal_creditcard_transactions cal_creditcard_transactions_trn_int_id_idx; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.cal_creditcard_transactions
    ADD CONSTRAINT cal_creditcard_transactions_trn_int_id_idx UNIQUE (trn_int_id);


--
-- Name: charge_unbalanced_ledger_businesses charge-unbalanced-ledger-businesses_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.charge_unbalanced_ledger_businesses
    ADD CONSTRAINT "charge-unbalanced-ledger-businesses_pk" PRIMARY KEY (charge_id, business_id);


--
-- Name: charge_balance_cancellation charge_balance_cancellation_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.charge_balance_cancellation
    ADD CONSTRAINT charge_balance_cancellation_pk PRIMARY KEY (charge_id, business_id);


--
-- Name: charge_spread charge_spread_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.charge_spread
    ADD CONSTRAINT charge_spread_pk PRIMARY KEY (charge_id, year_of_relevance);


--
-- Name: charge_tags charge_tags_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.charge_tags
    ADD CONSTRAINT charge_tags_pk PRIMARY KEY (charge_id, tag_id);


--
-- Name: charges_bank_deposits charges_bank_deposits_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.charges_bank_deposits
    ADD CONSTRAINT charges_bank_deposits_pk PRIMARY KEY (id);


--
-- Name: charges charges_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.charges
    ADD CONSTRAINT charges_pk PRIMARY KEY (id);


--
-- Name: charges_securities_executions charges_securities_executions_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.charges_securities_executions
    ADD CONSTRAINT charges_securities_executions_pk PRIMARY KEY (execution_id);


--
-- Name: clients_contracts clients_contracts_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.clients_contracts
    ADD CONSTRAINT clients_contracts_pk PRIMARY KEY (id);


--
-- Name: corporate_tax_variables corporate_tax_variables_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.corporate_tax_variables
    ADD CONSTRAINT corporate_tax_variables_pk PRIMARY KEY (corporate_id, date);


--
-- Name: countries countries_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.countries
    ADD CONSTRAINT countries_pk PRIMARY KEY (code);


--
-- Name: countries countries_pk_2; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.countries
    ADD CONSTRAINT countries_pk_2 UNIQUE (name);


--
-- Name: crypto_currencies crypto_currencies_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.crypto_currencies
    ADD CONSTRAINT crypto_currencies_pk PRIMARY KEY (symbol);


--
-- Name: crypto_exchange_rates crypto_exchange_rates_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.crypto_exchange_rates
    ADD CONSTRAINT crypto_exchange_rates_pk UNIQUE (date, coin_symbol);


--
-- Name: crypto_exchange_rates crypto_exchange_rates_pk_2; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.crypto_exchange_rates
    ADD CONSTRAINT crypto_exchange_rates_pk_2 PRIMARY KEY (date, coin_symbol, against);


--
-- Name: deel_invoices deel_invoices_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.deel_invoices
    ADD CONSTRAINT deel_invoices_pk PRIMARY KEY (id);


--
-- Name: deel_workers deel_workers_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.deel_workers
    ADD CONSTRAINT deel_workers_pk PRIMARY KEY (contract_id);


--
-- Name: depreciation_categories depreciation_categories_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.depreciation_categories
    ADD CONSTRAINT depreciation_categories_pk PRIMARY KEY (id);


--
-- Name: depreciation_disposals depreciation_disposals_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.depreciation_disposals
    ADD CONSTRAINT depreciation_disposals_pk PRIMARY KEY (id);


--
-- Name: depreciation depreciation_owner_id_unique; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.depreciation
    ADD CONSTRAINT depreciation_owner_id_unique UNIQUE (owner_id, id);


--
-- Name: depreciation depreciation_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.depreciation
    ADD CONSTRAINT depreciation_pk PRIMARY KEY (id);


--
-- Name: dividends dividends_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.dividends
    ADD CONSTRAINT dividends_pk PRIMARY KEY (id);


--
-- Name: documents_issued documents_issued_external_id_uk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.documents_issued
    ADD CONSTRAINT documents_issued_external_id_uk UNIQUE (external_id);


--
-- Name: documents_issued documents_issued_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.documents_issued
    ADD CONSTRAINT documents_issued_pk PRIMARY KEY (id);


--
-- Name: documents documents_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.documents
    ADD CONSTRAINT documents_pk PRIMARY KEY (id);


--
-- Name: dynamic_report_comments dynamic_report_comments_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.dynamic_report_comments
    ADD CONSTRAINT dynamic_report_comments_pk PRIMARY KEY (id);


--
-- Name: dynamic_report_template_snapshots dynamic_report_template_snapshots_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.dynamic_report_template_snapshots
    ADD CONSTRAINT dynamic_report_template_snapshots_pk PRIMARY KEY (id);


--
-- Name: dynamic_report_templates dynamic_report_templates_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.dynamic_report_templates
    ADD CONSTRAINT dynamic_report_templates_pk PRIMARY KEY (owner_id, name);


--
-- Name: dynamic_report_threads dynamic_report_threads_node_unique; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.dynamic_report_threads
    ADD CONSTRAINT dynamic_report_threads_node_unique UNIQUE (owner_id, template_name, node_id);


--
-- Name: dynamic_report_threads dynamic_report_threads_owner_id_unique; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.dynamic_report_threads
    ADD CONSTRAINT dynamic_report_threads_owner_id_unique UNIQUE (owner_id, id);


--
-- Name: dynamic_report_threads dynamic_report_threads_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.dynamic_report_threads
    ADD CONSTRAINT dynamic_report_threads_pk PRIMARY KEY (id);


--
-- Name: email_ingestion_alias_routing email_ingestion_alias_routing_pkey; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.email_ingestion_alias_routing
    ADD CONSTRAINT email_ingestion_alias_routing_pkey PRIMARY KEY (id);


--
-- Name: email_ingestion_dedup_fingerprints email_ingestion_dedup_fingerprints_pkey; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.email_ingestion_dedup_fingerprints
    ADD CONSTRAINT email_ingestion_dedup_fingerprints_pkey PRIMARY KEY (id);


--
-- Name: email_ingestion_grants email_ingestion_grants_pkey; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.email_ingestion_grants
    ADD CONSTRAINT email_ingestion_grants_pkey PRIMARY KEY (id);


--
-- Name: email_ingestion_idempotency_keys email_ingestion_idempotency_keys_pkey; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.email_ingestion_idempotency_keys
    ADD CONSTRAINT email_ingestion_idempotency_keys_pkey PRIMARY KEY (id);


--
-- Name: email_ingestion_quarantine email_ingestion_quarantine_pkey; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.email_ingestion_quarantine
    ADD CONSTRAINT email_ingestion_quarantine_pkey PRIMARY KEY (id);


--
-- Name: email_ingestion_replay_nonces email_ingestion_replay_nonces_pkey; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.email_ingestion_replay_nonces
    ADD CONSTRAINT email_ingestion_replay_nonces_pkey PRIMARY KEY (id);


--
-- Name: employees employees_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.employees
    ADD CONSTRAINT employees_pk PRIMARY KEY (business_id);


--
-- Name: etana_account_transactions etana_account_transactions_pkey; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.etana_account_transactions
    ADD CONSTRAINT etana_account_transactions_pkey PRIMARY KEY (transaction_id);


--
-- Name: etherscan_transactions etherscan_transactions_pkey; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.etherscan_transactions
    ADD CONSTRAINT etherscan_transactions_pkey PRIMARY KEY (tx_id, currency);


--
-- Name: financial_accounts financial_accounts_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.financial_accounts
    ADD CONSTRAINT financial_accounts_pk PRIMARY KEY (id);


--
-- Name: financial_accounts_tax_categories financial_accounts_tax_categories_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.financial_accounts_tax_categories
    ADD CONSTRAINT financial_accounts_tax_categories_pk PRIMARY KEY (financial_account_id, currency);


--
-- Name: financial_bank_accounts financial_bank_accounts_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.financial_bank_accounts
    ADD CONSTRAINT financial_bank_accounts_pk PRIMARY KEY (id);


--
-- Name: financial_entities financial_entities_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.financial_entities
    ADD CONSTRAINT financial_entities_pk PRIMARY KEY (id);


--
-- Name: invitations invitations_pkey; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.invitations
    ADD CONSTRAINT invitations_pkey PRIMARY KEY (id);


--
-- Name: invitations invitations_token_hash_key; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.invitations
    ADD CONSTRAINT invitations_token_hash_key UNIQUE (token_hash);


--
-- Name: isracard_creditcard_transactions isracard_creditcard_transactions_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.isracard_creditcard_transactions
    ADD CONSTRAINT isracard_creditcard_transactions_pk PRIMARY KEY (id);


--
-- Name: kraken_ledger_records kraken_ledger_records_pkey; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.kraken_ledger_records
    ADD CONSTRAINT kraken_ledger_records_pkey PRIMARY KEY (ledger_id);


--
-- Name: kraken_trades kraken_trades_pkey; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.kraken_trades
    ADD CONSTRAINT kraken_trades_pkey PRIMARY KEY (trade_id);


--
-- Name: ledger_records ledger_records_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.ledger_records
    ADD CONSTRAINT ledger_records_pk PRIMARY KEY (id);


--
-- Name: max_creditcard_transactions max_creditcard_transactions_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.max_creditcard_transactions
    ADD CONSTRAINT max_creditcard_transactions_pk PRIMARY KEY (id);


--
-- Name: migration migration_pkey; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.migration
    ADD CONSTRAINT migration_pkey PRIMARY KEY (name);


--
-- Name: misc_expenses misc_expenses_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.misc_expenses
    ADD CONSTRAINT misc_expenses_pk PRIMARY KEY (id);


--
-- Name: otsar_hahayal_creditcard_transactions otsar_hahayal_creditcard_transactions_pkey; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.otsar_hahayal_creditcard_transactions
    ADD CONSTRAINT otsar_hahayal_creditcard_transactions_pkey PRIMARY KEY (id);


--
-- Name: otsar_hahayal_foreign_account_transactions otsar_hahayal_foreign_account_transactions_pkey; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.otsar_hahayal_foreign_account_transactions
    ADD CONSTRAINT otsar_hahayal_foreign_account_transactions_pkey PRIMARY KEY (id);


--
-- Name: otsar_hahayal_ils_account_transactions otsar_hahayal_ils_account_transactions_pkey; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.otsar_hahayal_ils_account_transactions
    ADD CONSTRAINT otsar_hahayal_ils_account_transactions_pkey PRIMARY KEY (id);


--
-- Name: pcn874 pcn874_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.pcn874
    ADD CONSTRAINT pcn874_pk PRIMARY KEY (business_id, month_date);


--
-- Name: pension_funds pension_funds_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.pension_funds
    ADD CONSTRAINT pension_funds_pk PRIMARY KEY (id);


--
-- Name: permissions permissions_name_key; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.permissions
    ADD CONSTRAINT permissions_name_key UNIQUE (name);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: poalim_cad_account_transactions poalim_cad_account_transactions_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.poalim_cad_account_transactions
    ADD CONSTRAINT poalim_cad_account_transactions_pk PRIMARY KEY (id);


--
-- Name: poalim_deposit_tax_events poalim_deposit_tax_events_natural_key; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.poalim_deposit_tax_events
    ADD CONSTRAINT poalim_deposit_tax_events_natural_key UNIQUE (owner_id, bank_number, branch_number, account_number, executing_date, event_serial_number);


--
-- Name: poalim_deposit_tax_events poalim_deposit_tax_events_pkey; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.poalim_deposit_tax_events
    ADD CONSTRAINT poalim_deposit_tax_events_pkey PRIMARY KEY (id);


--
-- Name: poalim_eur_account_transactions poalim_eur_account_transactions_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.poalim_eur_account_transactions
    ADD CONSTRAINT poalim_eur_account_transactions_pk PRIMARY KEY (id);


--
-- Name: poalim_foreign_account_transactions poalim_foreign_account_transactions_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.poalim_foreign_account_transactions
    ADD CONSTRAINT poalim_foreign_account_transactions_pk PRIMARY KEY (id);


--
-- Name: poalim_gbp_account_transactions poalim_gbp_account_transactions_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.poalim_gbp_account_transactions
    ADD CONSTRAINT poalim_gbp_account_transactions_pk PRIMARY KEY (id);


--
-- Name: poalim_ils_account_transactions poalim_ils_account_transactions_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.poalim_ils_account_transactions
    ADD CONSTRAINT poalim_ils_account_transactions_pk PRIMARY KEY (id);


--
-- Name: poalim_securities poalim_securities_pkey; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.poalim_securities
    ADD CONSTRAINT poalim_securities_pkey PRIMARY KEY (id);


--
-- Name: poalim_securities_transactions poalim_securities_transactions_pkey; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.poalim_securities_transactions
    ADD CONSTRAINT poalim_securities_transactions_pkey PRIMARY KEY (id);


--
-- Name: poalim_swift_account_transactions poalim_swift_account_transactions_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.poalim_swift_account_transactions
    ADD CONSTRAINT poalim_swift_account_transactions_pk PRIMARY KEY (id);


--
-- Name: poalim_usd_account_transactions poalim_usd_account_transactions_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.poalim_usd_account_transactions
    ADD CONSTRAINT poalim_usd_account_transactions_pk PRIMARY KEY (id);


--
-- Name: price_index_bases price_index_bases_pkey; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.price_index_bases
    ADD CONSTRAINT price_index_bases_pkey PRIMARY KEY (index_code, base_label);


--
-- Name: price_index_values price_index_values_pkey; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.price_index_values
    ADD CONSTRAINT price_index_values_pkey PRIMARY KEY (index_code, period);


--
-- Name: provider_credentials provider_credentials_pkey; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.provider_credentials
    ADD CONSTRAINT provider_credentials_pkey PRIMARY KEY (owner_id, provider);


--
-- Name: recovery recovery_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.recovery
    ADD CONSTRAINT recovery_pk PRIMARY KEY (year);


--
-- Name: report_1214_profiles report_1214_profiles_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.report_1214_profiles
    ADD CONSTRAINT report_1214_profiles_pk PRIMARY KEY (owner_id, year);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: salaries salaries_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.salaries
    ADD CONSTRAINT salaries_pk PRIMARY KEY (month, employee_id);


--
-- Name: security_identifiers security_identifiers_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.security_identifiers
    ADD CONSTRAINT security_identifiers_pk PRIMARY KEY (id);


--
-- Name: shareholders shareholders_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.shareholders
    ADD CONSTRAINT shareholders_pk PRIMARY KEY (id);


--
-- Name: sort_codes sort_codes_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.sort_codes
    ADD CONSTRAINT sort_codes_pk PRIMARY KEY (key, owner_id);


--
-- Name: super_admins super_admins_pkey; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.super_admins
    ADD CONSTRAINT super_admins_pkey PRIMARY KEY (auth0_user_id);


--
-- Name: tags tags_pkey; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (id);


--
-- Name: tax_categories tax_categories_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.tax_categories
    ADD CONSTRAINT tax_categories_pk PRIMARY KEY (id);


--
-- Name: transactions transactions_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.transactions
    ADD CONSTRAINT transactions_pk PRIMARY KEY (id);


--
-- Name: transactions_raw_list transactions_raw_list_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.transactions_raw_list
    ADD CONSTRAINT transactions_raw_list_pk PRIMARY KEY (id);


--
-- Name: user_context user_context_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_pk PRIMARY KEY (owner_id);


--
-- Name: user_permission_overrides user_permission_overrides_pkey; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_permission_overrides
    ADD CONSTRAINT user_permission_overrides_pkey PRIMARY KEY (id);


--
-- Name: user_permission_overrides user_permission_overrides_user_id_business_id_permission_id_key; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_permission_overrides
    ADD CONSTRAINT user_permission_overrides_user_id_business_id_permission_id_key UNIQUE (user_id, business_id, permission_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (name);


--
-- Name: vat_value vat_value_pk; Type: CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.vat_value
    ADD CONSTRAINT vat_value_pk PRIMARY KEY (date);


--
-- Name: amex_creditcard_transactions_dedup_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX amex_creditcard_transactions_dedup_uindex ON accounter_schema.amex_creditcard_transactions USING btree (card, COALESCE(full_purchase_date, full_purchase_date_outbound), full_payment_date, COALESCE(payment_sum, payment_sum_outbound), voucher_number, COALESCE(voucher_number_ratz, voucher_number_ratz_outbound), supplier_id, current_payment_currency, COALESCE(full_supplier_name_heb, full_supplier_name_outbound), more_info, deal_sum) NULLS NOT DISTINCT;


--
-- Name: bank_discount_transactions_urn_account_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX bank_discount_transactions_urn_account_uindex ON accounter_schema.bank_discount_transactions USING btree (urn, account_number) WHERE ((urn IS NOT NULL) AND (account_number IS NOT NULL));


--
-- Name: business_trip_charges_charge_id_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX business_trip_charges_charge_id_uindex ON accounter_schema.business_trip_charges USING btree (charge_id);


--
-- Name: business_trips_id_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX business_trips_id_uindex ON accounter_schema.business_trips USING btree (id);


--
-- Name: business_trips_name_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX business_trips_name_uindex ON accounter_schema.business_trips USING btree (name);


--
-- Name: business_trips_transactions_accommodations_id_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX business_trips_transactions_accommodations_id_uindex ON accounter_schema.business_trips_transactions_accommodations USING btree (id);


--
-- Name: business_trips_transactions_flights_id_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX business_trips_transactions_flights_id_uindex ON accounter_schema.business_trips_transactions_flights USING btree (id);


--
-- Name: business_trips_transactions_other_id_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX business_trips_transactions_other_id_uindex ON accounter_schema.business_trips_transactions_other USING btree (id);


--
-- Name: business_trips_transactions_tns_id_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX business_trips_transactions_tns_id_uindex ON accounter_schema.business_trips_transactions_tns USING btree (id);


--
-- Name: businesses_green_invoice_match_business_id_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX businesses_green_invoice_match_business_id_uindex ON accounter_schema.clients USING btree (business_id);


--
-- Name: businesses_green_invoice_match_green_invoice_id_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX businesses_green_invoice_match_green_invoice_id_uindex ON accounter_schema.clients USING btree (green_invoice_id);


--
-- Name: businesses_id_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX businesses_id_uindex ON accounter_schema.businesses USING btree (id);


--
-- Name: businesses_securities_owner_id_idx; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX businesses_securities_owner_id_idx ON accounter_schema.businesses_securities USING btree (owner_id);


--
-- Name: businesses_securities_owner_isin_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX businesses_securities_owner_isin_uindex ON accounter_schema.businesses_securities USING btree (owner_id, isin);


--
-- Name: cal_creditcard_transactions_trn_int_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX cal_creditcard_transactions_trn_int_id ON accounter_schema.cal_creditcard_transactions USING btree (trn_int_id);


--
-- Name: charge_spread_charge_id_index; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX charge_spread_charge_id_index ON accounter_schema.charge_spread USING btree (charge_id);


--
-- Name: charge_tags_charge_id_index; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX charge_tags_charge_id_index ON accounter_schema.charge_tags USING btree (charge_id);


--
-- Name: charges_owner_id_idx; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX charges_owner_id_idx ON accounter_schema.charges USING btree (owner_id);


--
-- Name: charges_owner_id_index; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX charges_owner_id_index ON accounter_schema.charges USING btree (owner_id);


--
-- Name: charges_securities_executions_charge_id_idx; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX charges_securities_executions_charge_id_idx ON accounter_schema.charges_securities_executions USING btree (charge_id);


--
-- Name: charges_securities_executions_owner_id_idx; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX charges_securities_executions_owner_id_idx ON accounter_schema.charges_securities_executions USING btree (owner_id);


--
-- Name: clients_contracts_client_id_start_date_end_date_index; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX clients_contracts_client_id_start_date_end_date_index ON accounter_schema.clients_contracts USING btree (client_id, start_date, end_date);


--
-- Name: corporate_tax_variables_corporate_id_date_index; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX corporate_tax_variables_corporate_id_date_index ON accounter_schema.corporate_tax_variables USING btree (corporate_id, date DESC);


--
-- Name: countries_code_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX countries_code_uindex ON accounter_schema.countries USING btree (code);


--
-- Name: crypto_currencies_symbol_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX crypto_currencies_symbol_uindex ON accounter_schema.crypto_currencies USING btree (symbol);


--
-- Name: deel_invoices_document_id_index; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX deel_invoices_document_id_index ON accounter_schema.deel_invoices USING btree (document_id);


--
-- Name: deel_invoices_id_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX deel_invoices_id_uindex ON accounter_schema.deel_invoices USING btree (id);


--
-- Name: deel_invoices_payment_id_index; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX deel_invoices_payment_id_index ON accounter_schema.deel_invoices USING btree (payment_id);


--
-- Name: deel_workers__index; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX deel_workers__index ON accounter_schema.deel_workers USING btree (business_id);


--
-- Name: deel_workers_contract_id_index; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX deel_workers_contract_id_index ON accounter_schema.deel_workers USING btree (contract_id);


--
-- Name: deel_workers_contractor_id_index; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX deel_workers_contractor_id_index ON accounter_schema.deel_workers USING btree (contractor_id);


--
-- Name: depreciation_activation_date_index; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX depreciation_activation_date_index ON accounter_schema.depreciation USING btree (activation_date);


--
-- Name: depreciation_categories_id_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX depreciation_categories_id_uindex ON accounter_schema.depreciation_categories USING btree (id);


--
-- Name: depreciation_charge_id_index; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX depreciation_charge_id_index ON accounter_schema.depreciation USING btree (charge_id);


--
-- Name: depreciation_disposals_charge_id_index; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX depreciation_disposals_charge_id_index ON accounter_schema.depreciation_disposals USING btree (charge_id);


--
-- Name: depreciation_disposals_depreciation_id_index; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX depreciation_disposals_depreciation_id_index ON accounter_schema.depreciation_disposals USING btree (depreciation_id);


--
-- Name: depreciation_disposals_disposal_date_index; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX depreciation_disposals_disposal_date_index ON accounter_schema.depreciation_disposals USING btree (disposal_date);


--
-- Name: depreciation_disposals_owner_id_index; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX depreciation_disposals_owner_id_index ON accounter_schema.depreciation_disposals USING btree (owner_id);


--
-- Name: depreciation_id_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX depreciation_id_uindex ON accounter_schema.depreciation USING btree (id);


--
-- Name: dividends_id_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX dividends_id_uindex ON accounter_schema.dividends USING btree (id);


--
-- Name: documents_charge_id_index; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX documents_charge_id_index ON accounter_schema.documents USING btree (charge_id);


--
-- Name: documents_creditor_id_index; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX documents_creditor_id_index ON accounter_schema.documents USING btree (creditor_id);


--
-- Name: documents_date_index; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX documents_date_index ON accounter_schema.documents USING btree (date);


--
-- Name: documents_debtor_id_index; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX documents_debtor_id_index ON accounter_schema.documents USING btree (debtor_id);


--
-- Name: documents_total_amount_index; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX documents_total_amount_index ON accounter_schema.documents USING btree (total_amount);


--
-- Name: dynamic_report_comments_thread_index; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX dynamic_report_comments_thread_index ON accounter_schema.dynamic_report_comments USING btree (thread_id, created_at, id);


--
-- Name: dynamic_report_template_snapshots_comparable_index; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX dynamic_report_template_snapshots_comparable_index ON accounter_schema.dynamic_report_template_snapshots USING btree (owner_id, template_name, from_date, to_date, scope_owner_id, created_at DESC);


--
-- Name: dynamic_report_template_snapshots_lookup_index; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX dynamic_report_template_snapshots_lookup_index ON accounter_schema.dynamic_report_template_snapshots USING btree (owner_id, template_name, created_at DESC);


--
-- Name: dynamic_report_templates_owner_id_index; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX dynamic_report_templates_owner_id_index ON accounter_schema.dynamic_report_templates USING btree (owner_id);


--
-- Name: email_ingestion_alias_routing_alias_active_unique; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX email_ingestion_alias_routing_alias_active_unique ON accounter_schema.email_ingestion_alias_routing USING btree (lower(alias)) WHERE (is_active = true);


--
-- Name: email_ingestion_alias_routing_owner_id_idx; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX email_ingestion_alias_routing_owner_id_idx ON accounter_schema.email_ingestion_alias_routing USING btree (owner_id);


--
-- Name: email_ingestion_dedup_fingerprints_created_at_idx; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX email_ingestion_dedup_fingerprints_created_at_idx ON accounter_schema.email_ingestion_dedup_fingerprints USING btree (created_at);


--
-- Name: email_ingestion_dedup_fingerprints_owner_fp_unique; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX email_ingestion_dedup_fingerprints_owner_fp_unique ON accounter_schema.email_ingestion_dedup_fingerprints USING btree (owner_id, fingerprint);


--
-- Name: email_ingestion_grants_expires_at_idx; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX email_ingestion_grants_expires_at_idx ON accounter_schema.email_ingestion_grants USING btree (expires_at);


--
-- Name: email_ingestion_grants_jti_unique; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX email_ingestion_grants_jti_unique ON accounter_schema.email_ingestion_grants USING btree (jti);


--
-- Name: email_ingestion_grants_owner_id_idx; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX email_ingestion_grants_owner_id_idx ON accounter_schema.email_ingestion_grants USING btree (owner_id);


--
-- Name: email_ingestion_idempotency_keys_created_at_idx; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX email_ingestion_idempotency_keys_created_at_idx ON accounter_schema.email_ingestion_idempotency_keys USING btree (created_at);


--
-- Name: email_ingestion_idempotency_keys_key_tenant_unique; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX email_ingestion_idempotency_keys_key_tenant_unique ON accounter_schema.email_ingestion_idempotency_keys USING btree (idempotency_key, owner_id);


--
-- Name: email_ingestion_quarantine_created_at_idx; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX email_ingestion_quarantine_created_at_idx ON accounter_schema.email_ingestion_quarantine USING btree (created_at);


--
-- Name: email_ingestion_quarantine_reason_code_idx; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX email_ingestion_quarantine_reason_code_idx ON accounter_schema.email_ingestion_quarantine USING btree (reason_code);


--
-- Name: email_ingestion_quarantine_status_idx; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX email_ingestion_quarantine_status_idx ON accounter_schema.email_ingestion_quarantine USING btree (status);


--
-- Name: email_ingestion_replay_nonces_expires_at_idx; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX email_ingestion_replay_nonces_expires_at_idx ON accounter_schema.email_ingestion_replay_nonces USING btree (expires_at);


--
-- Name: email_ingestion_replay_nonces_nonce_unique; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX email_ingestion_replay_nonces_nonce_unique ON accounter_schema.email_ingestion_replay_nonces USING btree (nonce);


--
-- Name: employees_business_id_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX employees_business_id_uindex ON accounter_schema.employees USING btree (business_id);


--
-- Name: etherscan_transactions_id_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX etherscan_transactions_id_uindex ON accounter_schema.etherscan_transactions USING btree (id);


--
-- Name: exchange_rates_exchange_date_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX exchange_rates_exchange_date_uindex ON accounter_schema.exchange_rates USING btree (exchange_date);


--
-- Name: financial_accounts_id_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX financial_accounts_id_uindex ON accounter_schema.financial_accounts USING btree (id);


--
-- Name: financial_entities_name_index; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX financial_entities_name_index ON accounter_schema.financial_entities USING btree (name);


--
-- Name: idx_api_keys_business_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_api_keys_business_id ON accounter_schema.api_keys USING btree (business_id);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_audit_logs_action ON accounter_schema.audit_logs USING btree (action);


--
-- Name: idx_audit_logs_business_id_created_at; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_audit_logs_business_id_created_at ON accounter_schema.audit_logs USING btree (business_id, created_at DESC);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_audit_logs_created_at ON accounter_schema.audit_logs USING btree (created_at DESC);


--
-- Name: idx_audit_logs_user_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_audit_logs_user_id ON accounter_schema.audit_logs USING btree (user_id);


--
-- Name: idx_bank_deposits_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_bank_deposits_owner_id ON accounter_schema.bank_deposits USING btree (owner_id);


--
-- Name: idx_business_tax_category_match_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_business_tax_category_match_owner_id ON accounter_schema.business_tax_category_match USING btree (owner_id);


--
-- Name: idx_business_trip_charges_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_business_trip_charges_owner_id ON accounter_schema.business_trip_charges USING btree (owner_id);


--
-- Name: idx_business_trips_attendees_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_business_trips_attendees_owner_id ON accounter_schema.business_trips_attendees USING btree (owner_id);


--
-- Name: idx_business_trips_employee_payments_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_business_trips_employee_payments_owner_id ON accounter_schema.business_trips_employee_payments USING btree (owner_id);


--
-- Name: idx_business_trips_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_business_trips_owner_id ON accounter_schema.business_trips USING btree (owner_id);


--
-- Name: idx_business_trips_transactions_accommodations_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_business_trips_transactions_accommodations_owner_id ON accounter_schema.business_trips_transactions_accommodations USING btree (owner_id);


--
-- Name: idx_business_trips_transactions_car_rental_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_business_trips_transactions_car_rental_owner_id ON accounter_schema.business_trips_transactions_car_rental USING btree (owner_id);


--
-- Name: idx_business_trips_transactions_flights_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_business_trips_transactions_flights_owner_id ON accounter_schema.business_trips_transactions_flights USING btree (owner_id);


--
-- Name: idx_business_trips_transactions_match_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_business_trips_transactions_match_owner_id ON accounter_schema.business_trips_transactions_match USING btree (owner_id);


--
-- Name: idx_business_trips_transactions_other_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_business_trips_transactions_other_owner_id ON accounter_schema.business_trips_transactions_other USING btree (owner_id);


--
-- Name: idx_business_trips_transactions_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_business_trips_transactions_owner_id ON accounter_schema.business_trips_transactions USING btree (owner_id);


--
-- Name: idx_business_trips_transactions_tns_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_business_trips_transactions_tns_owner_id ON accounter_schema.business_trips_transactions_tns USING btree (owner_id);


--
-- Name: idx_business_users_auth0_user_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_business_users_auth0_user_id ON accounter_schema.business_users USING btree (auth0_user_id) WHERE (auth0_user_id IS NOT NULL);


--
-- Name: idx_business_users_business_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_business_users_business_id ON accounter_schema.business_users USING btree (business_id);


--
-- Name: idx_businesses_admin_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_businesses_admin_owner_id ON accounter_schema.businesses_admin USING btree (owner_id);


--
-- Name: idx_businesses_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_businesses_owner_id ON accounter_schema.businesses USING btree (owner_id);


--
-- Name: idx_charge_balance_cancellation_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_charge_balance_cancellation_owner_id ON accounter_schema.charge_balance_cancellation USING btree (owner_id);


--
-- Name: idx_charge_spread_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_charge_spread_owner_id ON accounter_schema.charge_spread USING btree (owner_id);


--
-- Name: idx_charge_tags_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_charge_tags_owner_id ON accounter_schema.charge_tags USING btree (owner_id);


--
-- Name: idx_charge_unbalanced_ledger_businesses_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_charge_unbalanced_ledger_businesses_owner_id ON accounter_schema.charge_unbalanced_ledger_businesses USING btree (owner_id);


--
-- Name: idx_charges_bank_deposits_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_charges_bank_deposits_owner_id ON accounter_schema.charges_bank_deposits USING btree (owner_id);


--
-- Name: idx_charges_desc_trgm; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_charges_desc_trgm ON accounter_schema.charges USING gin (user_description public.gin_trgm_ops);


--
-- Name: idx_charges_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_charges_owner_id ON accounter_schema.charges USING btree (owner_id);


--
-- Name: idx_clients_contracts_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_clients_contracts_owner_id ON accounter_schema.clients_contracts USING btree (owner_id);


--
-- Name: idx_clients_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_clients_owner_id ON accounter_schema.clients USING btree (owner_id);


--
-- Name: idx_corporate_tax_variables_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_corporate_tax_variables_owner_id ON accounter_schema.corporate_tax_variables USING btree (owner_id);


--
-- Name: idx_deel_invoices_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_deel_invoices_owner_id ON accounter_schema.deel_invoices USING btree (owner_id);


--
-- Name: idx_deel_workers_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_deel_workers_owner_id ON accounter_schema.deel_workers USING btree (owner_id);


--
-- Name: idx_depreciation_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_depreciation_owner_id ON accounter_schema.depreciation USING btree (owner_id);


--
-- Name: idx_dividends_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_dividends_owner_id ON accounter_schema.dividends USING btree (owner_id);


--
-- Name: idx_docs_desc_trgm; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_docs_desc_trgm ON accounter_schema.documents USING gin (description public.gin_trgm_ops);


--
-- Name: idx_docs_remarks_trgm; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_docs_remarks_trgm ON accounter_schema.documents USING gin (remarks public.gin_trgm_ops);


--
-- Name: idx_docs_serial_trgm; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_docs_serial_trgm ON accounter_schema.documents USING gin (serial_number public.gin_trgm_ops);


--
-- Name: idx_documents_issued_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_documents_issued_owner_id ON accounter_schema.documents_issued USING btree (owner_id);


--
-- Name: idx_documents_owner_date; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_documents_owner_date ON accounter_schema.documents USING btree (owner_id, date);


--
-- Name: idx_documents_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_documents_owner_id ON accounter_schema.documents USING btree (owner_id);


--
-- Name: idx_documents_owner_vat_report_date; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_documents_owner_vat_report_date ON accounter_schema.documents USING btree (owner_id, COALESCE(vat_report_date_override, date));


--
-- Name: idx_employees_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_employees_owner_id ON accounter_schema.employees USING btree (owner_id);


--
-- Name: idx_financial_accounts_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_financial_accounts_owner_id ON accounter_schema.financial_accounts USING btree (owner_id);


--
-- Name: idx_financial_accounts_tax_categories_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_financial_accounts_tax_categories_owner_id ON accounter_schema.financial_accounts_tax_categories USING btree (owner_id);


--
-- Name: idx_financial_bank_accounts_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_financial_bank_accounts_owner_id ON accounter_schema.financial_bank_accounts USING btree (owner_id);


--
-- Name: idx_financial_entities_name_trgm; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_financial_entities_name_trgm ON accounter_schema.financial_entities USING gin (name public.gin_trgm_ops);


--
-- Name: idx_financial_entities_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_financial_entities_owner_id ON accounter_schema.financial_entities USING btree (owner_id);


--
-- Name: idx_invitations_business_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_invitations_business_id ON accounter_schema.invitations USING btree (business_id);


--
-- Name: idx_invitations_email; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_invitations_email ON accounter_schema.invitations USING btree (email);


--
-- Name: idx_invitations_expires_at; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_invitations_expires_at ON accounter_schema.invitations USING btree (expires_at);


--
-- Name: idx_invitations_unique_pending; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX idx_invitations_unique_pending ON accounter_schema.invitations USING btree (business_id, email) WHERE (accepted_at IS NULL);


--
-- Name: idx_invitations_user_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_invitations_user_id ON accounter_schema.invitations USING btree (user_id);


--
-- Name: idx_ledger_records_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_ledger_records_owner_id ON accounter_schema.ledger_records USING btree (owner_id);


--
-- Name: idx_misc_expenses_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_misc_expenses_owner_id ON accounter_schema.misc_expenses USING btree (owner_id);


--
-- Name: idx_pcn874_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_pcn874_owner_id ON accounter_schema.pcn874 USING btree (owner_id);


--
-- Name: idx_pension_funds_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_pension_funds_owner_id ON accounter_schema.pension_funds USING btree (owner_id);


--
-- Name: idx_salaries_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_salaries_owner_id ON accounter_schema.salaries USING btree (owner_id);


--
-- Name: idx_sort_codes_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_sort_codes_owner_id ON accounter_schema.sort_codes USING btree (owner_id);


--
-- Name: idx_sort_codes_owner_key; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_sort_codes_owner_key ON accounter_schema.sort_codes USING btree (owner_id, key);


--
-- Name: idx_tags_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_tags_owner_id ON accounter_schema.tags USING btree (owner_id);


--
-- Name: idx_tax_categories_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_tax_categories_owner_id ON accounter_schema.tax_categories USING btree (owner_id);


--
-- Name: idx_trans_src_ref_trgm; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_trans_src_ref_trgm ON accounter_schema.transactions USING gin (source_reference public.gin_trgm_ops);


--
-- Name: idx_trans_src_trgm; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_trans_src_trgm ON accounter_schema.transactions USING gin (source_description public.gin_trgm_ops);


--
-- Name: idx_transactions_owner_effective_debit_date; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_transactions_owner_effective_debit_date ON accounter_schema.transactions USING btree (owner_id, COALESCE(debit_date_override, debit_date));


--
-- Name: idx_transactions_owner_event_date; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_transactions_owner_event_date ON accounter_schema.transactions USING btree (owner_id, event_date);


--
-- Name: idx_transactions_owner_id; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX idx_transactions_owner_id ON accounter_schema.transactions USING btree (owner_id);


--
-- Name: isracard_creditcard_transactions_dedup_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX isracard_creditcard_transactions_dedup_uindex ON accounter_schema.isracard_creditcard_transactions USING btree (card, COALESCE(full_purchase_date, full_purchase_date_outbound), full_payment_date, COALESCE(payment_sum, payment_sum_outbound), voucher_number, COALESCE(voucher_number_ratz, voucher_number_ratz_outbound), supplier_id, current_payment_currency, COALESCE(full_supplier_name_heb, full_supplier_name_outbound), more_info, deal_sum) NULLS NOT DISTINCT;


--
-- Name: isracard_creditcard_transactions_id_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX isracard_creditcard_transactions_id_uindex ON accounter_schema.isracard_creditcard_transactions USING btree (id);


--
-- Name: ledger_records_id_charge_id_index; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX ledger_records_id_charge_id_index ON accounter_schema.ledger_records USING btree (id, charge_id);


--
-- Name: max_creditcard_transactions_id_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX max_creditcard_transactions_id_uindex ON accounter_schema.max_creditcard_transactions USING btree (id);


--
-- Name: max_creditcard_transactions_uid_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX max_creditcard_transactions_uid_uindex ON accounter_schema.max_creditcard_transactions USING btree (uid, arn, purchase_date, payment_date, original_amount);


--
-- Name: misc_expenses_charge_id_index; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX misc_expenses_charge_id_index ON accounter_schema.misc_expenses USING btree (charge_id);


--
-- Name: misc_expenses_creditor_id_index; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX misc_expenses_creditor_id_index ON accounter_schema.misc_expenses USING btree (creditor_id);


--
-- Name: misc_expenses_debtor_id_index; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX misc_expenses_debtor_id_index ON accounter_schema.misc_expenses USING btree (debtor_id);


--
-- Name: otsar_hahayal_creditcard_transactions_conflict_key; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX otsar_hahayal_creditcard_transactions_conflict_key ON accounter_schema.otsar_hahayal_creditcard_transactions USING btree (resource_id, card_type, date, charge_date, deal_amount, deal_currency, name, notes, counter);


--
-- Name: otsar_hahayal_creditcard_transactions_date_idx; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX otsar_hahayal_creditcard_transactions_date_idx ON accounter_schema.otsar_hahayal_creditcard_transactions USING btree (date);


--
-- Name: otsar_hahayal_creditcard_transactions_owner_id_idx; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX otsar_hahayal_creditcard_transactions_owner_id_idx ON accounter_schema.otsar_hahayal_creditcard_transactions USING btree (owner_id);


--
-- Name: otsar_hahayal_foreign_account_transactions_conflict_key; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX otsar_hahayal_foreign_account_transactions_conflict_key ON accounter_schema.otsar_hahayal_foreign_account_transactions USING btree (account, branch, date, value_date, reference, description);


--
-- Name: otsar_hahayal_foreign_account_transactions_date_idx; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX otsar_hahayal_foreign_account_transactions_date_idx ON accounter_schema.otsar_hahayal_foreign_account_transactions USING btree (date);


--
-- Name: otsar_hahayal_foreign_account_transactions_owner_id_idx; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX otsar_hahayal_foreign_account_transactions_owner_id_idx ON accounter_schema.otsar_hahayal_foreign_account_transactions USING btree (owner_id);


--
-- Name: otsar_hahayal_ils_account_transactions_conflict_key; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX otsar_hahayal_ils_account_transactions_conflict_key ON accounter_schema.otsar_hahayal_ils_account_transactions USING btree (account_number, branch_number, date_of_registration, date_of_business_day, reference, origin_reference, credit_amount, debit_amount);


--
-- Name: otsar_hahayal_ils_account_transactions_date_idx; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX otsar_hahayal_ils_account_transactions_date_idx ON accounter_schema.otsar_hahayal_ils_account_transactions USING btree (date_of_business_day);


--
-- Name: otsar_hahayal_ils_account_transactions_owner_id_idx; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX otsar_hahayal_ils_account_transactions_owner_id_idx ON accounter_schema.otsar_hahayal_ils_account_transactions USING btree (owner_id);


--
-- Name: pcn874_business_id_month_date_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX pcn874_business_id_month_date_uindex ON accounter_schema.pcn874 USING btree (business_id, month_date);


--
-- Name: pension_funds_id_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX pension_funds_id_uindex ON accounter_schema.pension_funds USING btree (id);


--
-- Name: poalim_cad_account_transactions_id_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX poalim_cad_account_transactions_id_uindex ON accounter_schema.poalim_usd_account_transactions USING btree (id);


--
-- Name: poalim_deposit_tax_events_account_date_idx; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX poalim_deposit_tax_events_account_date_idx ON accounter_schema.poalim_deposit_tax_events USING btree (owner_id, account_number, executing_date);


--
-- Name: poalim_eur_account_transactions_id_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX poalim_eur_account_transactions_id_uindex ON accounter_schema.poalim_eur_account_transactions USING btree (id);


--
-- Name: poalim_foreign_account_transactions_dedup_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX poalim_foreign_account_transactions_dedup_uindex ON accounter_schema.poalim_foreign_account_transactions USING btree (executing_date, account_number, branch_number, event_number) NULLS NOT DISTINCT;


--
-- Name: poalim_foreign_account_transactions_id_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX poalim_foreign_account_transactions_id_uindex ON accounter_schema.poalim_foreign_account_transactions USING btree (id);


--
-- Name: poalim_gbp_account_transactions_id_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX poalim_gbp_account_transactions_id_uindex ON accounter_schema.poalim_gbp_account_transactions USING btree (id);


--
-- Name: poalim_ils_account_transactions_dedup_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX poalim_ils_account_transactions_dedup_uindex ON accounter_schema.poalim_ils_account_transactions USING btree (event_date, serial_number, account_number, branch_number) NULLS NOT DISTINCT;


--
-- Name: poalim_ils_account_transactions_event_date_index; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX poalim_ils_account_transactions_event_date_index ON accounter_schema.poalim_ils_account_transactions USING btree (event_date);


--
-- Name: poalim_ils_account_transactions_id_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX poalim_ils_account_transactions_id_uindex ON accounter_schema.poalim_ils_account_transactions USING btree (id);


--
-- Name: poalim_ils_account_transactions_reference_number_index; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX poalim_ils_account_transactions_reference_number_index ON accounter_schema.poalim_ils_account_transactions USING btree (reference_number);


--
-- Name: poalim_securities_dedup_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX poalim_securities_dedup_uindex ON accounter_schema.poalim_securities USING btree (owner_id, bank_number, branch_number, account_number, security_key);


--
-- Name: poalim_securities_owner_id_idx; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX poalim_securities_owner_id_idx ON accounter_schema.poalim_securities USING btree (owner_id);


--
-- Name: poalim_securities_transactions_account_trade_date_idx; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX poalim_securities_transactions_account_trade_date_idx ON accounter_schema.poalim_securities_transactions USING btree (bank_number, branch_number, account_number, trade_date);


--
-- Name: poalim_securities_transactions_dedup_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX poalim_securities_transactions_dedup_uindex ON accounter_schema.poalim_securities_transactions USING btree (owner_id, bank_number, branch_number, account_number, security, trade_date, trade_type, transaction_type, nv, payment_type, payment_date, ex_date, cancel_date, occurrence) NULLS NOT DISTINCT;


--
-- Name: poalim_securities_transactions_owner_id_idx; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX poalim_securities_transactions_owner_id_idx ON accounter_schema.poalim_securities_transactions USING btree (owner_id);


--
-- Name: poalim_swift_account_transactions_id_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX poalim_swift_account_transactions_id_uindex ON accounter_schema.poalim_swift_account_transactions USING btree (id);


--
-- Name: poalim_swift_account_transactions_transfer_id_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX poalim_swift_account_transactions_transfer_id_uindex ON accounter_schema.poalim_swift_account_transactions USING btree (transfer_catenated_id) NULLS NOT DISTINCT;


--
-- Name: poalim_usd_account_transactions_id_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX poalim_usd_account_transactions_id_uindex ON accounter_schema.poalim_usd_account_transactions USING btree (id);


--
-- Name: price_index_values_published_on_idx; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX price_index_values_published_on_idx ON accounter_schema.price_index_values USING btree (index_code, published_on);


--
-- Name: recovery_year_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX recovery_year_uindex ON accounter_schema.recovery USING btree (year);


--
-- Name: security_identifiers_business_id_idx; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX security_identifiers_business_id_idx ON accounter_schema.security_identifiers USING btree (owner_id, business_id);


--
-- Name: security_identifiers_value_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX security_identifiers_value_uindex ON accounter_schema.security_identifiers USING btree (owner_id, identifier_type, identifier_value);


--
-- Name: shareholders_owner_id_year_idx; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX shareholders_owner_id_year_idx ON accounter_schema.shareholders USING btree (owner_id, year);


--
-- Name: shareholders_owner_year_id_number_key; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX shareholders_owner_year_id_number_key ON accounter_schema.shareholders USING btree (owner_id, year, id_number) WHERE ((id_number)::text <> ALL ((ARRAY['999999964'::character varying, '999999998'::character varying])::text[]));


--
-- Name: tax_categories_id_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX tax_categories_id_uindex ON accounter_schema.tax_categories USING btree (id);


--
-- Name: transactions_account_id_index; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX transactions_account_id_index ON accounter_schema.transactions USING btree (account_id) WHERE (account_id IS NOT NULL);


--
-- Name: transactions_amount_index; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX transactions_amount_index ON accounter_schema.transactions USING btree (amount);


--
-- Name: transactions_charge_id_index; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX transactions_charge_id_index ON accounter_schema.transactions USING btree (charge_id) WHERE (charge_id IS NOT NULL);


--
-- Name: transactions_debit_date_index; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX transactions_debit_date_index ON accounter_schema.transactions USING btree (debit_date);


--
-- Name: transactions_event_date_index; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE INDEX transactions_event_date_index ON accounter_schema.transactions USING btree (event_date);


--
-- Name: transactions_raw_list_creditcard_id_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX transactions_raw_list_creditcard_id_uindex ON accounter_schema.transactions_raw_list USING btree (creditcard_id) WHERE (creditcard_id IS NOT NULL);


--
-- Name: transactions_raw_list_id_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX transactions_raw_list_id_uindex ON accounter_schema.transactions_raw_list USING btree (id);


--
-- Name: transactions_raw_list_max_creditcard_id_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX transactions_raw_list_max_creditcard_id_uindex ON accounter_schema.transactions_raw_list USING btree (max_creditcard_id);


--
-- Name: transactions_raw_list_otsar_hahayal_creditcard_id_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX transactions_raw_list_otsar_hahayal_creditcard_id_uindex ON accounter_schema.transactions_raw_list USING btree (otsar_hahayal_creditcard_id) WHERE (otsar_hahayal_creditcard_id IS NOT NULL);


--
-- Name: transactions_raw_list_otsar_hahayal_foreign_id_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX transactions_raw_list_otsar_hahayal_foreign_id_uindex ON accounter_schema.transactions_raw_list USING btree (otsar_hahayal_foreign_id) WHERE (otsar_hahayal_foreign_id IS NOT NULL);


--
-- Name: transactions_raw_list_otsar_hahayal_ils_id_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX transactions_raw_list_otsar_hahayal_ils_id_uindex ON accounter_schema.transactions_raw_list USING btree (otsar_hahayal_ils_id) WHERE (otsar_hahayal_ils_id IS NOT NULL);


--
-- Name: transactions_raw_list_poalim_ils_id_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX transactions_raw_list_poalim_ils_id_uindex ON accounter_schema.transactions_raw_list USING btree (poalim_ils_id) WHERE (poalim_ils_id IS NOT NULL);


--
-- Name: user_context_owner_id_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX user_context_owner_id_uindex ON accounter_schema.user_context USING btree (owner_id);


--
-- Name: vat_value_date_uindex; Type: INDEX; Schema: accounter_schema; Owner: -
--

CREATE UNIQUE INDEX vat_value_date_uindex ON accounter_schema.vat_value USING btree (date);


--
-- Name: amex_creditcard_transactions amex_transaction_insert_trigger; Type: TRIGGER; Schema: accounter_schema; Owner: -
--

CREATE TRIGGER amex_transaction_insert_trigger AFTER INSERT ON accounter_schema.amex_creditcard_transactions FOR EACH ROW EXECUTE FUNCTION accounter_schema.insert_amex_transaction_handler();


--
-- Name: bank_discount_transactions bank_discount_transaction_insert_trigger; Type: TRIGGER; Schema: accounter_schema; Owner: -
--

CREATE TRIGGER bank_discount_transaction_insert_trigger AFTER INSERT ON accounter_schema.bank_discount_transactions FOR EACH ROW EXECUTE FUNCTION accounter_schema.insert_bank_discount_transaction_handler();


--
-- Name: business_users business_users_updated_at; Type: TRIGGER; Schema: accounter_schema; Owner: -
--

CREATE TRIGGER business_users_updated_at BEFORE UPDATE ON accounter_schema.business_users FOR EACH ROW EXECUTE FUNCTION accounter_schema.set_updated_at();


--
-- Name: cal_creditcard_transactions cal_creditcard_transaction_insert_trigger; Type: TRIGGER; Schema: accounter_schema; Owner: -
--

CREATE TRIGGER cal_creditcard_transaction_insert_trigger AFTER INSERT ON accounter_schema.cal_creditcard_transactions FOR EACH ROW EXECUTE FUNCTION accounter_schema.insert_cal_creditcard_transaction_handler();


--
-- Name: poalim_foreign_account_transactions foreign_transaction_insert_trigger; Type: TRIGGER; Schema: accounter_schema; Owner: -
--

CREATE TRIGGER foreign_transaction_insert_trigger AFTER INSERT ON accounter_schema.poalim_foreign_account_transactions FOR EACH ROW EXECUTE FUNCTION accounter_schema.insert_poalim_foreign_transaction_handler();


--
-- Name: poalim_ils_account_transactions ils_transaction_insert_trigger; Type: TRIGGER; Schema: accounter_schema; Owner: -
--

CREATE TRIGGER ils_transaction_insert_trigger AFTER INSERT ON accounter_schema.poalim_ils_account_transactions FOR EACH ROW EXECUTE FUNCTION accounter_schema.insert_poalim_ils_transaction_handler();


--
-- Name: otsar_hahayal_creditcard_transactions insert_otsar_hahayal_creditcard_transaction; Type: TRIGGER; Schema: accounter_schema; Owner: -
--

CREATE TRIGGER insert_otsar_hahayal_creditcard_transaction AFTER INSERT ON accounter_schema.otsar_hahayal_creditcard_transactions FOR EACH ROW EXECUTE FUNCTION accounter_schema.insert_otsar_hahayal_creditcard_transaction_handler();


--
-- Name: otsar_hahayal_foreign_account_transactions insert_otsar_hahayal_foreign_transaction; Type: TRIGGER; Schema: accounter_schema; Owner: -
--

CREATE TRIGGER insert_otsar_hahayal_foreign_transaction AFTER INSERT ON accounter_schema.otsar_hahayal_foreign_account_transactions FOR EACH ROW EXECUTE FUNCTION accounter_schema.insert_otsar_hahayal_foreign_transaction_handler();


--
-- Name: otsar_hahayal_ils_account_transactions insert_otsar_hahayal_ils_transaction; Type: TRIGGER; Schema: accounter_schema; Owner: -
--

CREATE TRIGGER insert_otsar_hahayal_ils_transaction AFTER INSERT ON accounter_schema.otsar_hahayal_ils_account_transactions FOR EACH ROW EXECUTE FUNCTION accounter_schema.insert_otsar_hahayal_ils_transaction_handler();


--
-- Name: isracard_creditcard_transactions isracard_transaction_insert_trigger; Type: TRIGGER; Schema: accounter_schema; Owner: -
--

CREATE TRIGGER isracard_transaction_insert_trigger AFTER INSERT ON accounter_schema.isracard_creditcard_transactions FOR EACH ROW EXECUTE FUNCTION accounter_schema.insert_creditcard_transaction_handler();


--
-- Name: max_creditcard_transactions max_transaction_insert_trigger; Type: TRIGGER; Schema: accounter_schema; Owner: -
--

CREATE TRIGGER max_transaction_insert_trigger AFTER INSERT ON accounter_schema.max_creditcard_transactions FOR EACH ROW EXECUTE FUNCTION accounter_schema.insert_max_creditcard_transaction_handler();


--
-- Name: email_ingestion_alias_routing set_updated_at; Type: TRIGGER; Schema: accounter_schema; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON accounter_schema.email_ingestion_alias_routing FOR EACH ROW EXECUTE FUNCTION accounter_schema.update_general_updated_at();


--
-- Name: email_ingestion_quarantine set_updated_at; Type: TRIGGER; Schema: accounter_schema; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON accounter_schema.email_ingestion_quarantine FOR EACH ROW EXECUTE FUNCTION accounter_schema.update_general_updated_at();


--
-- Name: provider_credentials set_updated_at; Type: TRIGGER; Schema: accounter_schema; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON accounter_schema.provider_credentials FOR EACH ROW WHEN ((old.payload IS DISTINCT FROM new.payload)) EXECUTE FUNCTION accounter_schema.update_general_updated_at();


--
-- Name: poalim_swift_account_transactions swift_transaction_insert_trigger; Type: TRIGGER; Schema: accounter_schema; Owner: -
--

CREATE TRIGGER swift_transaction_insert_trigger AFTER INSERT ON accounter_schema.poalim_swift_account_transactions FOR EACH ROW EXECUTE FUNCTION accounter_schema.insert_poalim_swift_transaction_handler();


--
-- Name: annual_audit_step_status update_annual_audit_step_status_updated_at; Type: TRIGGER; Schema: accounter_schema; Owner: -
--

CREATE TRIGGER update_annual_audit_step_status_updated_at BEFORE UPDATE ON accounter_schema.annual_audit_step_status FOR EACH ROW EXECUTE FUNCTION accounter_schema.update_general_updated_at();


--
-- Name: businesses_securities update_businesses_securities_updated_at; Type: TRIGGER; Schema: accounter_schema; Owner: -
--

CREATE TRIGGER update_businesses_securities_updated_at BEFORE UPDATE ON accounter_schema.businesses_securities FOR EACH ROW EXECUTE FUNCTION accounter_schema.update_general_updated_at();


--
-- Name: charges update_charge_updated_at; Type: TRIGGER; Schema: accounter_schema; Owner: -
--

CREATE TRIGGER update_charge_updated_at BEFORE UPDATE ON accounter_schema.charges FOR EACH ROW EXECUTE FUNCTION accounter_schema.update_general_updated_at();


--
-- Name: documents update_documents_updated_at; Type: TRIGGER; Schema: accounter_schema; Owner: -
--

CREATE TRIGGER update_documents_updated_at AFTER UPDATE ON accounter_schema.documents FOR EACH ROW EXECUTE FUNCTION accounter_schema.update_general_updated_at();


--
-- Name: dynamic_report_templates update_dynamic_report_templates_updated_at; Type: TRIGGER; Schema: accounter_schema; Owner: -
--

CREATE TRIGGER update_dynamic_report_templates_updated_at BEFORE UPDATE ON accounter_schema.dynamic_report_templates FOR EACH ROW EXECUTE FUNCTION accounter_schema.update_general_updated_at();


--
-- Name: financial_entities update_financial_entities_updated_at; Type: TRIGGER; Schema: accounter_schema; Owner: -
--

CREATE TRIGGER update_financial_entities_updated_at BEFORE UPDATE ON accounter_schema.financial_entities FOR EACH ROW EXECUTE FUNCTION accounter_schema.update_general_updated_at();


--
-- Name: ledger_records update_ledger_records_updated_at; Type: TRIGGER; Schema: accounter_schema; Owner: -
--

CREATE TRIGGER update_ledger_records_updated_at BEFORE UPDATE ON accounter_schema.ledger_records FOR EACH ROW EXECUTE FUNCTION accounter_schema.update_general_updated_at();


--
-- Name: report_1214_profiles update_report_1214_profiles_updated_at; Type: TRIGGER; Schema: accounter_schema; Owner: -
--

CREATE TRIGGER update_report_1214_profiles_updated_at BEFORE UPDATE ON accounter_schema.report_1214_profiles FOR EACH ROW EXECUTE FUNCTION accounter_schema.update_general_updated_at();


--
-- Name: shareholders update_shareholders_updated_at; Type: TRIGGER; Schema: accounter_schema; Owner: -
--

CREATE TRIGGER update_shareholders_updated_at BEFORE UPDATE ON accounter_schema.shareholders FOR EACH ROW EXECUTE FUNCTION accounter_schema.update_general_updated_at();


--
-- Name: transactions update_transaction_updated_at; Type: TRIGGER; Schema: accounter_schema; Owner: -
--

CREATE TRIGGER update_transaction_updated_at BEFORE UPDATE ON accounter_schema.transactions FOR EACH ROW EXECUTE FUNCTION accounter_schema.update_general_updated_at();


--
-- Name: annual_audit_step_status annual_audit_step_status_businesses_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.annual_audit_step_status
    ADD CONSTRAINT annual_audit_step_status_businesses_id_fk FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: api_key_permission_overrides api_key_permission_overrides_api_key_id_fkey; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.api_key_permission_overrides
    ADD CONSTRAINT api_key_permission_overrides_api_key_id_fkey FOREIGN KEY (api_key_id) REFERENCES accounter_schema.api_keys(id) ON DELETE CASCADE;


--
-- Name: api_key_permission_overrides api_key_permission_overrides_permission_id_fkey; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.api_key_permission_overrides
    ADD CONSTRAINT api_key_permission_overrides_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES accounter_schema.permissions(id) ON DELETE CASCADE;


--
-- Name: api_keys api_keys_business_id_fkey; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.api_keys
    ADD CONSTRAINT api_keys_business_id_fkey FOREIGN KEY (business_id) REFERENCES accounter_schema.businesses_admin(id) ON DELETE CASCADE;


--
-- Name: api_keys api_keys_role_id_fkey; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.api_keys
    ADD CONSTRAINT api_keys_role_id_fkey FOREIGN KEY (role_id) REFERENCES accounter_schema.roles(id) ON DELETE RESTRICT;


--
-- Name: audit_logs audit_logs_business_id_fkey; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.audit_logs
    ADD CONSTRAINT audit_logs_business_id_fkey FOREIGN KEY (business_id) REFERENCES accounter_schema.businesses_admin(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_user_business_fkey; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.audit_logs
    ADD CONSTRAINT audit_logs_user_business_fkey FOREIGN KEY (user_id, business_id) REFERENCES accounter_schema.business_users(user_id, business_id) ON DELETE SET NULL;


--
-- Name: bank_deposits bank_deposits_account_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.bank_deposits
    ADD CONSTRAINT bank_deposits_account_id_fk FOREIGN KEY (account_id) REFERENCES accounter_schema.financial_accounts(id);


--
-- Name: bank_deposits bank_deposits_owner_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.bank_deposits
    ADD CONSTRAINT bank_deposits_owner_id_fk FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: business_tax_category_match business_tax_category_match_businesses_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_tax_category_match
    ADD CONSTRAINT business_tax_category_match_businesses_id_fk FOREIGN KEY (business_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: business_tax_category_match business_tax_category_match_owner_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_tax_category_match
    ADD CONSTRAINT business_tax_category_match_owner_fk FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: business_tax_category_match business_tax_category_match_tax_categories_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_tax_category_match
    ADD CONSTRAINT business_tax_category_match_tax_categories_id_fk FOREIGN KEY (tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: business_trip_charges business_trip_charges_business_trips_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_trip_charges
    ADD CONSTRAINT business_trip_charges_business_trips_id_fk FOREIGN KEY (business_trip_id) REFERENCES accounter_schema.business_trips(id);


--
-- Name: business_trip_charges business_trip_charges_charges_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_trip_charges
    ADD CONSTRAINT business_trip_charges_charges_id_fk FOREIGN KEY (charge_id) REFERENCES accounter_schema.charges(id);


--
-- Name: business_trips_attendees business_trips_attendees_business_trips_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_trips_attendees
    ADD CONSTRAINT business_trips_attendees_business_trips_id_fk FOREIGN KEY (business_trip_id) REFERENCES accounter_schema.business_trips(id);


--
-- Name: business_trips_attendees business_trips_attendees_businesses_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_trips_attendees
    ADD CONSTRAINT business_trips_attendees_businesses_id_fk FOREIGN KEY (attendee_business_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: business_trips business_trips_countries_code_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_trips
    ADD CONSTRAINT business_trips_countries_code_fk FOREIGN KEY (destination) REFERENCES accounter_schema.countries(code);


--
-- Name: business_trips_employee_payments business_trips_employee_payments_business_trips_transactions_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_trips_employee_payments
    ADD CONSTRAINT business_trips_employee_payments_business_trips_transactions_id FOREIGN KEY (id) REFERENCES accounter_schema.business_trips_transactions(id);


--
-- Name: business_trips_employee_payments business_trips_employee_payments_businesses_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_trips_employee_payments
    ADD CONSTRAINT business_trips_employee_payments_businesses_id_fk FOREIGN KEY (employee_business_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: business_trips_employee_payments business_trips_employee_payments_charges_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_trips_employee_payments
    ADD CONSTRAINT business_trips_employee_payments_charges_id_fk FOREIGN KEY (charge_id) REFERENCES accounter_schema.charges(id);


--
-- Name: business_trips_transactions_accommodations business_trips_transactions_accommodations_business_trips_trans; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_trips_transactions_accommodations
    ADD CONSTRAINT business_trips_transactions_accommodations_business_trips_trans FOREIGN KEY (id) REFERENCES accounter_schema.business_trips_transactions(id);


--
-- Name: business_trips_transactions business_trips_transactions_business_trips_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_trips_transactions
    ADD CONSTRAINT business_trips_transactions_business_trips_id_fk FOREIGN KEY (business_trip_id) REFERENCES accounter_schema.business_trips(id);


--
-- Name: business_trips_transactions_flights business_trips_transactions_flights_business_trips_transactions; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_trips_transactions_flights
    ADD CONSTRAINT business_trips_transactions_flights_business_trips_transactions FOREIGN KEY (id) REFERENCES accounter_schema.business_trips_transactions(id);


--
-- Name: business_trips_transactions_match business_trips_transactions_match_business_trips_transactions_i; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_trips_transactions_match
    ADD CONSTRAINT business_trips_transactions_match_business_trips_transactions_i FOREIGN KEY (business_trip_transaction_id) REFERENCES accounter_schema.business_trips_transactions(id);


--
-- Name: business_trips_transactions_match business_trips_transactions_match_transactions_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_trips_transactions_match
    ADD CONSTRAINT business_trips_transactions_match_transactions_id_fk FOREIGN KEY (transaction_id) REFERENCES accounter_schema.transactions(id);


--
-- Name: business_trips_transactions_other business_trips_transactions_other_business_trips_transactions_i; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_trips_transactions_other
    ADD CONSTRAINT business_trips_transactions_other_business_trips_transactions_i FOREIGN KEY (id) REFERENCES accounter_schema.business_trips_transactions(id);


--
-- Name: business_users business_users_business_id_fkey; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_users
    ADD CONSTRAINT business_users_business_id_fkey FOREIGN KEY (business_id) REFERENCES accounter_schema.businesses_admin(id) ON DELETE CASCADE;


--
-- Name: business_users business_users_role_id_fkey; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_users
    ADD CONSTRAINT business_users_role_id_fkey FOREIGN KEY (role_id) REFERENCES accounter_schema.roles(id) ON DELETE RESTRICT;


--
-- Name: businesses_admin businesses_admin_businesses_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.businesses_admin
    ADD CONSTRAINT businesses_admin_businesses_id_fk FOREIGN KEY (id) REFERENCES accounter_schema.businesses(id);


--
-- Name: businesses businesses_countries_code_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.businesses
    ADD CONSTRAINT businesses_countries_code_fk FOREIGN KEY (country) REFERENCES accounter_schema.countries(code);


--
-- Name: businesses businesses_financial_entities_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.businesses
    ADD CONSTRAINT businesses_financial_entities_id_fk FOREIGN KEY (id) REFERENCES accounter_schema.financial_entities(id);


--
-- Name: clients businesses_green_invoice_match_businesses_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.clients
    ADD CONSTRAINT businesses_green_invoice_match_businesses_id_fk FOREIGN KEY (business_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: businesses_securities businesses_securities_businesses_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.businesses_securities
    ADD CONSTRAINT businesses_securities_businesses_id_fk FOREIGN KEY (id) REFERENCES accounter_schema.businesses(id) ON DELETE CASCADE;


--
-- Name: businesses_securities businesses_securities_owner_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.businesses_securities
    ADD CONSTRAINT businesses_securities_owner_id_fk FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) ON DELETE CASCADE;


--
-- Name: charge_unbalanced_ledger_businesses charge-unbalanced-ledger-businesses_businesses_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.charge_unbalanced_ledger_businesses
    ADD CONSTRAINT "charge-unbalanced-ledger-businesses_businesses_id_fk" FOREIGN KEY (business_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: charge_unbalanced_ledger_businesses charge-unbalanced-ledger-businesses_charges_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.charge_unbalanced_ledger_businesses
    ADD CONSTRAINT "charge-unbalanced-ledger-businesses_charges_id_fk" FOREIGN KEY (charge_id) REFERENCES accounter_schema.charges(id);


--
-- Name: charge_balance_cancellation charge_balance_cancellation_businesses_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.charge_balance_cancellation
    ADD CONSTRAINT charge_balance_cancellation_businesses_id_fk FOREIGN KEY (business_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: charge_balance_cancellation charge_balance_cancellation_charges_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.charge_balance_cancellation
    ADD CONSTRAINT charge_balance_cancellation_charges_id_fk FOREIGN KEY (charge_id) REFERENCES accounter_schema.charges(id);


--
-- Name: charge_spread charge_spread_charges_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.charge_spread
    ADD CONSTRAINT charge_spread_charges_id_fk FOREIGN KEY (charge_id) REFERENCES accounter_schema.charges(id);


--
-- Name: charge_tags charge_tags_charges_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.charge_tags
    ADD CONSTRAINT charge_tags_charges_id_fk FOREIGN KEY (charge_id) REFERENCES accounter_schema.charges(id);


--
-- Name: charge_tags charge_tags_tags_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.charge_tags
    ADD CONSTRAINT charge_tags_tags_id_fk FOREIGN KEY (tag_id) REFERENCES accounter_schema.tags(id);


--
-- Name: charges_bank_deposits charges_bank_deposits_account_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.charges_bank_deposits
    ADD CONSTRAINT charges_bank_deposits_account_id_fk FOREIGN KEY (account_id) REFERENCES accounter_schema.financial_accounts(id);


--
-- Name: charges_bank_deposits charges_bank_deposits_charges_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.charges_bank_deposits
    ADD CONSTRAINT charges_bank_deposits_charges_id_fk FOREIGN KEY (id) REFERENCES accounter_schema.charges(id);


--
-- Name: charges charges_businesses_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.charges
    ADD CONSTRAINT charges_businesses_id_fk FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: charges_securities_executions charges_securities_executions_charge_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.charges_securities_executions
    ADD CONSTRAINT charges_securities_executions_charge_id_fk FOREIGN KEY (charge_id) REFERENCES accounter_schema.charges(id) ON DELETE SET NULL;


--
-- Name: charges_securities_executions charges_securities_executions_execution_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.charges_securities_executions
    ADD CONSTRAINT charges_securities_executions_execution_id_fk FOREIGN KEY (execution_id) REFERENCES accounter_schema.poalim_securities_transactions(id) ON DELETE CASCADE;


--
-- Name: charges_securities_executions charges_securities_executions_owner_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.charges_securities_executions
    ADD CONSTRAINT charges_securities_executions_owner_id_fk FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) ON DELETE CASCADE;


--
-- Name: charges charges_tax_categories_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.charges
    ADD CONSTRAINT charges_tax_categories_id_fk FOREIGN KEY (tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: clients_contracts clients_contracts_clients_business_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.clients_contracts
    ADD CONSTRAINT clients_contracts_clients_business_id_fk FOREIGN KEY (client_id) REFERENCES accounter_schema.clients(business_id);


--
-- Name: corporate_tax_variables corporate_tax_variables_businesses_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.corporate_tax_variables
    ADD CONSTRAINT corporate_tax_variables_businesses_id_fk FOREIGN KEY (corporate_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: crypto_exchange_rates crypto_exchange_rates_crypto_currencies_symbol_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.crypto_exchange_rates
    ADD CONSTRAINT crypto_exchange_rates_crypto_currencies_symbol_fk FOREIGN KEY (coin_symbol) REFERENCES accounter_schema.crypto_currencies(symbol);


--
-- Name: deel_invoices deel_invoices_documents_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.deel_invoices
    ADD CONSTRAINT deel_invoices_documents_id_fk FOREIGN KEY (document_id) REFERENCES accounter_schema.documents(id);


--
-- Name: deel_workers deel_workers_businesses_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.deel_workers
    ADD CONSTRAINT deel_workers_businesses_id_fk FOREIGN KEY (business_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: depreciation depreciation_asset_tax_category_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.depreciation
    ADD CONSTRAINT depreciation_asset_tax_category_id_fk FOREIGN KEY (asset_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: depreciation depreciation_charges_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.depreciation
    ADD CONSTRAINT depreciation_charges_id_fk FOREIGN KEY (charge_id) REFERENCES accounter_schema.charges(id);


--
-- Name: depreciation depreciation_depreciation_categories_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.depreciation
    ADD CONSTRAINT depreciation_depreciation_categories_id_fk FOREIGN KEY (category) REFERENCES accounter_schema.depreciation_categories(id);


--
-- Name: depreciation_disposals depreciation_disposals_charge_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.depreciation_disposals
    ADD CONSTRAINT depreciation_disposals_charge_id_fk FOREIGN KEY (charge_id) REFERENCES accounter_schema.charges(id) ON DELETE RESTRICT;


--
-- Name: depreciation_disposals depreciation_disposals_depreciation_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.depreciation_disposals
    ADD CONSTRAINT depreciation_disposals_depreciation_fk FOREIGN KEY (owner_id, depreciation_id) REFERENCES accounter_schema.depreciation(owner_id, id) ON DELETE CASCADE;


--
-- Name: depreciation_disposals depreciation_disposals_owner_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.depreciation_disposals
    ADD CONSTRAINT depreciation_disposals_owner_id_fk FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: dividends dividends_businesses_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.dividends
    ADD CONSTRAINT dividends_businesses_id_fk FOREIGN KEY (business_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: dividends dividends_transactions_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.dividends
    ADD CONSTRAINT dividends_transactions_id_fk FOREIGN KEY (transaction_id) REFERENCES accounter_schema.transactions(id);


--
-- Name: documents documents_businesses_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.documents
    ADD CONSTRAINT documents_businesses_id_fk FOREIGN KEY (debtor_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: documents documents_businesses_id_fk_2; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.documents
    ADD CONSTRAINT documents_businesses_id_fk_2 FOREIGN KEY (creditor_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: documents documents_charges_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.documents
    ADD CONSTRAINT documents_charges_id_fk FOREIGN KEY (charge_id) REFERENCES accounter_schema.charges(id);


--
-- Name: documents_issued documents_issued_documents_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.documents_issued
    ADD CONSTRAINT documents_issued_documents_id_fk FOREIGN KEY (id) REFERENCES accounter_schema.documents(id) ON DELETE CASCADE;


--
-- Name: dynamic_report_comments dynamic_report_comments_thread_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.dynamic_report_comments
    ADD CONSTRAINT dynamic_report_comments_thread_fk FOREIGN KEY (owner_id, thread_id) REFERENCES accounter_schema.dynamic_report_threads(owner_id, id) ON DELETE CASCADE;


--
-- Name: dynamic_report_template_snapshots dynamic_report_template_snapshots_template_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.dynamic_report_template_snapshots
    ADD CONSTRAINT dynamic_report_template_snapshots_template_fk FOREIGN KEY (owner_id, template_name) REFERENCES accounter_schema.dynamic_report_templates(owner_id, name) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: dynamic_report_templates dynamic_report_templates_businesses_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.dynamic_report_templates
    ADD CONSTRAINT dynamic_report_templates_businesses_id_fk FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: dynamic_report_threads dynamic_report_threads_template_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.dynamic_report_threads
    ADD CONSTRAINT dynamic_report_threads_template_fk FOREIGN KEY (owner_id, template_name) REFERENCES accounter_schema.dynamic_report_templates(owner_id, name) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: email_ingestion_alias_routing email_ingestion_alias_routing_owner_id_fkey; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.email_ingestion_alias_routing
    ADD CONSTRAINT email_ingestion_alias_routing_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) ON DELETE CASCADE;


--
-- Name: email_ingestion_dedup_fingerprints email_ingestion_dedup_fingerprints_owner_id_fkey; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.email_ingestion_dedup_fingerprints
    ADD CONSTRAINT email_ingestion_dedup_fingerprints_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) ON DELETE CASCADE;


--
-- Name: email_ingestion_grants email_ingestion_grants_business_id_fkey; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.email_ingestion_grants
    ADD CONSTRAINT email_ingestion_grants_business_id_fkey FOREIGN KEY (business_id) REFERENCES accounter_schema.businesses(id) ON DELETE SET NULL;


--
-- Name: email_ingestion_grants email_ingestion_grants_owner_id_fkey; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.email_ingestion_grants
    ADD CONSTRAINT email_ingestion_grants_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) ON DELETE CASCADE;


--
-- Name: email_ingestion_idempotency_keys email_ingestion_idempotency_keys_owner_id_fkey; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.email_ingestion_idempotency_keys
    ADD CONSTRAINT email_ingestion_idempotency_keys_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) ON DELETE CASCADE;


--
-- Name: email_ingestion_replay_nonces email_ingestion_replay_nonces_owner_id_fkey; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.email_ingestion_replay_nonces
    ADD CONSTRAINT email_ingestion_replay_nonces_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) ON DELETE CASCADE;


--
-- Name: employees employees_businesses_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.employees
    ADD CONSTRAINT employees_businesses_id_fk FOREIGN KEY (business_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: financial_accounts_tax_categories financial_accounts_tax_categories_financial_accounts_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.financial_accounts_tax_categories
    ADD CONSTRAINT financial_accounts_tax_categories_financial_accounts_id_fk FOREIGN KEY (financial_account_id) REFERENCES accounter_schema.financial_accounts(id);


--
-- Name: financial_accounts_tax_categories financial_accounts_tax_categories_tax_categories_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.financial_accounts_tax_categories
    ADD CONSTRAINT financial_accounts_tax_categories_tax_categories_id_fk FOREIGN KEY (tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: financial_entities financial_entities_businesses_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.financial_entities
    ADD CONSTRAINT financial_entities_businesses_id_fk FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: financial_entities financial_entities_hash_sort_codes_key_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.financial_entities
    ADD CONSTRAINT financial_entities_hash_sort_codes_key_fk FOREIGN KEY (sort_code, owner_id) REFERENCES accounter_schema.sort_codes(key, owner_id);


--
-- Name: business_tax_category_match fk_business_tax_category_match_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_tax_category_match
    ADD CONSTRAINT fk_business_tax_category_match_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: business_trip_charges fk_business_trip_charges_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_trip_charges
    ADD CONSTRAINT fk_business_trip_charges_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: business_trips_attendees fk_business_trips_attendees_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_trips_attendees
    ADD CONSTRAINT fk_business_trips_attendees_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: business_trips_employee_payments fk_business_trips_employee_payments_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_trips_employee_payments
    ADD CONSTRAINT fk_business_trips_employee_payments_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: business_trips fk_business_trips_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_trips
    ADD CONSTRAINT fk_business_trips_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: business_trips_transactions_accommodations fk_business_trips_transactions_accommodations_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_trips_transactions_accommodations
    ADD CONSTRAINT fk_business_trips_transactions_accommodations_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: business_trips_transactions_car_rental fk_business_trips_transactions_car_rental_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_trips_transactions_car_rental
    ADD CONSTRAINT fk_business_trips_transactions_car_rental_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: business_trips_transactions_flights fk_business_trips_transactions_flights_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_trips_transactions_flights
    ADD CONSTRAINT fk_business_trips_transactions_flights_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: business_trips_transactions_match fk_business_trips_transactions_match_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_trips_transactions_match
    ADD CONSTRAINT fk_business_trips_transactions_match_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: business_trips_transactions_other fk_business_trips_transactions_other_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_trips_transactions_other
    ADD CONSTRAINT fk_business_trips_transactions_other_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: business_trips_transactions fk_business_trips_transactions_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_trips_transactions
    ADD CONSTRAINT fk_business_trips_transactions_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: business_trips_transactions_tns fk_business_trips_transactions_tns_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.business_trips_transactions_tns
    ADD CONSTRAINT fk_business_trips_transactions_tns_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: businesses_admin fk_businesses_admin_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.businesses_admin
    ADD CONSTRAINT fk_businesses_admin_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: businesses fk_businesses_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.businesses
    ADD CONSTRAINT fk_businesses_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: charge_balance_cancellation fk_charge_balance_cancellation_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.charge_balance_cancellation
    ADD CONSTRAINT fk_charge_balance_cancellation_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: charge_spread fk_charge_spread_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.charge_spread
    ADD CONSTRAINT fk_charge_spread_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: charge_tags fk_charge_tags_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.charge_tags
    ADD CONSTRAINT fk_charge_tags_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: charge_unbalanced_ledger_businesses fk_charge_unbalanced_ledger_businesses_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.charge_unbalanced_ledger_businesses
    ADD CONSTRAINT fk_charge_unbalanced_ledger_businesses_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: charges_bank_deposits fk_charges_bank_deposits_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.charges_bank_deposits
    ADD CONSTRAINT fk_charges_bank_deposits_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: charges fk_charges_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.charges
    ADD CONSTRAINT fk_charges_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: clients_contracts fk_clients_contracts_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.clients_contracts
    ADD CONSTRAINT fk_clients_contracts_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: clients fk_clients_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.clients
    ADD CONSTRAINT fk_clients_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: corporate_tax_variables fk_corporate_tax_variables_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.corporate_tax_variables
    ADD CONSTRAINT fk_corporate_tax_variables_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: deel_invoices fk_deel_invoices_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.deel_invoices
    ADD CONSTRAINT fk_deel_invoices_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: deel_workers fk_deel_workers_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.deel_workers
    ADD CONSTRAINT fk_deel_workers_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: depreciation fk_depreciation_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.depreciation
    ADD CONSTRAINT fk_depreciation_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: dividends fk_dividends_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.dividends
    ADD CONSTRAINT fk_dividends_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: documents_issued fk_documents_issued_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.documents_issued
    ADD CONSTRAINT fk_documents_issued_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: documents fk_documents_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.documents
    ADD CONSTRAINT fk_documents_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: dynamic_report_templates fk_dynamic_report_templates_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.dynamic_report_templates
    ADD CONSTRAINT fk_dynamic_report_templates_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: employees fk_employees_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.employees
    ADD CONSTRAINT fk_employees_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: financial_accounts fk_financial_accounts_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.financial_accounts
    ADD CONSTRAINT fk_financial_accounts_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: financial_accounts_tax_categories fk_financial_accounts_tax_categories_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.financial_accounts_tax_categories
    ADD CONSTRAINT fk_financial_accounts_tax_categories_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: financial_bank_accounts fk_financial_bank_accounts_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.financial_bank_accounts
    ADD CONSTRAINT fk_financial_bank_accounts_id FOREIGN KEY (id) REFERENCES accounter_schema.financial_accounts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: financial_bank_accounts fk_financial_bank_accounts_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.financial_bank_accounts
    ADD CONSTRAINT fk_financial_bank_accounts_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: financial_entities fk_financial_entities_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.financial_entities
    ADD CONSTRAINT fk_financial_entities_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: ledger_records fk_ledger_records_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.ledger_records
    ADD CONSTRAINT fk_ledger_records_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: misc_expenses fk_misc_expenses_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.misc_expenses
    ADD CONSTRAINT fk_misc_expenses_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: pcn874 fk_pcn874_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.pcn874
    ADD CONSTRAINT fk_pcn874_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: pension_funds fk_pension_funds_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.pension_funds
    ADD CONSTRAINT fk_pension_funds_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: salaries fk_salaries_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.salaries
    ADD CONSTRAINT fk_salaries_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: sort_codes fk_sort_codes_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.sort_codes
    ADD CONSTRAINT fk_sort_codes_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: tags fk_tags_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.tags
    ADD CONSTRAINT fk_tags_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: tax_categories fk_tax_categories_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.tax_categories
    ADD CONSTRAINT fk_tax_categories_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: transactions fk_transactions_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.transactions
    ADD CONSTRAINT fk_transactions_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: user_context fk_user_context_owner_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT fk_user_context_owner_id FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: users fk_users_id; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.users
    ADD CONSTRAINT fk_users_id FOREIGN KEY (id) REFERENCES accounter_schema.financial_entities(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: invitations invitations_business_id_fkey; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.invitations
    ADD CONSTRAINT invitations_business_id_fkey FOREIGN KEY (business_id) REFERENCES accounter_schema.businesses_admin(id) ON DELETE CASCADE;


--
-- Name: invitations invitations_invited_by_fkey; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.invitations
    ADD CONSTRAINT invitations_invited_by_fkey FOREIGN KEY (invited_by_user_id, invited_by_business_id) REFERENCES accounter_schema.business_users(user_id, business_id) ON DELETE SET NULL;


--
-- Name: invitations invitations_role_id_fkey; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.invitations
    ADD CONSTRAINT invitations_role_id_fkey FOREIGN KEY (role_id) REFERENCES accounter_schema.roles(id) ON DELETE RESTRICT;


--
-- Name: invitations invitations_user_business_fkey; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.invitations
    ADD CONSTRAINT invitations_user_business_fkey FOREIGN KEY (user_id, business_id) REFERENCES accounter_schema.business_users(user_id, business_id) ON DELETE CASCADE;


--
-- Name: ledger_records ledger_records_businesses_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.ledger_records
    ADD CONSTRAINT ledger_records_businesses_id_fk FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: ledger_records ledger_records_charges_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.ledger_records
    ADD CONSTRAINT ledger_records_charges_id_fk FOREIGN KEY (charge_id) REFERENCES accounter_schema.charges(id);


--
-- Name: ledger_records ledger_records_financial_entities_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.ledger_records
    ADD CONSTRAINT ledger_records_financial_entities_id_fk FOREIGN KEY (debit_entity1) REFERENCES accounter_schema.financial_entities(id);


--
-- Name: ledger_records ledger_records_financial_entities_id_fk_2; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.ledger_records
    ADD CONSTRAINT ledger_records_financial_entities_id_fk_2 FOREIGN KEY (credit_entity1) REFERENCES accounter_schema.financial_entities(id);


--
-- Name: ledger_records ledger_records_financial_entities_id_fk_3; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.ledger_records
    ADD CONSTRAINT ledger_records_financial_entities_id_fk_3 FOREIGN KEY (debit_entity2) REFERENCES accounter_schema.financial_entities(id);


--
-- Name: ledger_records ledger_records_financial_entities_id_fk_4; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.ledger_records
    ADD CONSTRAINT ledger_records_financial_entities_id_fk_4 FOREIGN KEY (credit_entity2) REFERENCES accounter_schema.financial_entities(id);


--
-- Name: misc_expenses misc_expenses_charge_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.misc_expenses
    ADD CONSTRAINT misc_expenses_charge_id_fk FOREIGN KEY (charge_id) REFERENCES accounter_schema.charges(id);


--
-- Name: misc_expenses misc_expenses_financial_entities_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.misc_expenses
    ADD CONSTRAINT misc_expenses_financial_entities_id_fk FOREIGN KEY (creditor_id) REFERENCES accounter_schema.financial_entities(id);


--
-- Name: misc_expenses misc_expenses_financial_entities_id_fk_2; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.misc_expenses
    ADD CONSTRAINT misc_expenses_financial_entities_id_fk_2 FOREIGN KEY (debtor_id) REFERENCES accounter_schema.financial_entities(id);


--
-- Name: otsar_hahayal_creditcard_transactions otsar_hahayal_creditcard_transactions_owner_id_fkey; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.otsar_hahayal_creditcard_transactions
    ADD CONSTRAINT otsar_hahayal_creditcard_transactions_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) ON DELETE CASCADE;


--
-- Name: otsar_hahayal_foreign_account_transactions otsar_hahayal_foreign_account_transactions_owner_id_fkey; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.otsar_hahayal_foreign_account_transactions
    ADD CONSTRAINT otsar_hahayal_foreign_account_transactions_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) ON DELETE CASCADE;


--
-- Name: otsar_hahayal_ils_account_transactions otsar_hahayal_ils_account_transactions_owner_id_fkey; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.otsar_hahayal_ils_account_transactions
    ADD CONSTRAINT otsar_hahayal_ils_account_transactions_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) ON DELETE CASCADE;


--
-- Name: pcn874 pcn874_businesses_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.pcn874
    ADD CONSTRAINT pcn874_businesses_id_fk FOREIGN KEY (business_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: pension_funds pension_funds_businesses_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.pension_funds
    ADD CONSTRAINT pension_funds_businesses_id_fk FOREIGN KEY (id) REFERENCES accounter_schema.businesses(id);


--
-- Name: poalim_deposit_tax_events poalim_deposit_tax_events_owner_id_fkey; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.poalim_deposit_tax_events
    ADD CONSTRAINT poalim_deposit_tax_events_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) ON DELETE CASCADE;


--
-- Name: poalim_securities poalim_securities_owner_id_fkey; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.poalim_securities
    ADD CONSTRAINT poalim_securities_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) ON DELETE CASCADE;


--
-- Name: poalim_securities_transactions poalim_securities_transactions_owner_id_fkey; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.poalim_securities_transactions
    ADD CONSTRAINT poalim_securities_transactions_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) ON DELETE CASCADE;


--
-- Name: price_index_values price_index_values_index_code_base_label_fkey; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.price_index_values
    ADD CONSTRAINT price_index_values_index_code_base_label_fkey FOREIGN KEY (index_code, base_label) REFERENCES accounter_schema.price_index_bases(index_code, base_label);


--
-- Name: provider_credentials provider_credentials_business_id_fkey; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.provider_credentials
    ADD CONSTRAINT provider_credentials_business_id_fkey FOREIGN KEY (business_id) REFERENCES accounter_schema.businesses(id) ON DELETE SET NULL;


--
-- Name: provider_credentials provider_credentials_owner_id_fkey; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.provider_credentials
    ADD CONSTRAINT provider_credentials_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) ON DELETE CASCADE;


--
-- Name: report_1214_profiles report_1214_profiles_businesses_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.report_1214_profiles
    ADD CONSTRAINT report_1214_profiles_businesses_id_fk FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES accounter_schema.permissions(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES accounter_schema.roles(id) ON DELETE CASCADE;


--
-- Name: salaries salaries_charges_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.salaries
    ADD CONSTRAINT salaries_charges_id_fk FOREIGN KEY (charge_id) REFERENCES accounter_schema.charges(id);


--
-- Name: salaries salaries_employees_business_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.salaries
    ADD CONSTRAINT salaries_employees_business_id_fk FOREIGN KEY (employee_id) REFERENCES accounter_schema.employees(business_id);


--
-- Name: salaries salaries_pension_funds_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.salaries
    ADD CONSTRAINT salaries_pension_funds_id_fk FOREIGN KEY (training_fund_id) REFERENCES accounter_schema.pension_funds(id);


--
-- Name: salaries salaries_pension_funds_id_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.salaries
    ADD CONSTRAINT salaries_pension_funds_id_id_fk FOREIGN KEY (pension_fund_id) REFERENCES accounter_schema.pension_funds(id);


--
-- Name: security_identifiers security_identifiers_businesses_securities_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.security_identifiers
    ADD CONSTRAINT security_identifiers_businesses_securities_id_fk FOREIGN KEY (business_id) REFERENCES accounter_schema.businesses_securities(id) ON DELETE CASCADE;


--
-- Name: security_identifiers security_identifiers_owner_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.security_identifiers
    ADD CONSTRAINT security_identifiers_owner_id_fk FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) ON DELETE CASCADE;


--
-- Name: shareholders shareholders_business_businesses_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.shareholders
    ADD CONSTRAINT shareholders_business_businesses_id_fk FOREIGN KEY (business_id) REFERENCES accounter_schema.businesses(id) ON DELETE SET NULL;


--
-- Name: shareholders shareholders_owner_businesses_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.shareholders
    ADD CONSTRAINT shareholders_owner_businesses_id_fk FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: tags tags_tags_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.tags
    ADD CONSTRAINT tags_tags_id_fk FOREIGN KEY (parent) REFERENCES accounter_schema.tags(id);


--
-- Name: tax_categories tax_categories_financial_entities_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.tax_categories
    ADD CONSTRAINT tax_categories_financial_entities_id_fk FOREIGN KEY (id) REFERENCES accounter_schema.financial_entities(id);


--
-- Name: transactions transactions_businesses_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.transactions
    ADD CONSTRAINT transactions_businesses_id_fk FOREIGN KEY (business_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: transactions transactions_charges_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.transactions
    ADD CONSTRAINT transactions_charges_id_fk FOREIGN KEY (charge_id) REFERENCES accounter_schema.charges(id);


--
-- Name: transactions transactions_financial_accounts_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.transactions
    ADD CONSTRAINT transactions_financial_accounts_id_fk FOREIGN KEY (account_id) REFERENCES accounter_schema.financial_accounts(id);


--
-- Name: transactions_raw_list transactions_raw_list_isracard_creditcard_transactions_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.transactions_raw_list
    ADD CONSTRAINT transactions_raw_list_isracard_creditcard_transactions_id_fk FOREIGN KEY (creditcard_id) REFERENCES accounter_schema.isracard_creditcard_transactions(id);


--
-- Name: transactions_raw_list transactions_raw_list_max_creditcard_id_fkey; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.transactions_raw_list
    ADD CONSTRAINT transactions_raw_list_max_creditcard_id_fkey FOREIGN KEY (max_creditcard_id) REFERENCES accounter_schema.max_creditcard_transactions(id);


--
-- Name: transactions_raw_list transactions_raw_list_otsar_hahayal_creditcard_id_fkey; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.transactions_raw_list
    ADD CONSTRAINT transactions_raw_list_otsar_hahayal_creditcard_id_fkey FOREIGN KEY (otsar_hahayal_creditcard_id) REFERENCES accounter_schema.otsar_hahayal_creditcard_transactions(id) ON DELETE CASCADE;


--
-- Name: transactions_raw_list transactions_raw_list_otsar_hahayal_foreign_id_fkey; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.transactions_raw_list
    ADD CONSTRAINT transactions_raw_list_otsar_hahayal_foreign_id_fkey FOREIGN KEY (otsar_hahayal_foreign_id) REFERENCES accounter_schema.otsar_hahayal_foreign_account_transactions(id) ON DELETE CASCADE;


--
-- Name: transactions_raw_list transactions_raw_list_otsar_hahayal_ils_id_fkey; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.transactions_raw_list
    ADD CONSTRAINT transactions_raw_list_otsar_hahayal_ils_id_fkey FOREIGN KEY (otsar_hahayal_ils_id) REFERENCES accounter_schema.otsar_hahayal_ils_account_transactions(id) ON DELETE CASCADE;


--
-- Name: transactions_raw_list transactions_raw_list_poalim_foreign_account_transactions_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.transactions_raw_list
    ADD CONSTRAINT transactions_raw_list_poalim_foreign_account_transactions_id_fk FOREIGN KEY (poalim_foreign_id) REFERENCES accounter_schema.poalim_foreign_account_transactions(id);


--
-- Name: transactions_raw_list transactions_raw_list_poalim_ils_account_transactions_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.transactions_raw_list
    ADD CONSTRAINT transactions_raw_list_poalim_ils_account_transactions_id_fk FOREIGN KEY (poalim_ils_id) REFERENCES accounter_schema.poalim_ils_account_transactions(id);


--
-- Name: transactions_raw_list transactions_raw_list_poalim_swift_account_transactions_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.transactions_raw_list
    ADD CONSTRAINT transactions_raw_list_poalim_swift_account_transactions_id_fk FOREIGN KEY (poalim_swift_id) REFERENCES accounter_schema.poalim_swift_account_transactions(id);


--
-- Name: transactions transactions_transactions_raw_list_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.transactions
    ADD CONSTRAINT transactions_transactions_raw_list_id_fk FOREIGN KEY (source_id) REFERENCES accounter_schema.transactions_raw_list(id);


--
-- Name: user_context user_context_bank_deposit_withholding_tax_category_id_fkey; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_bank_deposit_withholding_tax_category_id_fkey FOREIGN KEY (bank_deposit_withholding_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_businesses_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_businesses_id_fk FOREIGN KEY (vat_business_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: user_context user_context_businesses_id_fk_10; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_businesses_id_fk_10 FOREIGN KEY (amex_business_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: user_context user_context_businesses_id_fk_11; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_businesses_id_fk_11 FOREIGN KEY (cal_business_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: user_context user_context_businesses_id_fk_12; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_businesses_id_fk_12 FOREIGN KEY (etana_business_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: user_context user_context_businesses_id_fk_13; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_businesses_id_fk_13 FOREIGN KEY (kraken_business_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: user_context user_context_businesses_id_fk_14; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_businesses_id_fk_14 FOREIGN KEY (etherscan_business_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: user_context user_context_businesses_id_fk_15; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_businesses_id_fk_15 FOREIGN KEY (swift_business_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: user_context user_context_businesses_id_fk_16; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_businesses_id_fk_16 FOREIGN KEY (bank_deposit_business_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: user_context user_context_businesses_id_fk_17; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_businesses_id_fk_17 FOREIGN KEY (dividend_withholding_tax_business_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: user_context user_context_businesses_id_fk_18; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_businesses_id_fk_18 FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: user_context user_context_businesses_id_fk_19; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_businesses_id_fk_19 FOREIGN KEY (foreign_securities_business_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: user_context user_context_businesses_id_fk_2; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_businesses_id_fk_2 FOREIGN KEY (tax_business_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: user_context user_context_businesses_id_fk_20; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_businesses_id_fk_20 FOREIGN KEY (otsar_hahayal_business_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: user_context user_context_businesses_id_fk_21; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_businesses_id_fk_21 FOREIGN KEY (otsar_hahayal_credit_card_business_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: user_context user_context_businesses_id_fk_3; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_businesses_id_fk_3 FOREIGN KEY (social_security_business_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: user_context user_context_businesses_id_fk_4; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_businesses_id_fk_4 FOREIGN KEY (batched_employees_business_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: user_context user_context_businesses_id_fk_5; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_businesses_id_fk_5 FOREIGN KEY (batched_funds_business_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: user_context user_context_businesses_id_fk_6; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_businesses_id_fk_6 FOREIGN KEY (tax_deductions_business_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: user_context user_context_businesses_id_fk_7; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_businesses_id_fk_7 FOREIGN KEY (poalim_business_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: user_context user_context_businesses_id_fk_8; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_businesses_id_fk_8 FOREIGN KEY (discount_business_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: user_context user_context_businesses_id_fk_9; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_businesses_id_fk_9 FOREIGN KEY (isracard_business_id) REFERENCES accounter_schema.businesses(id);


--
-- Name: user_context user_context_countries_code_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_countries_code_fk FOREIGN KEY (locality) REFERENCES accounter_schema.countries(code);


--
-- Name: user_context user_context_tags_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tags_id_fk FOREIGN KEY (business_trip_tag_id) REFERENCES accounter_schema.tags(id);


--
-- Name: user_context user_context_tax_categories_id_fk; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk FOREIGN KEY (default_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_10; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_10 FOREIGN KEY (fine_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_11; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_11 FOREIGN KEY (untaxable_gifts_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_12; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_12 FOREIGN KEY (balance_cancellation_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_13; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_13 FOREIGN KEY (development_foreign_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_14; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_14 FOREIGN KEY (development_local_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_15; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_15 FOREIGN KEY (accumulated_depreciation_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_16; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_16 FOREIGN KEY (rnd_depreciation_expenses_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_17; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_17 FOREIGN KEY (gnm_depreciation_expenses_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_18; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_18 FOREIGN KEY (marketing_depreciation_expenses_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_19; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_19 FOREIGN KEY (bank_deposit_interest_income_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_2; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_2 FOREIGN KEY (input_vat_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_20; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_20 FOREIGN KEY (business_trip_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_21; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_21 FOREIGN KEY (expenses_to_pay_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_22; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_22 FOREIGN KEY (expenses_in_advance_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_23; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_23 FOREIGN KEY (income_to_collect_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_24; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_24 FOREIGN KEY (income_in_advance_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_25; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_25 FOREIGN KEY (zkufot_expenses_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_26; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_26 FOREIGN KEY (zkufot_income_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_27; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_27 FOREIGN KEY (social_security_expenses_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_28; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_28 FOREIGN KEY (salary_expenses_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_29; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_29 FOREIGN KEY (training_fund_expenses_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_3; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_3 FOREIGN KEY (output_vat_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_30; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_30 FOREIGN KEY (pension_fund_expenses_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_31; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_31 FOREIGN KEY (compensation_fund_expenses_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_32; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_32 FOREIGN KEY (recovery_reserve_expenses_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_33; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_33 FOREIGN KEY (recovery_reserve_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_34; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_34 FOREIGN KEY (vacation_reserve_expenses_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_35; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_35 FOREIGN KEY (vacation_reserve_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_36; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_36 FOREIGN KEY (dividend_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_37; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_37 FOREIGN KEY (salary_excess_expenses_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_38; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_38 FOREIGN KEY (foreign_securities_fees_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_39; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_39 FOREIGN KEY (property_output_vat_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_4; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_4 FOREIGN KEY (tax_expenses_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_40; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_40 FOREIGN KEY (depreciation_disposal_gain_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_41; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_41 FOREIGN KEY (depreciation_disposal_loss_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_42; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_42 FOREIGN KEY (depreciation_correction_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_5; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_5 FOREIGN KEY (exchange_rate_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_6; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_6 FOREIGN KEY (income_exchange_rate_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_7; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_7 FOREIGN KEY (exchange_rate_revaluation_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_8; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_8 FOREIGN KEY (fee_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_context user_context_tax_categories_id_fk_9; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_context
    ADD CONSTRAINT user_context_tax_categories_id_fk_9 FOREIGN KEY (general_fee_tax_category_id) REFERENCES accounter_schema.tax_categories(id);


--
-- Name: user_permission_overrides user_permission_overrides_permission_id_fkey; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_permission_overrides
    ADD CONSTRAINT user_permission_overrides_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES accounter_schema.permissions(id) ON DELETE CASCADE;


--
-- Name: user_permission_overrides user_permission_overrides_user_id_business_id_fkey; Type: FK CONSTRAINT; Schema: accounter_schema; Owner: -
--

ALTER TABLE ONLY accounter_schema.user_permission_overrides
    ADD CONSTRAINT user_permission_overrides_user_id_business_id_fkey FOREIGN KEY (user_id, business_id) REFERENCES accounter_schema.business_users(user_id, business_id) ON DELETE CASCADE;


--
-- Name: email_ingestion_alias_routing alias_resolution_select; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY alias_resolution_select ON accounter_schema.email_ingestion_alias_routing FOR SELECT USING (true);


--
-- Name: businesses allow_bootstrap_root; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY allow_bootstrap_root ON accounter_schema.businesses FOR INSERT WITH CHECK ((id = accounter_schema.get_current_business_id()));


--
-- Name: financial_entities allow_bootstrap_root; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY allow_bootstrap_root ON accounter_schema.financial_entities USING ((id = accounter_schema.get_current_business_id())) WITH CHECK (((id = accounter_schema.get_current_business_id()) OR (owner_id = accounter_schema.get_current_business_id())));


--
-- Name: annual_audit_step_status; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.annual_audit_step_status ENABLE ROW LEVEL SECURITY;

--
-- Name: bank_deposits; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.bank_deposits ENABLE ROW LEVEL SECURITY;

--
-- Name: business_tax_category_match; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.business_tax_category_match ENABLE ROW LEVEL SECURITY;

--
-- Name: business_trip_charges; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.business_trip_charges ENABLE ROW LEVEL SECURITY;

--
-- Name: business_trips; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.business_trips ENABLE ROW LEVEL SECURITY;

--
-- Name: business_trips_attendees; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.business_trips_attendees ENABLE ROW LEVEL SECURITY;

--
-- Name: business_trips_employee_payments; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.business_trips_employee_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: business_trips_transactions; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.business_trips_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: business_trips_transactions_accommodations; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.business_trips_transactions_accommodations ENABLE ROW LEVEL SECURITY;

--
-- Name: business_trips_transactions_car_rental; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.business_trips_transactions_car_rental ENABLE ROW LEVEL SECURITY;

--
-- Name: business_trips_transactions_flights; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.business_trips_transactions_flights ENABLE ROW LEVEL SECURITY;

--
-- Name: business_trips_transactions_match; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.business_trips_transactions_match ENABLE ROW LEVEL SECURITY;

--
-- Name: business_trips_transactions_other; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.business_trips_transactions_other ENABLE ROW LEVEL SECURITY;

--
-- Name: business_trips_transactions_tns; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.business_trips_transactions_tns ENABLE ROW LEVEL SECURITY;

--
-- Name: businesses; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.businesses ENABLE ROW LEVEL SECURITY;

--
-- Name: businesses_admin; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.businesses_admin ENABLE ROW LEVEL SECURITY;

--
-- Name: businesses_securities; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.businesses_securities ENABLE ROW LEVEL SECURITY;

--
-- Name: charge_balance_cancellation; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.charge_balance_cancellation ENABLE ROW LEVEL SECURITY;

--
-- Name: charge_spread; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.charge_spread ENABLE ROW LEVEL SECURITY;

--
-- Name: charge_tags; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.charge_tags ENABLE ROW LEVEL SECURITY;

--
-- Name: charge_unbalanced_ledger_businesses; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.charge_unbalanced_ledger_businesses ENABLE ROW LEVEL SECURITY;

--
-- Name: charges; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.charges ENABLE ROW LEVEL SECURITY;

--
-- Name: charges_bank_deposits; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.charges_bank_deposits ENABLE ROW LEVEL SECURITY;

--
-- Name: charges_securities_executions; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.charges_securities_executions ENABLE ROW LEVEL SECURITY;

--
-- Name: clients; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.clients ENABLE ROW LEVEL SECURITY;

--
-- Name: clients_contracts; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.clients_contracts ENABLE ROW LEVEL SECURITY;

--
-- Name: corporate_tax_variables; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.corporate_tax_variables ENABLE ROW LEVEL SECURITY;

--
-- Name: deel_invoices; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.deel_invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: deel_workers; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.deel_workers ENABLE ROW LEVEL SECURITY;

--
-- Name: depreciation; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.depreciation ENABLE ROW LEVEL SECURITY;

--
-- Name: depreciation_disposals; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.depreciation_disposals ENABLE ROW LEVEL SECURITY;

--
-- Name: dividends; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.dividends ENABLE ROW LEVEL SECURITY;

--
-- Name: documents; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.documents ENABLE ROW LEVEL SECURITY;

--
-- Name: documents_issued; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.documents_issued ENABLE ROW LEVEL SECURITY;

--
-- Name: dynamic_report_comments; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.dynamic_report_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: dynamic_report_template_snapshots; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.dynamic_report_template_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: dynamic_report_templates; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.dynamic_report_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: dynamic_report_threads; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.dynamic_report_threads ENABLE ROW LEVEL SECURITY;

--
-- Name: email_ingestion_alias_routing; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.email_ingestion_alias_routing ENABLE ROW LEVEL SECURITY;

--
-- Name: email_ingestion_dedup_fingerprints; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.email_ingestion_dedup_fingerprints ENABLE ROW LEVEL SECURITY;

--
-- Name: email_ingestion_grants; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.email_ingestion_grants ENABLE ROW LEVEL SECURITY;

--
-- Name: email_ingestion_idempotency_keys; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.email_ingestion_idempotency_keys ENABLE ROW LEVEL SECURITY;

--
-- Name: email_ingestion_quarantine; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.email_ingestion_quarantine ENABLE ROW LEVEL SECURITY;

--
-- Name: email_ingestion_replay_nonces; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.email_ingestion_replay_nonces ENABLE ROW LEVEL SECURITY;

--
-- Name: employees; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.employees ENABLE ROW LEVEL SECURITY;

--
-- Name: financial_accounts; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.financial_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: financial_accounts_tax_categories; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.financial_accounts_tax_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: financial_bank_accounts; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.financial_bank_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: financial_entities; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.financial_entities ENABLE ROW LEVEL SECURITY;

--
-- Name: ledger_records; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.ledger_records ENABLE ROW LEVEL SECURITY;

--
-- Name: misc_expenses; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.misc_expenses ENABLE ROW LEVEL SECURITY;

--
-- Name: otsar_hahayal_creditcard_transactions; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.otsar_hahayal_creditcard_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: otsar_hahayal_foreign_account_transactions; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.otsar_hahayal_foreign_account_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: otsar_hahayal_ils_account_transactions; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.otsar_hahayal_ils_account_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: pcn874; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.pcn874 ENABLE ROW LEVEL SECURITY;

--
-- Name: pension_funds; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.pension_funds ENABLE ROW LEVEL SECURITY;

--
-- Name: poalim_deposit_tax_events; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.poalim_deposit_tax_events ENABLE ROW LEVEL SECURITY;

--
-- Name: poalim_securities; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.poalim_securities ENABLE ROW LEVEL SECURITY;

--
-- Name: poalim_securities_transactions; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.poalim_securities_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: provider_credentials; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.provider_credentials ENABLE ROW LEVEL SECURITY;

--
-- Name: email_ingestion_replay_nonces replay_nonce_select; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY replay_nonce_select ON accounter_schema.email_ingestion_replay_nonces FOR SELECT USING (true);


--
-- Name: report_1214_profiles; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.report_1214_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: salaries; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.salaries ENABLE ROW LEVEL SECURITY;

--
-- Name: security_identifiers; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.security_identifiers ENABLE ROW LEVEL SECURITY;

--
-- Name: shareholders; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.shareholders ENABLE ROW LEVEL SECURITY;

--
-- Name: sort_codes; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.sort_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: super_admins; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.super_admins ENABLE ROW LEVEL SECURITY;

--
-- Name: super_admins super_admins_select; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY super_admins_select ON accounter_schema.super_admins FOR SELECT USING (true);


--
-- Name: tags; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.tags ENABLE ROW LEVEL SECURITY;

--
-- Name: tax_categories; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.tax_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: annual_audit_step_status tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.annual_audit_step_status USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: bank_deposits tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.bank_deposits USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: business_tax_category_match tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.business_tax_category_match USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: business_trip_charges tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.business_trip_charges USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: business_trips tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.business_trips USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: business_trips_attendees tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.business_trips_attendees USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: business_trips_employee_payments tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.business_trips_employee_payments USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: business_trips_transactions tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.business_trips_transactions USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: business_trips_transactions_accommodations tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.business_trips_transactions_accommodations USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: business_trips_transactions_car_rental tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.business_trips_transactions_car_rental USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: business_trips_transactions_flights tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.business_trips_transactions_flights USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: business_trips_transactions_match tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.business_trips_transactions_match USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: business_trips_transactions_other tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.business_trips_transactions_other USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: business_trips_transactions_tns tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.business_trips_transactions_tns USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: businesses tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.businesses USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: businesses_admin tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.businesses_admin USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: businesses_securities tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.businesses_securities USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: charge_balance_cancellation tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.charge_balance_cancellation USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: charge_spread tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.charge_spread USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: charge_tags tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.charge_tags USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: charge_unbalanced_ledger_businesses tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.charge_unbalanced_ledger_businesses USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: charges tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.charges USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: charges_bank_deposits tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.charges_bank_deposits USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: charges_securities_executions tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.charges_securities_executions USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: clients tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.clients USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: clients_contracts tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.clients_contracts USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: corporate_tax_variables tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.corporate_tax_variables USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: deel_invoices tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.deel_invoices USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: deel_workers tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.deel_workers USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: depreciation tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.depreciation USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: depreciation_disposals tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.depreciation_disposals USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: dividends tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.dividends USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: documents tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.documents USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: documents_issued tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.documents_issued USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: dynamic_report_comments tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.dynamic_report_comments USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: dynamic_report_template_snapshots tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.dynamic_report_template_snapshots USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: dynamic_report_templates tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.dynamic_report_templates USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: dynamic_report_threads tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.dynamic_report_threads USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: email_ingestion_dedup_fingerprints tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.email_ingestion_dedup_fingerprints USING ((owner_id = accounter_schema.get_current_business_id())) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: email_ingestion_grants tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.email_ingestion_grants USING ((owner_id = accounter_schema.get_current_business_id())) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: email_ingestion_idempotency_keys tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.email_ingestion_idempotency_keys USING ((owner_id = accounter_schema.get_current_business_id())) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: email_ingestion_quarantine tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.email_ingestion_quarantine USING ((tenant_candidate = accounter_schema.get_current_business_id())) WITH CHECK ((tenant_candidate = accounter_schema.get_current_business_id()));


--
-- Name: employees tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.employees USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: financial_accounts tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.financial_accounts USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: financial_accounts_tax_categories tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.financial_accounts_tax_categories USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: financial_bank_accounts tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.financial_bank_accounts USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: financial_entities tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.financial_entities USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: ledger_records tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.ledger_records USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: misc_expenses tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.misc_expenses USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: otsar_hahayal_creditcard_transactions tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.otsar_hahayal_creditcard_transactions USING ((owner_id = accounter_schema.get_current_business_id())) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: otsar_hahayal_foreign_account_transactions tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.otsar_hahayal_foreign_account_transactions USING ((owner_id = accounter_schema.get_current_business_id())) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: otsar_hahayal_ils_account_transactions tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.otsar_hahayal_ils_account_transactions USING ((owner_id = accounter_schema.get_current_business_id())) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: pcn874 tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.pcn874 USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: pension_funds tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.pension_funds USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: poalim_deposit_tax_events tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.poalim_deposit_tax_events USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: poalim_securities tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.poalim_securities USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: poalim_securities_transactions tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.poalim_securities_transactions USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: provider_credentials tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.provider_credentials USING ((owner_id = accounter_schema.get_current_business_id())) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: report_1214_profiles tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.report_1214_profiles USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: salaries tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.salaries USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: security_identifiers tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.security_identifiers USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: shareholders tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.shareholders USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: sort_codes tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.sort_codes USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: tags tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.tags USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: tax_categories tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.tax_categories USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: transactions tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.transactions USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: user_context tenant_isolation; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation ON accounter_schema.user_context USING ((owner_id = ANY (accounter_schema.get_current_business_scope()))) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: annual_audit_step_status tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.annual_audit_step_status AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: bank_deposits tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.bank_deposits AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: business_tax_category_match tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.business_tax_category_match AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: business_trip_charges tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.business_trip_charges AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: business_trips tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.business_trips AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: business_trips_attendees tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.business_trips_attendees AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: business_trips_employee_payments tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.business_trips_employee_payments AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: business_trips_transactions tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.business_trips_transactions AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: business_trips_transactions_accommodations tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.business_trips_transactions_accommodations AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: business_trips_transactions_car_rental tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.business_trips_transactions_car_rental AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: business_trips_transactions_flights tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.business_trips_transactions_flights AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: business_trips_transactions_match tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.business_trips_transactions_match AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: business_trips_transactions_other tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.business_trips_transactions_other AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: business_trips_transactions_tns tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.business_trips_transactions_tns AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: businesses tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.businesses AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: businesses_admin tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.businesses_admin AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: businesses_securities tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.businesses_securities AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: charge_balance_cancellation tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.charge_balance_cancellation AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: charge_spread tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.charge_spread AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: charge_tags tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.charge_tags AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: charge_unbalanced_ledger_businesses tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.charge_unbalanced_ledger_businesses AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: charges tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.charges AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: charges_bank_deposits tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.charges_bank_deposits AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: charges_securities_executions tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.charges_securities_executions AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: clients tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.clients AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: clients_contracts tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.clients_contracts AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: corporate_tax_variables tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.corporate_tax_variables AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: deel_invoices tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.deel_invoices AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: deel_workers tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.deel_workers AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: depreciation tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.depreciation AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: depreciation_disposals tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.depreciation_disposals AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: dividends tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.dividends AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: documents tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.documents AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: documents_issued tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.documents_issued AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: dynamic_report_comments tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.dynamic_report_comments AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: dynamic_report_template_snapshots tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.dynamic_report_template_snapshots AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: dynamic_report_templates tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.dynamic_report_templates AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: dynamic_report_threads tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.dynamic_report_threads AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: employees tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.employees AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: financial_accounts tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.financial_accounts AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: financial_accounts_tax_categories tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.financial_accounts_tax_categories AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: financial_bank_accounts tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.financial_bank_accounts AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: financial_entities tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.financial_entities AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: ledger_records tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.ledger_records AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: misc_expenses tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.misc_expenses AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: pcn874 tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.pcn874 AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: pension_funds tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.pension_funds AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: poalim_deposit_tax_events tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.poalim_deposit_tax_events AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: poalim_securities tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.poalim_securities AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: poalim_securities_transactions tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.poalim_securities_transactions AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: report_1214_profiles tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.report_1214_profiles AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: salaries tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.salaries AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: security_identifiers tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.security_identifiers AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: shareholders tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.shareholders AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: sort_codes tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.sort_codes AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: tags tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.tags AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: tax_categories tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.tax_categories AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: transactions tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.transactions AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: user_context tenant_isolation_delete; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_delete ON accounter_schema.user_context AS RESTRICTIVE FOR DELETE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: bank_deposits tenant_isolation_update; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_update ON accounter_schema.bank_deposits AS RESTRICTIVE FOR UPDATE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: businesses_securities tenant_isolation_update; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_update ON accounter_schema.businesses_securities AS RESTRICTIVE FOR UPDATE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: charges_securities_executions tenant_isolation_update; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_update ON accounter_schema.charges_securities_executions AS RESTRICTIVE FOR UPDATE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: depreciation_disposals tenant_isolation_update; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_update ON accounter_schema.depreciation_disposals AS RESTRICTIVE FOR UPDATE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: dynamic_report_comments tenant_isolation_update; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_update ON accounter_schema.dynamic_report_comments AS RESTRICTIVE FOR UPDATE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: dynamic_report_template_snapshots tenant_isolation_update; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_update ON accounter_schema.dynamic_report_template_snapshots AS RESTRICTIVE FOR UPDATE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: dynamic_report_threads tenant_isolation_update; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_update ON accounter_schema.dynamic_report_threads AS RESTRICTIVE FOR UPDATE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: poalim_deposit_tax_events tenant_isolation_update; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_update ON accounter_schema.poalim_deposit_tax_events AS RESTRICTIVE FOR UPDATE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: poalim_securities tenant_isolation_update; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_update ON accounter_schema.poalim_securities AS RESTRICTIVE FOR UPDATE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: poalim_securities_transactions tenant_isolation_update; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_update ON accounter_schema.poalim_securities_transactions AS RESTRICTIVE FOR UPDATE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: report_1214_profiles tenant_isolation_update; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_update ON accounter_schema.report_1214_profiles AS RESTRICTIVE FOR UPDATE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: security_identifiers tenant_isolation_update; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_update ON accounter_schema.security_identifiers AS RESTRICTIVE FOR UPDATE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: shareholders tenant_isolation_update; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_update ON accounter_schema.shareholders AS RESTRICTIVE FOR UPDATE USING ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: email_ingestion_alias_routing tenant_isolation_write; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_write ON accounter_schema.email_ingestion_alias_routing USING ((owner_id = accounter_schema.get_current_business_id())) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: email_ingestion_replay_nonces tenant_isolation_write; Type: POLICY; Schema: accounter_schema; Owner: -
--

CREATE POLICY tenant_isolation_write ON accounter_schema.email_ingestion_replay_nonces USING ((owner_id = accounter_schema.get_current_business_id())) WITH CHECK ((owner_id = accounter_schema.get_current_business_id()));


--
-- Name: transactions; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_context; Type: ROW SECURITY; Schema: accounter_schema; Owner: -
--

ALTER TABLE accounter_schema.user_context ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict iLCfRlEh1C5LHWd7Q5UuxqBh4GYXJyd5VOBdCqkojzdprZehXwvmuvUMP6M9dTL

