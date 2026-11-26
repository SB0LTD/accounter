/**
 * Proves the raw-statement ports (src/firestore/raw/statements.ts): runs each raw `query('...')`
 * statement the server sends, with realistic positional values, on Postgres and through the
 * Firestore store, and compares the rows, the command tag, errors, and (for writes) the rows the
 * statement left behind.
 *
 *   cd packages/server
 *   POSTGRES_HOST=localhost POSTGRES_PORT=54329 POSTGRES_DB=<your verify db> \
 *     yarn tsx scripts/firestore/verify-raw.ts [--only <label or SQL text>] [--verbose]
 *
 * (No package.json script yet; `firestore:verify-raw` would be the natural name.) Exits 1 on a
 * FAIL. A GAP is a known difference the store core cannot avoid yet; it is printed, not failed.
 *
 * Like verify.ts: the database's data is copied into an in-memory store; Postgres runs every case
 * as the RLS-bound role `accounter_verify` with the case's `app.*` settings, in a transaction that
 * is rolled back; the store runs it in a transaction that is rolled back too. Each case also runs
 * through FirestoreClient (BEGIN, set_config, the statement, ROLLBACK), the pg look-alike the
 * server uses, which must agree with the direct run.
 *
 * Timestamps the statement itself sets (NOW()) differ between the two runs by milliseconds: any
 * timestamp inside the run's time window compares as `<now>`. Generated ids are masked.
 *
 * Needs the fixture rows of fixtures/080-auth-email.sql. Refuses any database host but localhost.
 */
import pg from 'pg';
import { allTables, tableInfo, type AnyRow, type TableName } from '../../src/firestore/catalog.js';
import { FirestoreClient } from '../../src/firestore/client.js';
import { queryDb } from '../../src/firestore/query-db.js';
import { findRawStatement } from '../../src/firestore/raw/index.js';
import { sqlEquals } from '../../src/firestore/sql-helpers.js';
import { memoryStore } from '../../src/firestore/store.js';
import type { SessionContext } from '../../src/firestore/transaction.js';
import { docIdFor, encodeRow } from '../../src/firestore/values.js';
import { seedCountries } from '../../src/modules/countries/helpers/seed-countries.helper.js';
import { pgTypeParsers } from '../../src/shared/helpers/pg-type-parsers.js';

process.env.TZ = 'UTC';

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const verbose = args.includes('--verbose');

const host = process.env.POSTGRES_HOST ?? 'localhost';
if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
  console.error(`firestore:verify-raw only runs against a local database (POSTGRES_HOST=${host})`);
  process.exit(2);
}

const ROLE = 'accounter_verify';

// Fixture rows (fixtures/080-auth-email.sql)
const F = {
  sister: '0f080000-0000-4000-8000-000000000001',
  vendor: '0f080000-0000-4000-8000-000000000002',
  tenantB: '0f080000-0000-4000-8000-000000000006',
  tenantBTax: '0f080000-0000-4000-8000-000000000007',
  u1: '0f080000-0000-4000-8000-000000000101',
  u3: '0f080000-0000-4000-8000-000000000103',
  u5: '0f080000-0000-4000-8000-000000000105',
  i3: '0f080000-0000-4000-8000-000000000203',
  k1: '0f080000-0000-4000-8000-000000000301',
  k2: '0f080000-0000-4000-8000-000000000302',
  k5: '0f080000-0000-4000-8000-000000000305',
  ledgerCharge: '0f080000-0000-4000-8000-000000000901',
  newUser1: '0f080000-0000-4000-8000-0000000001f1',
  newUser2: '0f080000-0000-4000-8000-0000000001f2',
  freshBusiness: '0f080000-0000-4000-8000-0000000000f1',
  missing: '00000000-0000-4000-8000-00000000dead',
} as const;

// -------------------------------------------------------------------------------------------
// Cases
// -------------------------------------------------------------------------------------------

interface Check {
  table: TableName;
  column: string;
  values: unknown[];
}

interface Statement {
  text: string;
  values: unknown[];
}

interface RawCase {
  /** Where the statement comes from, and what the case shows. */
  label: string;
  text: string;
  values: unknown[];
  session: SessionContext;
  /** Raw statements run first in the same transaction (an earlier step of the same flow). */
  setup?: Statement[];
  /** Rows to compare after the statement, for writes (they have no RETURNING). */
  checks?: Check[];
  /** A difference the store cannot avoid yet: reported as GAP, not FAIL. */
  gap?: string;
}

/**
 * `businesses.owner_id` references `businesses.id`, and the new root's row is its own owner. Postgres
 * checks the foreign key after the row is in (so it finds itself); the store checks before the
 * row is added and raises 23503. Needs the core's foreign-key check to accept a row that satisfies
 * its own reference.
 */
