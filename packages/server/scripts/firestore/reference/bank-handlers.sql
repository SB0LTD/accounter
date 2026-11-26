-- insert_amex_transaction_handler

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

-- insert_cal_creditcard_transaction_handler

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

-- insert_creditcard_transaction_handler

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

-- insert_otsar_hahayal_creditcard_transaction_handler

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
    
-- insert_otsar_hahayal_foreign_transaction_handler

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
    
-- insert_otsar_hahayal_ils_transaction_handler

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
    
-- insert_poalim_cad_transaction_handler

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

-- insert_poalim_deposit_transaction_handler

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

-- insert_poalim_eur_transaction_handler

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

-- insert_poalim_foreign_transaction_handler

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

-- insert_poalim_gbp_transaction_handler

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

-- insert_poalim_ils_transaction_handler

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

-- insert_poalim_swift_transaction_handler

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

-- insert_poalim_usd_transaction_handler

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

