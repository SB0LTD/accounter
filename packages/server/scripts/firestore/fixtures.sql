-- Extra rows for the Firestore verification database, on top of the demo seed, so ported queries
-- have something to find. Applied by `yarn workspace @accounter/server firestore:fixtures`.
-- Idempotent: every insert skips rows that exist. Ids are fixed UUIDs in the 0f0f... range.
--
-- The tenant is the demo seed's admin business (the single user_context owner).

DO $$
DECLARE
  owner UUID := (SELECT owner_id FROM accounter_schema.user_context LIMIT 1);
  first_charge UUID := (SELECT id FROM accounter_schema.charges WHERE owner_id = owner ORDER BY id LIMIT 1);
  second_charge UUID := (SELECT id FROM accounter_schema.charges WHERE owner_id = owner ORDER BY id OFFSET 1 LIMIT 1);
BEGIN
  -- tags: a three-level tree, a second root, and an orphan whose parent chain never reaches a root
  INSERT INTO accounter_schema.tags (id, name, parent, owner_id) VALUES
    ('0f0f0000-0000-4000-8000-000000000001', 'Operations', NULL, owner),
    ('0f0f0000-0000-4000-8000-000000000002', 'Cloud', '0f0f0000-0000-4000-8000-000000000001', owner),
    ('0f0f0000-0000-4000-8000-000000000003', 'GPU hours', '0f0f0000-0000-4000-8000-000000000002', owner),
    ('0f0f0000-0000-4000-8000-000000000004', 'Marketing', NULL, owner),
    ('0f0f0000-0000-4000-8000-000000000005', 'Events', '0f0f0000-0000-4000-8000-000000000004', owner)
  ON CONFLICT DO NOTHING;

  INSERT INTO accounter_schema.charge_tags (charge_id, tag_id, part, owner_id) VALUES
    (first_charge, '0f0f0000-0000-4000-8000-000000000003', 0.6, owner),
    (first_charge, '0f0f0000-0000-4000-8000-000000000005', 0.4, owner),
    (second_charge, '0f0f0000-0000-4000-8000-000000000002', NULL, owner)
  ON CONFLICT DO NOTHING;
END $$;