const SELF_FK_GAP =
  'store core: a self-referencing foreign key (businesses.owner_id = id) is checked before the row exists';

const NONE: SessionContext = { businessId: null, scope: [], userId: null, authType: null };

function session(businessId: string, userId: string | null = null): SessionContext {
  return { businessId, scope: [businessId], userId, authType: 'jwt' };
}

/** The statement seedCountries() sends, captured from the helper itself. */
async function seedCountriesStatement(): Promise<{ text: string; values: unknown[] }> {
  let captured: { text: string; values: unknown[] } | null = null;
  await seedCountries({
    query: (async (text: string, values: unknown[]) => {
      captured = { text, values };
      return { rows: [] };
    }) as never,
  });
  return captured!;
}

/** The statement shape seedCountries() builds, for a list of our own. */
function countriesStatement(countries: { name: string; code: string }[]) {
  const values = countries
    .map((_, index) => `($${index * 2 + 1}, $${index * 2 + 2})`)
    .join(',\n      ');
  return {
    text: `INSERT INTO accounter_schema.countries (name, code)
     VALUES ${values}
     ON CONFLICT (code) DO NOTHING`,
    values: countries.flatMap(c => [c.name, c.code]),
  };
}

/** The user_context insert as AdminOnboardingProvider.bootstrapNewClient builds it. */
function userContextStatement(
  ownerId: string,
  taxCategoryId: string,
  businessId: string,
  extra: { dateEstablished?: string; initialAccounterYear?: number },
) {
  const contextCols: Record<string, unknown> = {
    owner_id: ownerId,
    default_local_currency: 'ILS',
    default_fiat_currency_for_crypto_conversions: 'USD',
    locality: 'ISR',
    default_tax_category_id: taxCategoryId,
    vat_business_id: businessId,
    input_vat_tax_category_id: taxCategoryId,
    output_vat_tax_category_id: taxCategoryId,
    property_output_vat_tax_category_id: taxCategoryId,
    tax_business_id: businessId,
    tax_expenses_tax_category_id: taxCategoryId,
    social_security_business_id: businessId,
    exchange_rate_tax_category_id: taxCategoryId,
    income_exchange_rate_tax_category_id: taxCategoryId,
    exchange_rate_revaluation_tax_category_id: taxCategoryId,
    fee_tax_category_id: taxCategoryId,
    general_fee_tax_category_id: taxCategoryId,
    fine_tax_category_id: taxCategoryId,
    untaxable_gifts_tax_category_id: taxCategoryId,
    balance_cancellation_tax_category_id: taxCategoryId,
    development_foreign_tax_category_id: taxCategoryId,
    development_local_tax_category_id: taxCategoryId,
    expenses_to_pay_tax_category_id: taxCategoryId,
    expenses_in_advance_tax_category_id: taxCategoryId,
    income_to_collect_tax_category_id: taxCategoryId,
    income_in_advance_tax_category_id: taxCategoryId,
    salary_excess_expenses_tax_category_id: taxCategoryId,
    ...(extra.dateEstablished ? { date_established: extra.dateEstablished } : {}),
    ...(extra.initialAccounterYear ? { initial_accounter_year: extra.initialAccounterYear } : {}),
  };
  const columns = Object.keys(contextCols).join(', ');
  const placeholders = Object.keys(contextCols)
    .map((_, i) => `$${i + 1}`)
    .join(', ');
  return {
    text: `INSERT INTO accounter_schema.user_context (${columns}) VALUES (${placeholders}) ON CONFLICT (owner_id) DO NOTHING`,
    values: Object.values(contextCols),
  };
}

