-- Fixture rows for the auth, onboarding, admin-context, email-ingestion and provider-credentials
-- ports (and the raw statements in raw/statements.ts). Idempotent; ids are fixed UUIDs in the
-- 0f080000-... range. Everything is owned by the demo tenant, except the rows of a second business
-- ("Fixture080 Sister Co", itself owned by the demo tenant) that exist to prove other tenants' rows
-- stay out of reach.

DO $$
DECLARE
  owner UUID := (SELECT owner_id FROM accounter_schema.user_context LIMIT 1);
  sister UUID := '0f080000-0000-4000-8000-000000000001';
  vendor UUID := '0f080000-0000-4000-8000-000000000002';
  odd UUID := '0f080000-0000-4000-8000-000000000003';
  security UUID := '0f080000-0000-4000-8000-000000000004';
  sister_security UUID := '0f080000-0000-4000-8000-000000000005';
  u1 UUID := '0f080000-0000-4000-8000-000000000101';
  u2 UUID := '0f080000-0000-4000-8000-000000000102';
  u3 UUID := '0f080000-0000-4000-8000-000000000103';
  u4 UUID := '0f080000-0000-4000-8000-000000000104';
  u5 UUID := '0f080000-0000-4000-8000-000000000105';
BEGIN
  -- Businesses: a sister business (admin-managed, owns its own rows below), a vendor and an odd one
  -- whose suggestion_data drive getBusinessByEmailForIngest, and two securities.
  INSERT INTO accounter_schema.financial_entities (id, type, name, owner_id) VALUES
    (sister, 'business', 'Fixture080 Sister Co', owner),
    (vendor, 'business', 'Fixture080 Vendor', owner),
    (odd, 'business', 'Fixture080 Odd Data', owner),
    (security, 'business', 'Fixture080 Security', owner)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.businesses (id, owner_id, hebrew_name, vat_number, suggestion_data) VALUES
    (sister, owner, 'אחות 080', '080000001', '{"emails": ["billing@sister080.example"]}'),
    (vendor, owner, NULL, '080000002',
      '{"emails": ["*@wild080.example", "Pct%_080@Vendor.example", "hash#080@vendor.example", 42, null]}'),
    (odd, owner, NULL, NULL, '{"emails": "notalist080@odd.example"}'),
    (security, owner, NULL, NULL, NULL)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.businesses_admin (id, owner_id) VALUES (sister, owner)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.financial_entities (id, type, name, owner_id) VALUES
    (sister_security, 'business', 'Fixture080 Sister Security', sister)
  ON CONFLICT DO NOTHING;
  INSERT INTO accounter_schema.businesses (id, owner_id) VALUES (sister_security, sister)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.businesses_securities (id, owner_id, isin, symbol) VALUES
    (security, owner, 'IL0080000001', 'FX080'),
    (sister_security, sister, 'IL0080000002', 'FX080S')
  ON CONFLICT DO NOTHING;

  -- Memberships: an owner in two businesses, invitation placeholders, an accepted member.
  INSERT INTO accounter_schema.business_users
    (user_id, business_id, role_id, auth0_user_id, created_at, updated_at) VALUES
    (u1, owner, 'business_owner', 'auth0|fixture080-owner', '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z'),
    (u1, sister, 'accountant', 'auth0|fixture080-owner', '2026-01-03T00:00:00Z', '2026-01-04T00:00:00Z'),
    (u2, owner, 'accountant', NULL, '2026-02-01T00:00:00Z', '2026-02-01T00:00:01Z'),
    (u3, owner, 'employee', 'auth0|fixture080-accepted', '2026-03-01T00:00:00Z', '2026-03-02T00:00:00Z'),
    (u4, sister, 'accountant', NULL, '2026-05-01T00:00:00Z', '2026-05-01T00:00:00Z'),
    (u5, owner, 'employee', NULL, '2026-04-01T00:00:00Z', '2026-04-01T00:00:00Z')
  ON CONFLICT DO NOTHING;

  -- Invitations: pending, accepted, expired, one in the sister business, and an older accepted one
  -- of the same user (fallback_email takes the newest).
  INSERT INTO accounter_schema.invitations
    (id, business_id, user_id, email, role_id, token_hash, auth0_user_created, auth0_user_id,
     invited_by_user_id, invited_by_business_id, accepted_at, expires_at, created_at) VALUES
    ('0f080000-0000-4000-8000-000000000201', owner, u2, 'Pending.User080@Example.com', 'accountant',
     'tok080-pending', true, 'auth0|fixture080-pending', u1, owner, NULL,
     '2099-01-01T00:00:00Z', '2026-02-01T00:00:00Z'),
    ('0f080000-0000-4000-8000-000000000202', owner, u3, 'accepted080@example.com', 'employee',
     'tok080-accepted', false, 'auth0|fixture080-accepted', u1, owner, '2026-03-02T00:00:00Z',
     '2026-03-08T00:00:00Z', '2026-03-01T00:00:00Z'),
    ('0f080000-0000-4000-8000-000000000203', owner, u5, 'expired080@example.com', 'employee',
     'tok080-expired', true, 'auth0|fixture080-expired', u1, owner, NULL,
     '2026-04-08T00:00:00Z', '2026-04-01T00:00:00Z'),
    ('0f080000-0000-4000-8000-000000000204', sister, u4, 'pending.user080@example.com', 'accountant',
     'tok080-sister', false, 'auth0|fixture080-pending', u1, sister, NULL,
     '2099-01-01T00:00:00Z', '2026-05-01T00:00:00Z'),
    ('0f080000-0000-4000-8000-000000000205', owner, u3, 'older080@example.com', 'employee',
     'tok080-older', false, NULL, NULL, NULL, '2026-02-16T00:00:00Z',
     '2026-02-22T00:00:00Z', '2026-02-15T00:00:00Z')
  ON CONFLICT DO NOTHING;

  -- API keys: active, recently used, revoked, the sister's, and one with a role keys may not have.
  INSERT INTO accounter_schema.api_keys
    (id, business_id, role_id, key_hash, name, last_used_at, revoked_at, created_at) VALUES
    ('0f080000-0000-4000-8000-000000000301', owner, 'scraper', 'hash080-active-1', 'Fixture080 scraper',
     NULL, NULL, '2026-05-01T00:00:00Z'),
    ('0f080000-0000-4000-8000-000000000302', owner, 'gmail_listener', 'hash080-active-2', 'Fixture080 gmail',
     '2026-11-01T10:00:00Z', NULL, '2026-06-01T00:00:00Z'),
    ('0f080000-0000-4000-8000-000000000303', owner, 'scraper', 'hash080-revoked', 'Fixture080 revoked',
     NULL, '2026-04-02T00:00:00Z', '2026-04-01T00:00:00Z'),
    ('0f080000-0000-4000-8000-000000000304', sister, 'scraper', 'hash080-sister', 'Fixture080 sister',
     NULL, NULL, '2026-07-01T00:00:00Z'),
    ('0f080000-0000-4000-8000-000000000305', owner, 'scraper', 'hash080-recent', 'Fixture080 recent',
     '2099-01-01T00:00:00Z', NULL, '2026-08-01T00:00:00Z'),
    ('0f080000-0000-4000-8000-000000000306', owner, 'business_owner', 'hash080-owner-role', 'Fixture080 owner role',
     NULL, NULL, '2026-09-01T00:00:00Z')
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.super_admins (auth0_user_id, note) VALUES
    ('auth0|fixture080-super', 'fixture 080')
  ON CONFLICT DO NOTHING;

  -- Aliases. Mixed case only where the first letters already decide the order, so the ORDER BY
  -- alias result is the same under any collation.
  INSERT INTO accounter_schema.email_ingestion_alias_routing
    (id, alias, owner_id, is_active, created_at, updated_at) VALUES
    ('0f080000-0000-4000-8000-000000000401', 'acme080', owner, true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
    ('0f080000-0000-4000-8000-000000000402', 'bILLING080', owner, true, '2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z'),
    ('0f080000-0000-4000-8000-000000000403', 'old080', owner, false, '2026-01-03T00:00:00Z', '2026-01-03T00:00:00Z'),
    ('0f080000-0000-4000-8000-000000000404', 'zz-sister080', sister, true, '2026-01-04T00:00:00Z', '2026-01-04T00:00:00Z'),
    ('0f080000-0000-4000-8000-000000000406', 'zz-SISTER080', owner, false, '2026-01-06T00:00:00Z', '2026-01-06T00:00:00Z'),
    ('0f080000-0000-4000-8000-000000000407', 'xray080', sister, false, '2026-01-07T00:00:00Z', '2026-01-07T00:00:00Z')
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.email_ingestion_grants
    (id, jti, owner_id, message_id, raw_message_hash, action, expires_at, consumed_at, created_at,
     business_id, classification) VALUES
    ('0f080000-0000-4000-8000-000000000501', 'jti080-open', owner, 'msg080-1', 'raw080-1', 'ingest',
     '2099-01-01T00:00:00Z', NULL, '2026-06-01T00:00:00Z', vendor, 'invoice'),
    ('0f080000-0000-4000-8000-000000000502', 'jti080-consumed', owner, 'msg080-2', 'raw080-2', 'ingest',
     '2026-06-02T00:00:00Z', '2026-06-01T01:00:00Z', '2026-06-01T00:00:00Z', NULL, NULL),
    ('0f080000-0000-4000-8000-000000000503', 'jti080-sister', sister, 'msg080-3', 'raw080-3', 'ingest',
     '2099-01-01T00:00:00Z', NULL, '2026-06-01T00:00:00Z', NULL, NULL)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.email_ingestion_idempotency_keys
    (id, idempotency_key, owner_id, outcome, ingest_id, audit_id, created_at) VALUES
    ('0f080000-0000-4000-8000-000000000601', 'idem080-1', owner, 'INGESTED',
     '0f080000-0000-4000-8000-000000000a01', 'audit080-1', '2026-06-01T00:00:00Z'),
    ('0f080000-0000-4000-8000-000000000602', 'idem080-1', sister, 'INGESTED', NULL, 'audit080-x',
     '2026-06-01T00:00:00Z')
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.email_ingestion_dedup_fingerprints
    (id, owner_id, fingerprint, outcome, ingest_id, correlation_id, created_at) VALUES
    ('0f080000-0000-4000-8000-000000000701', owner, 'fp080-1', 'INGESTED',
     '0f080000-0000-4000-8000-000000000a01', 'corr080-1', '2026-06-01T00:00:00Z'),
    ('0f080000-0000-4000-8000-000000000702', sister, 'fp080-1', 'QUARANTINED', NULL, NULL,
     '2026-06-01T00:00:00Z')
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.provider_credentials
    (owner_id, provider, payload, business_id, created_at, updated_at) VALUES
    (owner, 'green_invoice', 'enc080-green', vendor, '2026-05-01T00:00:00Z', '2026-05-02T00:00:00Z'),
    (sister, 'deel', 'enc080-sister', NULL, '2026-05-01T00:00:00Z', '2026-05-01T00:00:00Z')
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.documents (id, owner_id, type, file_hash, serial_number) VALUES
    ('0f080000-0000-4000-8000-000000000801', owner, 'INVOICE', 'hash080-doc', '080-1')
  ON CONFLICT DO NOTHING;

  -- A charge with two ledger records, for the demo-data validator's ledger read.
  INSERT INTO accounter_schema.charges (id, owner_id, user_description) VALUES
    ('0f080000-0000-4000-8000-000000000901', owner, 'Fixture080 ledger charge')
  ON CONFLICT DO NOTHING;
  INSERT INTO accounter_schema.ledger_records
    (id, owner_id, charge_id, debit_entity1, debit_local_amount1, credit_entity1, credit_local_amount1,
     currency, invoice_date, value_date, description, created_at, updated_at) VALUES
    ('0f080000-0000-4000-8000-000000000911', owner, '0f080000-0000-4000-8000-000000000901', vendor,
     '100.50', owner, '100.50', 'ILS', '2026-01-10', '2026-01-11', 'Fixture080 first',
     '2026-01-12T00:00:00', '2026-01-12T00:00:00'),
    ('0f080000-0000-4000-8000-000000000912', owner, '0f080000-0000-4000-8000-000000000901', owner,
     '17.09', vendor, '17.09', 'ILS', '2026-01-10', '2026-01-11', 'Fixture080 second',
     '2026-01-13T00:00:00', '2026-01-13T00:00:00')
  ON CONFLICT DO NOTHING;
END $$;

-- A second, self-owned tenant with no user_context (so the harness never runs cases as it): what
-- the bootstrap statements (user_context insert, businesses_admin upsert) write for.
DO $$
DECLARE
  tenant_b UUID := '0f080000-0000-4000-8000-000000000006';
  tenant_b_tax UUID := '0f080000-0000-4000-8000-000000000007';
BEGIN
  INSERT INTO accounter_schema.financial_entities (id, type, name, owner_id) VALUES
    (tenant_b, 'business', 'Fixture080 Tenant B', NULL)
  ON CONFLICT DO NOTHING;
  INSERT INTO accounter_schema.businesses (id, owner_id) VALUES (tenant_b, tenant_b)
  ON CONFLICT DO NOTHING;
  UPDATE accounter_schema.financial_entities SET owner_id = tenant_b
  WHERE id = tenant_b AND owner_id IS NULL;

  INSERT INTO accounter_schema.financial_entities (id, type, name, owner_id) VALUES
    (tenant_b_tax, 'tax_category', 'Fixture080 Tenant B Tax', tenant_b)
  ON CONFLICT DO NOTHING;
  INSERT INTO accounter_schema.tax_categories (id, owner_id) VALUES (tenant_b_tax, tenant_b)
  ON CONFLICT DO NOTHING;
END $$;
