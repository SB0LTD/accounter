-- Business trips: rows for the business-trips ports (modules/business-trips) and the
-- extended_business_trip_transactions view. Applied on top of the demo seed by
-- `yarn workspace @accounter/server firestore:fixtures --only 010-business-trips`.
-- Idempotent: fixed UUIDs in the 0f010000-0000-4000-8000-xxxxxxxxxxxx range, ON CONFLICT DO NOTHING,
-- and a NOT EXISTS guard for the match table (it has no key).
--
-- Trips (…0001-…0005), two employee businesses (…00e1, …00e2), one EUR transaction with a
-- debit_date_override (…01e0), and business-trip expenses (…0101-…0109) covering what the view
-- distinguishes: matched to one / several transactions, mixed currencies, paid by an employee,
-- both, neither. Two extension rows (…01f1 car rental, …01f2 T&S) have no expense row (those tables
-- have no foreign key to business_trips_transactions).

DO $$
DECLARE
  owner UUID := (SELECT owner_id FROM accounter_schema.user_context LIMIT 1);
  -- demo charges, by id order
  charge_a UUID := (SELECT id FROM accounter_schema.charges WHERE owner_id = owner ORDER BY id OFFSET 0 LIMIT 1);
  charge_b UUID := (SELECT id FROM accounter_schema.charges WHERE owner_id = owner ORDER BY id OFFSET 1 LIMIT 1);
  charge_c UUID := (SELECT id FROM accounter_schema.charges WHERE owner_id = owner ORDER BY id OFFSET 2 LIMIT 1);
  charge_d UUID := (SELECT id FROM accounter_schema.charges WHERE owner_id = owner ORDER BY id OFFSET 3 LIMIT 1);
  charge_e UUID := (SELECT id FROM accounter_schema.charges WHERE owner_id = owner ORDER BY id OFFSET 4 LIMIT 1);
  -- demo transactions, by currency and id order
  usd_1 UUID := (SELECT id FROM accounter_schema.transactions WHERE owner_id = owner AND currency = 'USD' ORDER BY id OFFSET 0 LIMIT 1);
  usd_2 UUID := (SELECT id FROM accounter_schema.transactions WHERE owner_id = owner AND currency = 'USD' ORDER BY id OFFSET 1 LIMIT 1);
  usd_3 UUID := (SELECT id FROM accounter_schema.transactions WHERE owner_id = owner AND currency = 'USD' ORDER BY id OFFSET 2 LIMIT 1);
  usd_4 UUID := (SELECT id FROM accounter_schema.transactions WHERE owner_id = owner AND currency = 'USD' ORDER BY id OFFSET 3 LIMIT 1);
  ils_1 UUID := (SELECT id FROM accounter_schema.transactions WHERE owner_id = owner AND currency = 'ILS' ORDER BY id OFFSET 0 LIMIT 1);
  template accounter_schema.transactions%ROWTYPE;