async function buildCases(data: Map<string, AnyRow[]>, demo: string): Promise<RawCase[]> {
  const demoUser =
    ((data.get('business_users') ?? []).find(r => r.business_id === demo)?.user_id as string) ??
    null;
  const DEMO = session(demo, demoUser);
  const TENANT_B = session(F.tenantB);
  const charges = (data.get('charges') ?? [])
    .filter(c => c.owner_id === demo)
    .map(c => c.id as string)
    .slice(0, 3);
  const demoContext = (data.get('user_context') ?? []).find(r => r.owner_id === demo)!;
  // The demo seed's own owner and accountant (not this file's fixture users)
  const seededMember = (role: string) =>
    (data.get('business_users') ?? []).find(
      r =>
        r.business_id === demo && r.role_id === role && !String(r.user_id).startsWith('0f080000-'),
    )?.user_id as string | undefined;
  const demoMembers = [seededMember('business_owner'), seededMember('accountant')].filter(
    (id): id is string => id != null,
  );

  const cleanupSelect = `SELECT id, auth0_user_id, user_id, business_id
       FROM accounter_schema.invitations
       WHERE accepted_at IS NULL
         AND expires_at < NOW()`;
  const cleanupDeleteUser = `DELETE FROM accounter_schema.business_users
             WHERE user_id = $1 AND auth0_user_id IS NULL`;
  const cleanupDeleteInvitation = 'DELETE FROM accounter_schema.invitations WHERE id = $1';
  const devBypass = `SELECT user_id, business_id, role_id, auth0_user_id
     FROM accounter_schema.business_users
     WHERE user_id = $1
     ORDER BY updated_at DESC`;
  const apiKeySelect = `SELECT id, business_id, role_id
       FROM accounter_schema.api_keys
       WHERE key_hash = $1
         AND revoked_at IS NULL`;
  const apiKeyTouch = `UPDATE accounter_schema.api_keys
       SET last_used_at = NOW()
       WHERE id = $1
         AND (last_used_at IS NULL OR last_used_at < NOW() - INTERVAL '1 hour')`;
  const byAuth0 = `
      SELECT bu.user_id, bu.business_id, bu.role_id
      FROM accounter_schema.business_users bu
      WHERE bu.auth0_user_id = $1
      ORDER BY bu.updated_at DESC
    `;
  const byVerifiedEmail = `
      SELECT bu.user_id
      FROM accounter_schema.invitations i
      JOIN accounter_schema.business_users bu
        ON bu.user_id = i.user_id
       AND bu.business_id = i.business_id
      WHERE LOWER(i.email) = LOWER($1)
        AND i.accepted_at IS NOT NULL
      ORDER BY i.accepted_at DESC
      LIMIT 1
    `;
  const relink = `
      UPDATE accounter_schema.business_users
      SET auth0_user_id = $1, updated_at = NOW()
      WHERE user_id = $2
    `;
  const byUserId = `
      SELECT bu.user_id, bu.business_id, bu.role_id
      FROM accounter_schema.business_users bu
      WHERE bu.user_id = $1
      ORDER BY bu.updated_at DESC
    `;
  const chargesById = 'SELECT id FROM accounter_schema.charges WHERE id = ANY($1::uuid[])';
  const adminRowUpsert = `INSERT INTO accounter_schema.businesses_admin (id, owner_id)
     VALUES ($1, $1)
     ON CONFLICT (id) DO UPDATE
     SET owner_id = EXCLUDED.owner_id`;
  const findAdmin = `SELECT id
       FROM accounter_schema.financial_entities
      WHERE id = $1 OR (type = 'business' AND name = 'Accounter Admin Business')
      LIMIT 1`;
  const insertRootEntity = `INSERT INTO accounter_schema.financial_entities (id, type, name, owner_id)
     VALUES ($1, 'business', 'Accounter Admin Business', NULL)`;
  const insertRootBusiness = `INSERT INTO accounter_schema.businesses (id, owner_id)
     VALUES ($1, $1)`;
  const selfOwn = `UPDATE accounter_schema.financial_entities
     SET owner_id = $1
     WHERE id = $1`;
  const demoUsers = `INSERT INTO accounter_schema.business_users (user_id, business_id, role_id, auth0_user_id)
     VALUES
       ($1, $2, 'business_owner', $3),
       ($4, $2, 'accountant', NULL)
     ON CONFLICT (user_id, business_id) DO NOTHING`;
  const exchangeRates = `INSERT INTO accounter_schema.exchange_rates (exchange_date, usd, eur, gbp)
     VALUES (CURRENT_DATE, 3.5, 4.0, 4.5)
     ON CONFLICT (exchange_date)
     DO UPDATE SET usd = EXCLUDED.usd, eur = EXCLUDED.eur, gbp = EXCLUDED.gbp`;
  const vat = `INSERT INTO accounter_schema.vat_value (percentage, date)
       VALUES ($1, $2)
       ON CONFLICT (date) DO NOTHING`;
  const today = new Date().toISOString().slice(0, 10);

  const allCountries = await seedCountriesStatement();
  const newCountry = countriesStatement([
    { name: 'Israel', code: 'ISR' },
    { name: 'Fixture080 Land', code: 'Z80' },
  ]);
  const nameClash = countriesStatement([{ name: 'Israel', code: 'Z81' }]);

  const contextFor = (extra: { dateEstablished?: string; initialAccounterYear?: number }) =>
    userContextStatement(F.tenantB, F.tenantBTax, F.tenantB, extra);
  const userContextCheck: Check[] = [
    { table: 'user_context', column: 'owner_id', values: [F.tenantB] },
  ];

  return [
    // jobs/cleanup-expired-invitations.ts (a bare pool connection: no app.* settings)
    { label: 'cleanup: expired invitations', text: cleanupSelect, values: [], session: NONE },
    {
      label: 'cleanup: delete placeholder user (cascades to its invitation)',
      text: cleanupDeleteUser,
      values: [F.u5],
      session: NONE,
      checks: [
        { table: 'business_users', column: 'user_id', values: [F.u5] },
        { table: 'invitations', column: 'id', values: [F.i3] },
      ],
    },
    {
      label: 'cleanup: a user who signed in is kept',
      text: cleanupDeleteUser,
      values: [F.u3],
      session: NONE,
      checks: [{ table: 'business_users', column: 'user_id', values: [F.u3] }],
    },
    {
      label: 'cleanup: delete invitation',
      text: cleanupDeleteInvitation,
      values: [F.i3],
      session: NONE,
      checks: [{ table: 'invitations', column: 'id', values: [F.i3] }],
    },
    {
      label: 'cleanup: delete missing invitation',
      text: cleanupDeleteInvitation,
      values: [F.missing],
      session: NONE,
    },

    // modules/auth/providers/auth-context.provider.ts (DBProvider: no app.* settings)
    { label: 'dev bypass: two memberships', text: devBypass, values: [F.u1], session: NONE },
    ...(demoUser
      ? [{ label: 'dev bypass: demo user', text: devBypass, values: [demoUser], session: NONE }]
      : []),
    { label: 'dev bypass: unknown user', text: devBypass, values: [F.missing], session: NONE },
    { label: 'api key: active', text: apiKeySelect, values: ['hash080-active-1'], session: NONE },
    { label: 'api key: revoked', text: apiKeySelect, values: ['hash080-revoked'], session: NONE },
    {
      label: 'api key: disallowed role',
      text: apiKeySelect,
      values: ['hash080-owner-role'],
      session: NONE,
    },
    {
      label: 'api key touch: never used',
      text: apiKeyTouch,
      values: [F.k1],
      session: NONE,
      checks: [{ table: 'api_keys', column: 'id', values: [F.k1] }],
    },
    {
      label: 'api key touch: used long ago',
      text: apiKeyTouch,
      values: [F.k2],
      session: NONE,
      checks: [{ table: 'api_keys', column: 'id', values: [F.k2] }],
    },
    {
      label: 'api key touch: used within the hour (future-dated fixture)',
      text: apiKeyTouch,
      values: [F.k5],
      session: NONE,
      checks: [{ table: 'api_keys', column: 'id', values: [F.k5] }],
    },
    {
      label: 'by auth0 id: two memberships',
      text: byAuth0,
      values: ['auth0|fixture080-owner'],
      session: NONE,
    },
    { label: 'by auth0 id: none', text: byAuth0, values: ['auth0|nobody080'], session: NONE },
    {
      label: 'by verified email',
      text: byVerifiedEmail,
      values: ['ACCEPTED080@example.com'],
      session: NONE,
    },
    {
      label: 'by verified email: older invitation',
      text: byVerifiedEmail,
      values: ['older080@example.com'],
      session: NONE,
    },
    {
      label: 'by verified email: not accepted',
      text: byVerifiedEmail,
      values: ['pending.user080@example.com'],
      session: NONE,
    },
    {
      label: 'relink auth0 id',
      text: relink,
      values: ['auth0|relinked080', F.u1],
      session: NONE,
      checks: [{ table: 'business_users', column: 'user_id', values: [F.u1] }],
    },
    {
      label: 'relink: unknown user',
      text: relink,
      values: ['auth0|relinked080', F.missing],
      session: NONE,
    },
    { label: 'by user id', text: byUserId, values: [F.u1], session: NONE },
    { label: 'by user id: none', text: byUserId, values: [F.missing], session: NONE },

    // modules/charges/providers/charges-authorization.provider.ts (tenant session)
    {
      label: 'charges by ids',
      text: chargesById,
      values: [[...charges, F.missing]],
      session: DEMO,
    },
    {
      label: 'charges by ids: not a uuid',
      text: chargesById,
      values: [[charges[0], 'nope']],
      session: DEMO,
    },
    { label: 'charges by ids: empty', text: chargesById, values: [[]], session: DEMO },
    {
      label: 'charges by ids: another tenant cannot see them',
      text: chargesById,
      values: [charges],
      session: TENANT_B,
    },

    // modules/countries/helpers/seed-countries.helper.ts
    {
      label: 'seed countries: every country (all exist)',
      ...allCountries,
      session: NONE,
      checks: [{ table: 'countries', column: 'code', values: ['ISR', 'USA'] }],
    },
    {
      label: 'seed countries: one new',
      ...newCountry,
      session: NONE,
      checks: [{ table: 'countries', column: 'code', values: ['ISR', 'Z80'] }],
    },
    { label: 'seed countries: name taken under another code', ...nameClash, session: NONE },

    // modules/onboarding/providers/admin-onboarding.provider.ts (the new client's session)
    {
      label: 'bootstrap user_context',
      ...contextFor({}),
      session: TENANT_B,
      checks: userContextCheck,
    },
    {
      label: 'bootstrap user_context with date established',
      ...contextFor({ dateEstablished: '2020-03-01' }),
      session: TENANT_B,
      checks: userContextCheck,
    },
    {
      label: 'bootstrap user_context with first year',
      ...contextFor({ initialAccounterYear: 2021 }),
      session: TENANT_B,
      checks: userContextCheck,
    },
    {
      label: 'bootstrap user_context with both',
      ...contextFor({ dateEstablished: '2020-03-01', initialAccounterYear: 2021 }),
      session: TENANT_B,
      checks: userContextCheck,
    },
    {
      label: 'bootstrap user_context: exists, DO NOTHING',
      ...userContextStatement(
        demo,
        demoContext.default_tax_category_id as string,
        demoContext.vat_business_id as string,
        {},
      ),
      session: DEMO,
      checks: [{ table: 'user_context', column: 'owner_id', values: [demo] }],
    },
    {
      label: 'bootstrap user_context: another tenant',
      ...contextFor({}),
      session: DEMO,
    },

    // demo-fixtures/helpers/admin-context.ts
    {
      label: 'demo admin row: exists, owner rewritten',
      text: adminRowUpsert,
      values: [demo],
      session: DEMO,
      checks: [{ table: 'businesses_admin', column: 'id', values: [demo] }],
    },
    {
      label: 'demo admin row: new',
      text: adminRowUpsert,
      values: [F.tenantB],
      session: TENANT_B,
      checks: [{ table: 'businesses_admin', column: 'id', values: [F.tenantB] }],
    },
    {
      label: 'demo admin row: another tenant',
      text: adminRowUpsert,
      values: [F.vendor],
      session: DEMO,
    },
    { label: 'demo find admin: by id', text: findAdmin, values: [demo], session: DEMO },
    { label: 'demo find admin: none', text: findAdmin, values: [F.missing], session: DEMO },
    {
      label: 'demo root entity: not the session business',
      text: insertRootEntity,
      values: [F.freshBusiness],
      session: DEMO,
    },
    // The bootstrap of a new admin business, step by step, as the session business
    {
      label: 'demo root entity: the session business (bootstrap step 1)',
      text: insertRootEntity,
      values: [F.freshBusiness],
      session: session(F.freshBusiness),
      checks: [{ table: 'financial_entities', column: 'id', values: [F.freshBusiness] }],
    },
    {
      label: 'demo root business: new (bootstrap step 2)',
      gap: SELF_FK_GAP,
      setup: [{ text: insertRootEntity, values: [F.freshBusiness] }],
      text: insertRootBusiness,
      values: [F.freshBusiness],
      session: session(F.freshBusiness),
      checks: [{ table: 'businesses', column: 'id', values: [F.freshBusiness] }],
    },
    {
      label: 'demo self-own: new root (bootstrap step 3)',
      gap: SELF_FK_GAP,
      setup: [
        { text: insertRootEntity, values: [F.freshBusiness] },
        { text: insertRootBusiness, values: [F.freshBusiness] },
      ],
      text: selfOwn,
      values: [F.freshBusiness],
      session: session(F.freshBusiness),
      checks: [{ table: 'financial_entities', column: 'id', values: [F.freshBusiness] }],
    },
    {
      label: 'demo admin row: new root (bootstrap step 4)',
      gap: SELF_FK_GAP,
      setup: [
        { text: insertRootEntity, values: [F.freshBusiness] },
        { text: insertRootBusiness, values: [F.freshBusiness] },
        { text: selfOwn, values: [F.freshBusiness] },
      ],
      text: adminRowUpsert,
      values: [F.freshBusiness],
      session: session(F.freshBusiness),
      checks: [{ table: 'businesses_admin', column: 'id', values: [F.freshBusiness] }],
    },
    {
      label: 'demo root business: exists',
      text: insertRootBusiness,
      values: [F.tenantB],
      session: TENANT_B,
    },
    {
      label: 'demo root business: another tenant',
      text: insertRootBusiness,
      values: [F.vendor],
      session: DEMO,
    },
    {
      label: 'demo self-own: already',
      text: selfOwn,
      values: [demo],
      session: DEMO,
      checks: [{ table: 'financial_entities', column: 'id', values: [demo] }],
    },
    { label: 'demo self-own: another row', text: selfOwn, values: [F.vendor], session: DEMO },

    // demo-fixtures/helpers/seed-demo-users.ts
    ...(demoMembers.length === 2
      ? [
          {
            label: 'demo users: exist',
            text: demoUsers,
            values: [demoMembers[0], demo, null, demoMembers[1]],
            session: DEMO,
            checks: [{ table: 'business_users' as const, column: 'user_id', values: demoMembers }],
          },
        ]
      : []),
    {
      label: 'demo users: new',
      text: demoUsers,
      values: [F.newUser1, demo, 'auth0|demo080', F.newUser2],
      session: DEMO,
      checks: [{ table: 'business_users', column: 'user_id', values: [F.newUser1, F.newUser2] }],
    },
    {
      label: 'demo users: unknown business',
      text: demoUsers,
      values: [F.newUser1, F.missing, null, F.newUser2],
      session: DEMO,
    },

    // demo-fixtures/helpers/seed-exchange-rates.ts
    {
      label: "demo exchange rates: today's row",
      text: exchangeRates,
      values: [],
      session: NONE,
      checks: [{ table: 'exchange_rates', column: 'exchange_date', values: [today] }],
    },

    // demo-fixtures/helpers/seed-vat.ts
    {
      label: 'demo vat: exists',
      text: vat,
      values: [0.17, '2015-01-01'],
      session: NONE,
      checks: [{ table: 'vat_value', column: 'date', values: ['2015-01-01'] }],
    },
    {
      label: 'demo vat: new, stored at the column scale',
      text: vat,
      values: [0.2, '2030-01-01'],
      session: NONE,
      checks: [{ table: 'vat_value', column: 'date', values: ['2030-01-01'] }],
    },
    {
      label: 'demo vat: does not fit numeric(3,2)',
      text: vat,
      values: [12, '2031-01-01'],
      session: NONE,
    },

    // demo-fixtures/validate-demo-data.ts (session-level business, no scope)
    {
      label: 'validate: admin business',
      text: `SELECT id FROM accounter_schema.financial_entities WHERE type = 'business' AND name = 'Admin Business'`,
      values: [],
      session: { ...NONE, businessId: demo, scope: [] },
    },
    {
      label: 'validate: charge count',
      text: 'SELECT COUNT(*) FROM accounter_schema.charges',
      values: [],
      session: { ...NONE, businessId: demo, scope: [] },
    },
    {
      label: 'validate: ledger records',
      text: 'SELECT * FROM accounter_schema.ledger_records WHERE charge_id = ANY($1) ORDER BY created_at',
      values: [[F.ledgerCharge, ...charges]],
      session: { ...NONE, businessId: demo, scope: [] },
    },
    {
      label: 'validate: ledger records, not a uuid',
      text: 'SELECT * FROM accounter_schema.ledger_records WHERE charge_id = ANY($1) ORDER BY created_at',
      values: [['nope']],
      session: { ...NONE, businessId: demo, scope: [] },
    },
    {
      label: 'validate: vat row',
      text: 'SELECT 1 FROM accounter_schema.vat_value WHERE percentage = 0.17',
      values: [],
      session: { ...NONE, businessId: demo, scope: [] },
    },
  ];
}

