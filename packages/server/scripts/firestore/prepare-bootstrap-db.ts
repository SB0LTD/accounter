/**
 * Fills a freshly migrated local Postgres database with what a new Accounter installation needs
 * before anyone can sign in: countries, VAT rates, and the first super-admin. Copy it to Firestore
 * afterwards with `firestore:import`. The super-admin then creates the first business in the app
 * (`bootstrapNewClient`, docs/super-user/super-admin-runbook.md).
 *
 *   POSTGRES_HOST=localhost POSTGRES_PORT=54329 POSTGRES_DB=accounter_bootstrap \
 *     yarn workspace @accounter/server firestore:bootstrap-db --super-admin-uid <firebase uid> [--note "..."]
 *
 * Refuses any host but localhost. Idempotent.
 */
import pg from 'pg';
import { seedCountries } from '../../src/modules/countries/helpers/seed-countries.helper.js';

const args = process.argv.slice(2);
const option = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const superAdminUid = option('--super-admin-uid');
const note = option('--note') ?? 'first super-admin (bootstrap)';

const host = process.env.POSTGRES_HOST ?? 'localhost';
if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
  console.error(
    `firestore:bootstrap-db only runs against a local database (POSTGRES_HOST=${host})`,
  );
  process.exit(2);
}
if (!superAdminUid) {
  console.error('Pass --super-admin-uid <Firebase uid of the first super-admin>');
  process.exit(2);
}

/** Israeli VAT rates (the same as the demo seed's defaults). */
const VAT_RATES = [
  { percentage: 0.17, date: '2015-01-01' },
  { percentage: 0.18, date: '2025-01-01' },
];

const client = new pg.Client({
  host,
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  database: process.env.POSTGRES_DB ?? 'accounter_bootstrap',
  user: process.env.POSTGRES_USER ?? 'postgres',
  password: process.env.POSTGRES_PASSWORD ?? 'postgres',
});
await client.connect();
try {
  await client.query('BEGIN');
  await seedCountries(client);
  for (const { percentage, date } of VAT_RATES) {
    await client.query(
      'INSERT INTO accounter_schema.vat_value (percentage, date) VALUES ($1, $2) ON CONFLICT (date) DO NOTHING',
      [percentage, date],
    );
  }
  await client.query(
    'INSERT INTO accounter_schema.super_admins (auth0_user_id, note) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [superAdminUid, note],
  );
  await client.query('COMMIT');
  const counts = await client.query(
    `SELECT (SELECT count(*) FROM accounter_schema.countries) AS countries,
            (SELECT count(*) FROM accounter_schema.vat_value) AS vat_rates,
            (SELECT count(*) FROM accounter_schema.roles) AS roles,
            (SELECT count(*) FROM accounter_schema.permissions) AS permissions,
            (SELECT count(*) FROM accounter_schema.super_admins) AS super_admins`,
  );
  console.log('bootstrap database ready:', counts.rows[0]);
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