BEGIN
  SELECT * INTO template FROM accounter_schema.transactions WHERE id = usd_1;

  -- employees (financial entity + business)
  INSERT INTO accounter_schema.financial_entities (id, type, owner_id, name, created_at, updated_at) VALUES
    ('0f010000-0000-4000-8000-0000000000e1', 'business', owner, 'BT Employee Dana', '2024-01-01 10:00:00', '2024-01-01 10:00:00'),
    ('0f010000-0000-4000-8000-0000000000e2', 'business', owner, 'BT Employee Omer', '2024-01-02 11:30:00', '2024-01-03 09:15:00')
  ON CONFLICT DO NOTHING;
  INSERT INTO accounter_schema.businesses (id, owner_id, hebrew_name, email, country, suggestion_data, pcn874_record_type_override, city, exempt_dealer) VALUES
    ('0f010000-0000-4000-8000-0000000000e1', owner, 'דנה', 'dana@example.com', 'ISR', '{"tags": ["travel"], "phrases": ["dana"]}', NULL, 'Tel Aviv', false),
    ('0f010000-0000-4000-8000-0000000000e2', owner, NULL, NULL, 'USA', NULL, 'S1', NULL, true)
  ON CONFLICT DO NOTHING;

  -- a EUR transaction whose debit date is overridden
  INSERT INTO accounter_schema.transactions (id, account_id, charge_id, source_id, currency, event_date, debit_date,
      debit_date_override, amount, current_balance, business_id, source_reference, source_origin, origin_key, owner_id)
  VALUES ('0f010000-0000-4000-8000-0000000001e0', template.account_id, charge_b, template.source_id,
      'EUR', '2024-05-02', '2024-05-20', '2024-05-25', -60.00, 0, '0f010000-0000-4000-8000-0000000000e2',
      'BT-REF', 'TEST', '0f010000-0000-4000-8000-0000000001e2', owner)
  ON CONFLICT DO NOTHING;

  -- trips
  INSERT INTO accounter_schema.business_trips (id, name, destination, trip_purpose, accountant_status, owner_id) VALUES
    ('0f010000-0000-4000-8000-000000000001', 'BT Berlin Conference', 'DEU', 'Conference', 'APPROVED', owner),
    ('0f010000-0000-4000-8000-000000000002', 'BT New York Sales', 'USA', 'Sales meetings', 'PENDING', owner),
    ('0f010000-0000-4000-8000-000000000003', 'BT Empty Trip', NULL, NULL, 'UNAPPROVED', owner),
    ('0f010000-0000-4000-8000-000000000004', 'BT Paris Workshop', 'FRA', 'Workshop', 'UNAPPROVED', owner),
    ('0f010000-0000-4000-8000-000000000005', 'BT London Two Charges', 'GBR', NULL, 'APPROVED', owner)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.business_trips_attendees (business_trip_id, attendee_business_id, arrival, departure, owner_id) VALUES
    ('0f010000-0000-4000-8000-000000000001', '0f010000-0000-4000-8000-0000000000e1', '2024-03-10', '2024-03-15', owner),
    ('0f010000-0000-4000-8000-000000000001', '0f010000-0000-4000-8000-0000000000e2', '2024-03-11', '2024-03-14', owner),
    ('0f010000-0000-4000-8000-000000000002', '0f010000-0000-4000-8000-0000000000e1', '2024-05-01', '2024-05-08', owner),
    ('0f010000-0000-4000-8000-000000000004', '0f010000-0000-4000-8000-0000000000e1', NULL, NULL, owner),
    ('0f010000-0000-4000-8000-000000000004', '0f010000-0000-4000-8000-0000000000e2', '2024-07-01', '2024-07-04', owner),
    ('0f010000-0000-4000-8000-000000000005', '0f010000-0000-4000-8000-0000000000e2', '2024-09-01', '2024-09-05', owner)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.business_trip_charges (charge_id, business_trip_id, owner_id) VALUES
    (charge_a, '0f010000-0000-4000-8000-000000000001', owner),
    (charge_b, '0f010000-0000-4000-8000-000000000002', owner),
    (charge_c, '0f010000-0000-4000-8000-000000000005', owner),
    (charge_d, '0f010000-0000-4000-8000-000000000005', owner),
    (charge_e, NULL, owner)
  ON CONFLICT DO NOTHING;

  -- expenses
  INSERT INTO accounter_schema.business_trips_transactions (id, business_trip_id, category, owner_id) VALUES
    ('0f010000-0000-4000-8000-000000000101', '0f010000-0000-4000-8000-000000000001', 'FLIGHT', owner),
    ('0f010000-0000-4000-8000-000000000102', '0f010000-0000-4000-8000-000000000001', 'ACCOMMODATION', owner),
    ('0f010000-0000-4000-8000-000000000103', '0f010000-0000-4000-8000-000000000001', 'TRAVEL_AND_SUBSISTENCE', owner),
    ('0f010000-0000-4000-8000-000000000104', '0f010000-0000-4000-8000-000000000002', 'CAR_RENTAL', owner),
    ('0f010000-0000-4000-8000-000000000105', '0f010000-0000-4000-8000-000000000002', 'OTHER', owner),
    ('0f010000-0000-4000-8000-000000000106', '0f010000-0000-4000-8000-000000000002', 'OTHER', owner),
    ('0f010000-0000-4000-8000-000000000107', '0f010000-0000-4000-8000-000000000005', 'ACCOMMODATION', owner),
    ('0f010000-0000-4000-8000-000000000108', '0f010000-0000-4000-8000-000000000005', 'FLIGHT', owner),
    -- nothing references this one
    ('0f010000-0000-4000-8000-000000000109', '0f010000-0000-4000-8000-000000000004', 'CAR_RENTAL', owner)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.business_trips_employee_payments (id, charge_id, date, value_date, amount, currency, employee_business_id, owner_id) VALUES
    ('0f010000-0000-4000-8000-000000000103', charge_a, '2024-03-12', '2024-03-20', 150.00, 'EUR', '0f010000-0000-4000-8000-0000000000e1', owner),
    ('0f010000-0000-4000-8000-000000000106', charge_b, '2024-05-03', NULL, 75.5, 'USD', '0f010000-0000-4000-8000-0000000000e2', owner),
    ('0f010000-0000-4000-8000-000000000107', charge_c, '2024-09-02', NULL, 980.40, 'ILS', '0f010000-0000-4000-8000-0000000000e2', owner)
  ON CONFLICT DO NOTHING;

  IF NOT EXISTS (
    SELECT 1 FROM accounter_schema.business_trips_transactions_match
    WHERE business_trip_transaction_id::text LIKE '0f010000-0000-4000-8000-%'
  ) THEN
    INSERT INTO accounter_schema.business_trips_transactions_match (business_trip_transaction_id, transaction_id, amount, owner_id) VALUES
      -- one transaction, matched twice: distinct ids, summed amounts
      ('0f010000-0000-4000-8000-000000000101', usd_1, 450.5, owner),
      ('0f010000-0000-4000-8000-000000000101', usd_1, 0.125, owner),
      -- two transactions in one currency
      ('0f010000-0000-4000-8000-000000000102', usd_2, 300, owner),
      ('0f010000-0000-4000-8000-000000000102', usd_3, 200.25, owner),
      -- mixed currencies: no amount, no currency
      ('0f010000-0000-4000-8000-000000000104', usd_4, 120.10, owner),
      ('0f010000-0000-4000-8000-000000000104', ils_1, 400, owner),
      -- matched and paid by an employee: the match wins
      ('0f010000-0000-4000-8000-000000000106', '0f010000-0000-4000-8000-0000000001e0', 60.00, owner);
  END IF;

  INSERT INTO accounter_schema.business_trips_transactions_flights (id, class, attendees, path, owner_id) VALUES
    ('0f010000-0000-4000-8000-000000000101', 'ECONOMY',
      ARRAY['0f010000-0000-4000-8000-0000000000e1', '0f010000-0000-4000-8000-0000000000e2']::uuid[],
      ARRAY['TLV', 'BER', 'TLV'], owner),
    ('0f010000-0000-4000-8000-000000000108', NULL, DEFAULT, NULL, owner)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.business_trips_transactions_accommodations (id, country, nights_count, attendees_stay, owner_id) VALUES
    ('0f010000-0000-4000-8000-000000000102', 'DEU', 5,
      ARRAY['{"attendeeId": "0f010000-0000-4000-8000-0000000000e1", "nightsCount": 5}',
            '{"attendeeId": "0f010000-0000-4000-8000-0000000000e2", "nightsCount": 3}']::jsonb[], owner),
    ('0f010000-0000-4000-8000-000000000107', 'GBR', NULL, DEFAULT, owner)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.business_trips_transactions_car_rental (id, days, is_fuel_expense, owner_id) VALUES
    ('0f010000-0000-4000-8000-000000000104', 4, false, owner),
    ('0f010000-0000-4000-8000-0000000001f1', 0, true, owner)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.business_trips_transactions_other (id, deductible_expense, description, owner_id) VALUES
    ('0f010000-0000-4000-8000-000000000105', true, 'Visa fees', owner),
    ('0f010000-0000-4000-8000-000000000106', NULL, NULL, owner)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.business_trips_transactions_tns (id, expense_type, owner_id) VALUES
    ('0f010000-0000-4000-8000-000000000103', 'per diem', owner),
    ('0f010000-0000-4000-8000-0000000001f2', NULL, owner)
  ON CONFLICT DO NOTHING;
END $$;

-- Tax variables (a global table)
INSERT INTO accounter_schema.business_trips_tax_variables (date, max_accommodation_per_night_first_7_nights,
    max_accommodation_per_night_nights_8_to_90, max_car_rental_per_day, max_tns_with_accommodation,
    max_tns_without_accommodation) VALUES
  ('2023-01-01', 132, 99.5, 73.00, 31.07, 49.15),
  ('2024-01-01', 143.10, 104, 75.5, 32.5, 51)
ON CONFLICT DO NOTHING;