// -------------------------------------------------------------------------------------------
// Comparison
// -------------------------------------------------------------------------------------------

interface Outcome {
  rows: AnyRow[] | null;
  command: string | null;
  checks: AnyRow[][];
  error: { code?: string; message: string } | null;
}

/** Window of "now" for one case: timestamps inside it were set by the statement. */
interface Window {
  from: number;
  to: number;
}

function normalize(value: unknown, window: Window): unknown {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) {
    const t = value.getTime();
    return t >= window.from && t <= window.to ? '<now>' : { $date: value.toISOString() };
  }
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(v => normalize(v, window));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(k => [k, normalize((value as AnyRow)[k], window)]),
    );
  }
  return value;
}

function serialize(rows: AnyRow[], window: Window, maskIds: boolean): string[] {
  return rows.map(row =>
    JSON.stringify(
      normalize(maskIds ? { ...row, id: row.id == null ? null : '<id>' } : row, window),
    ),
  );
}

function compareRows(a: string[], b: string[], ordered: boolean): string | null {
  if (a.length !== b.length) {
    return `row count: postgres ${a.length}, firestore ${b.length}\n    pg[0]=${a[0] ?? '-'}\n    fs[0]=${b[0] ?? '-'}`;
  }
  const x = ordered ? a : [...a].sort();
  const y = ordered ? b : [...b].sort();
  for (let i = 0; i < x.length; i++) {
    if (x[i] !== y[i]) return `row ${i} differs\n    pg=${x[i]}\n    fs=${y[i]}`;
  }
  return null;
}

