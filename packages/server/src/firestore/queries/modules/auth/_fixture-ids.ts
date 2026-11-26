/** Ids of the rows in scripts/firestore/fixtures/080-auth-email.sql, for cases. */
export const F080 = {
  sister: '0f080000-0000-4000-8000-000000000001',
  vendor: '0f080000-0000-4000-8000-000000000002',
  /** Owner (demo tenant) in two businesses, Auth0 `auth0|fixture080-owner`. */
  u1: '0f080000-0000-4000-8000-000000000101',
  /** Pending-invitation placeholder in the demo tenant. */
  u2: '0f080000-0000-4000-8000-000000000102',
  /** Accepted member, Auth0 `auth0|fixture080-accepted`. */
  u3: '0f080000-0000-4000-8000-000000000103',
  /** Placeholder in the sister business. */
  u4: '0f080000-0000-4000-8000-000000000104',
  /** Placeholder of the expired invitation. */
  u5: '0f080000-0000-4000-8000-000000000105',
  inviteFresh: '0f080000-0000-4000-8000-0000000001ff',
  /** Pending, demo tenant, u2. */
  i1: '0f080000-0000-4000-8000-000000000201',
  /** Accepted, demo tenant, u3. */
  i2: '0f080000-0000-4000-8000-000000000202',
  /** Expired, demo tenant, u5. */
  i3: '0f080000-0000-4000-8000-000000000203',
  /** Pending, sister business, u4. */
  i4: '0f080000-0000-4000-8000-000000000204',
  /** Active key. */
  k1: '0f080000-0000-4000-8000-000000000301',
  /** Revoked key. */
  k3: '0f080000-0000-4000-8000-000000000303',
  /** The sister business's key. */
  k4: '0f080000-0000-4000-8000-000000000304',
} as const;
