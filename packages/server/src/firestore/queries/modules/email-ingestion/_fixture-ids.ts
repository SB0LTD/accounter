/** Ids of the rows in scripts/firestore/fixtures/080-auth-email.sql, for cases. */
export const F080 = {
  sister: '0f080000-0000-4000-8000-000000000001',
  vendor: '0f080000-0000-4000-8000-000000000002',
  security: '0f080000-0000-4000-8000-000000000004',
  /** `acme080`, demo tenant, active. */
  aliasAcme: '0f080000-0000-4000-8000-000000000401',
  /** `old080`, demo tenant, inactive. */
  aliasOld: '0f080000-0000-4000-8000-000000000403',
  /** `zz-sister080`, sister business, active. */
  aliasSister: '0f080000-0000-4000-8000-000000000404',
  /** `zz-SISTER080`, demo tenant, inactive: reactivating it collides with `zz-sister080`. */
  aliasSisterUpper: '0f080000-0000-4000-8000-000000000406',
} as const;