const hasTopLevelOrderBy = (text: string) => /\border\s+by\b/i.test(text);

function compareOutcomes(
  c: RawCase,
  pgOut: Outcome,
  fsOut: Outcome,
  window: Window,
): string | null {
  if (pgOut.error || fsOut.error) {
    if (pgOut.error && fsOut.error && pgOut.error.code === fsOut.error.code) return null;
    const describe = (o: Outcome) =>
      o.error ? `raised ${o.error.code ?? ''} ${o.error.message}` : 'succeeded';
    return `postgres ${describe(pgOut)}; firestore ${describe(fsOut)}`;
  }
  if (pgOut.command !== fsOut.command) {
    return `command: postgres ${pgOut.command}, firestore ${fsOut.command}`;
  }
  const rows = compareRows(
    serialize(pgOut.rows!, window, false),
    serialize(fsOut.rows!, window, false),
    hasTopLevelOrderBy(c.text),
  );
  if (rows) return rows;
  for (const [i, check] of (c.checks ?? []).entries()) {
    const maskIds = check.column !== 'id';
    const problem = compareRows(
      serialize(pgOut.checks[i]!, window, maskIds),
      serialize(fsOut.checks[i]!, window, maskIds),
      false,
    );
    if (problem)
      return `after the statement, ${check.table} where ${check.column} in (...): ${problem}`;
  }
  return null;
}

