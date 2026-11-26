/**
 * Fills a freshly migrated local Postgres database with the reference data a new Accounter
 * installation needs: countries and VAT rates (roles and permissions come from the migrations).
 * Copy it to Firestore afterwards with `firestore:import`, then register the first super-admin with
 * `firestore:add-super-admin` once that person has signed in, and let them create the first business
 * in the app (`bootstrapNewClient`, docs/super-user/super-admin-runbook.md).
 *
 *   POSTGRES_HOST=localhost POSTGRES_PORT=54329 POSTGRES_DB=accounter_bootstrap \
 *     yarn workspace @accounter/server firestore:bootstrap-db
 *
 * Refuses any host but localhost. Idempotent.
 */
import pg from 'pg';
import { seedCountries } from '../../src/modules/countries/helpers/seed-countries.helper.js';

const host = process.env.POSTGRES_HOST ?? 'localhost';
if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
  console.error(
    `firestore:bootstrap-db only runs against a local database (POSTGRES_HOST=${host})`,
  );
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
  await client.query('COMMIT');
  const counts = await client.query(
    `SELECT (SELECT count(*) FROM accounter_schema.countries) AS countries,
            (SELECT count(*) FROM accounter_schema.vat_value) AS vat_rates,
            (SELECT count(*) FROM accounter_schema.roles) AS roles,
            (SELECT count(*) FROM accounter_schema.permissions) AS permissions,
            (SELECT count(*) FROM accounter_schema.role_permissions) AS role_permissions`,
  );
  console.log('bootstrap database ready:', counts.rows[0]);
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