// -------------------------------------------------------------------------------------------
// Running
// -------------------------------------------------------------------------------------------

const settingsSql = `SELECT set_config('app.current_business_id', $1, true), set_config('app.current_user_id', $2, true),
        set_config('app.auth_type', $3, true), set_config('app.current_business_scope', $4, true)`;

function settingsValues(ctx: SessionContext) {
  return [
    ctx.businessId ?? '',
    ctx.userId ?? '',
    ctx.authType ?? '',
    ctx.scope.length ? `{${ctx.scope.map(s => `"${s}"`).join(',')}}` : '',
  ];
}

const asError = (error: unknown) => ({
  code: (error as { code?: string }).code,
  message: (error as Error).message,
});

async function runPostgres(client: pg.Client, c: RawCase): Promise<Outcome> {
  await client.query('BEGIN');
  try {
    await client.query(`SET LOCAL ROLE ${ROLE}`);
    await client.query(settingsSql, settingsValues(c.session));
    for (const step of c.setup ?? []) await client.query(step.text, step.values);
    const result = await client.query(c.text, c.values);
    const checks: AnyRow[][] = [];
    for (const check of c.checks ?? []) {
      const { rows } = await client.query(
        `SELECT * FROM accounter_schema.${check.table} WHERE ${check.column} = ANY($1)`,
        [check.values],
      );
      checks.push(rows);
    }
    return { rows: result.rows, command: result.command, checks, error: null };
  } catch (error) {
    return { rows: null, command: null, checks: [], error: asError(error) };
  } finally {
    await client.query('ROLLBACK');
  }
}

async function runStore(
  store: ReturnType<typeof memoryStore>['store'],
  c: RawCase,
): Promise<Outcome> {
  const raw = findRawStatement(c.text);
  if (!raw) {
    return {
      rows: null,
      command: null,
      checks: [],
      error: { code: 'NO-PORT', message: 'no raw statement port matches this text' },
    };
  }
  const tx = store.begin(() => c.session);
  try {
    const db = queryDb(tx);
    for (const step of c.setup ?? []) {
      const setup = findRawStatement(step.text);
      if (!setup) throw new Error(`setup statement has no port: ${step.text}`);
      await setup.run(step.values, db);
    }
    // Found again: a pattern statement reads back the text it last matched.
    const rows = (await findRawStatement(c.text)!.run(c.values, db)).map(row =>
      structuredClone(row),
    );
    const checks: AnyRow[][] = [];
    for (const check of c.checks ?? []) {
      const all = (await db.rows(check.table)) as unknown as readonly AnyRow[];
      checks.push(
        all
          .filter(row => check.values.some(v => sqlEquals(row[check.column], v)))
          .map(r => ({ ...r })),
      );
    }
    return { rows, command: raw.command, checks, error: null };
  } catch (error) {
    return { rows: null, command: null, checks: [], error: asError(error) };
  } finally {
    tx.rollback();
  }
}

/** The same case through the pg look-alike the server uses. */
async function runClient(
  store: ReturnType<typeof memoryStore>['store'],
  c: RawCase,
): Promise<Outcome> {
  const client = new FirestoreClient(store, () => undefined);
  try {
    await client.query('BEGIN');
    await client.query(settingsSql, settingsValues(c.session));
    for (const step of c.setup ?? []) await client.query(step.text, step.values);
    const result = await client.query(c.text, c.values);
    return { rows: result.rows, command: result.command, checks: [], error: null };
  } catch (error) {
    return { rows: null, command: null, checks: [], error: asError(error) };
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}

async function main() {
  const client = new pg.Client({
    host,
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    database: process.env.POSTGRES_DB ?? 'accounter_demo',
    user: process.env.POSTGRES_USER ?? 'postgres',
    password: process.env.POSTGRES_PASSWORD ?? 'postgres',
    types: pgTypeParsers,
  });
  await client.connect();
  await client.query("SET TIME ZONE 'UTC'");

  const { rows: roles } = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [ROLE]);
  if (roles.length === 0) await client.query(`CREATE ROLE ${ROLE} NOLOGIN NOINHERIT NOBYPASSRLS`);
  await client.query(`GRANT USAGE ON SCHEMA accounter_schema TO ${ROLE}`);
  await client.query(`GRANT ALL ON ALL TABLES IN SCHEMA accounter_schema TO ${ROLE}`);
  await client.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA accounter_schema TO ${ROLE}`);

  // The database, copied into an in-memory store.
  const data = new Map<string, AnyRow[]>();
  for (const table of allTables()) {
    const order = table.primaryKey ? ` ORDER BY ${table.primaryKey.join(', ')}` : '';
    const { rows } = await client.query(`SELECT * FROM accounter_schema.${table.name}${order}`);
    data.set(table.name, rows);
  }
  const { store, backend } = memoryStore();
  for (const [name, rows] of data) {
    const info = tableInfo(name);
    const byPartition = new Map<string, { docId: string; data: Record<string, unknown> }[]>();
    for (const row of rows) {
      const partition = info.tenancy === 'owner' ? String(row[info.ownerColumn!]) : '';
      const list = byPartition.get(partition) ?? [];
      list.push({ docId: docIdFor(info, row), data: encodeRow(info, row) });
      byPartition.set(partition, list);
    }
    for (const [partition, docs] of byPartition) backend.seed({ partition, table: name }, docs);
  }

  const demo = (data.get('user_context') ?? [])[0]?.owner_id as string | undefined;
  if (!demo) throw new Error('No tenant (user_context row) in the database');
  if (!(data.get('business_users') ?? []).some(r => r.user_id === F.u1)) {
    throw new Error('Fixture rows missing: apply fixtures/080-auth-email.sql first');
  }

  const cases = (await buildCases(data, demo)).filter(
    c => !only || c.label.includes(only) || c.text.includes(only),
  );
  const totals = { pass: 0, fail: 0, gap: 0 };
  const problems: string[] = [];

  for (const c of cases) {
    // Wide: the database's clock (WSL here) can be seconds off the script's.
    const from = Date.now() - 60_000;
    const pgOut = await runPostgres(client, c);
    const fsOut = await runStore(store, c);
    const clientOut = await runClient(store, c);
    const window = { from, to: Date.now() + 60_000 };

    let problem = compareOutcomes(c, pgOut, fsOut, window);
    if (!problem) {
      const viaClient = compareOutcomes({ ...c, checks: [] }, fsOut, clientOut, window);
      if (viaClient) problem = `FirestoreClient differs from the direct port run: ${viaClient}`;
    }
    const outcome = pgOut.error ? `both raised ${pgOut.error.code}` : `${pgOut.rows!.length} rows`;
    if (!problem) {
      totals.pass++;
      if (verbose) console.log(`ok        ${c.label} (${outcome})${c.gap ? ' [gap closed?]' : ''}`);
    } else if (c.gap) {
      totals.gap++;
      problems.push(`GAP       ${c.label}: ${c.gap}\n    ${problem}`);
    } else {
      totals.fail++;
      problems.push(`FAIL      ${c.label}: ${problem}`);
    }
  }

  await client.end();
  store.close();
  for (const line of problems) console.log(line);
  console.log(
    `firestore:verify-raw  pass ${totals.pass}  fail ${totals.fail}  gap ${totals.gap}  (${cases.length} cases)`,
  );
  process.exit(totals.fail ? 1 : 0);
}

await main();
