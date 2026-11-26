/**
 * Ports of the raw `client.query('...')` statements (not pgTyped). Transaction control,
 * `set_config(...)` and `SELECT 1 AS health` are handled by the client itself (client.ts).
 *
 * Each entry's `match` is the statement exactly as the server sends it (compared with whitespace
 * collapsed), copied from the file named above it. Statements whose text is built at run time match
 * by pattern. Proven against Postgres by scripts/firestore/verify-raw.ts.
 *
 * Statements without RETURNING return no rows, so `rowCount` of an UPDATE or DELETE is 0 here
 * where pg reports the rows affected; no caller of these statements reads it.
 */
import { tableInfo, type AnyRow, type Row } from '../catalog.js';
import { DbError } from '../errors.js';
import { Numeric } from '../numeric.js';
import type { QueryDb } from '../query-db.js';
import { inList, orderBy, toDateString } from '../sql-helpers.js';
import type { RawStatement } from './types.js';

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

/**
 * A pattern that keeps the text it last matched. `findRawStatement` tests the patterns and the
 * client runs the statement it found in the same synchronous step, so `run` can read back the
 * statement's own text: the only way to know a run-time column list, since `run` gets the values
 * alone.
 */
class CapturingPattern extends RegExp {
  lastMatch: RegExpExecArray | null = null;

  override test(text: string): boolean {
    this.lastMatch = this.exec(text);
    return this.lastMatch !== null;
  }

  /** The match of the statement being run; call synchronously at the start of `run`. */
  take(): RegExpExecArray {
    const match = this.lastMatch;
    this.lastMatch = null;
    if (!match) throw new Error(`Firestore store: raw statement text lost for ${this.source}`);
    return match;
  }
}

const UUID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

/** `$1::uuid[]` (or an untyped array compared to a uuid column): every element must be a uuid. */
function uuidArray(value: unknown): string[] | null {
  if (value == null) return null;
  if (!Array.isArray(value)) {
    throw new DbError(`malformed array literal: "${String(value)}"`, '22P02');
  }
  const result: string[] = [];
  for (const element of value) {
    if (element == null) continue;
    const text = String(element);
    if (!UUID.test(text.trim().replace(/^\{(.*)\}$/, '$1'))) {
      throw new DbError(`invalid input syntax for type uuid: "${text}"`, '22P02');
    }
    result.push(text.toLowerCase());
  }
  return result;
}

/**
 * A value assigned to a `numeric(p,s)` column, rounded to its scale as Postgres stores it (the store
 * keeps numerics as given), and refused when it does not fit the precision.
 */
function numericForColumn(table: string, column: string, value: unknown): string | null {
  if (value == null) return null;
  const typmod = /numeric\((\d+),\s*(\d+)\)/.exec(
    tableInfo(table).columnByName.get(column)!.pgType,
  );
  const number = Numeric.of(value as string | number);
  if (!typmod) return number.toString();
  const precision = Number(typmod[1]);
  const scale = Number(typmod[2]);
  const scaled = number.withScale(scale);
  const integerDigits = scaled.abs().toString().split('.')[0]!.replace(/^0+/, '').length;
  if (integerDigits > precision - scale) {
    throw new DbError('numeric field overflow', '22003');
  }
  return scaled.toString();
}

const isOlderThan = (value: Date | null, db: QueryDb, ms: number) =>
  value != null && value.getTime() < db.ctx.now.getTime() - ms;

/** The rows of the membership of a user id, newest update first (`ORDER BY updated_at DESC`). */
async function membershipsOf(db: QueryDb, userId: unknown) {
  if (userId == null) return [];
  const rows = await db.where('business_users', { user_id: userId as string });
  return orderBy(rows, [{ value: row => row.updated_at, desc: true }]);
}

/** `UPDATE financial_entities SET owner_id = $id WHERE id = $id` (the store checks the RLS). */
async function setSelfOwner(db: QueryDb, id: unknown) {
  if (id == null) return [];
  for (const entity of await db.where('financial_entities', { id: id as string })) {
    await db.update('financial_entities', entity, { owner_id: id as string });
  }
  return [];
}

// ---------------------------------------------------------------------------------------------
// Statements built at run time
// ---------------------------------------------------------------------------------------------

/** modules/countries/helpers/seed-countries.helper.ts: one `($n, $m)` pair per country. */
const seedCountriesPattern = new CapturingPattern(
  /^INSERT INTO accounter_schema\.countries \(name, code\) VALUES (\(\$\d+, \$\d+\)(?:, \(\$\d+, \$\d+\))*) ON CONFLICT \(code\) DO NOTHING$/
    .source,
);

/**
 * modules/onboarding/providers/admin-onboarding.provider.ts: `INSERT INTO user_context
 * (${columns}) VALUES (${placeholders}) ON CONFLICT (owner_id) DO NOTHING`, the column list
 * depending on which optional settings the new client has.
 */
const userContextInsertPattern = new CapturingPattern(
  /^INSERT INTO accounter_schema\.user_context \(([a-z0-9_]+(?:, [a-z0-9_]+)*)\) VALUES \((\$\d+(?:, \$\d+)*)\) ON CONFLICT \(owner_id\) DO NOTHING$/
    .source,
);

const placeholder = (text: string, values: unknown[]) => values[Number(text.slice(1)) - 1] ?? null;

// ---------------------------------------------------------------------------------------------
// The statements
// ---------------------------------------------------------------------------------------------

export const RAW_STATEMENTS: RawStatement[] = [
  // ----- jobs/cleanup-expired-invitations.ts --------------------------------------------------
  {
    match: `SELECT id, auth0_user_id, user_id, business_id
       FROM accounter_schema.invitations
       WHERE accepted_at IS NULL
         AND expires_at < NOW()`,
    command: 'SELECT',
    run: async (_values, db) =>
      (await db.rows('invitations'))
        .filter(i => i.accepted_at == null && i.expires_at.getTime() < db.ctx.now.getTime())
        .map(i => ({
          id: i.id,
          auth0_user_id: i.auth0_user_id,
          user_id: i.user_id,
          business_id: i.business_id,
        })),
  },
  {
    match: `DELETE FROM accounter_schema.business_users
             WHERE user_id = $1 AND auth0_user_id IS NULL`,
    command: 'DELETE',
    run: async ([userId], db) => {
      if (userId == null) return [];
      for (const row of await db.where('business_users', { user_id: userId as string })) {
        if (row.auth0_user_id == null) await db.delete('business_users', row);
      }
      return [];
    },
  },
  {
    match: 'DELETE FROM accounter_schema.invitations WHERE id = $1',
    command: 'DELETE',
    run: async ([id], db) => {
      if (id == null) return [];
      for (const row of await db.where('invitations', { id: id as string })) {
        await db.delete('invitations', row);
      }
      return [];
    },
  },

  // ----- modules/auth/providers/auth-context.provider.ts ----------------------------------------
  {
    // handleDevBypassAuth
    match: `SELECT user_id, business_id, role_id, auth0_user_id
     FROM accounter_schema.business_users
     WHERE user_id = $1
     ORDER BY updated_at DESC`,
    command: 'SELECT',
    run: async ([userId], db) =>
      (await membershipsOf(db, userId)).map(row => ({
        user_id: row.user_id,
        business_id: row.business_id,
        role_id: row.role_id,
        auth0_user_id: row.auth0_user_id,
      })),
  },
  {
    // resolveApiKeyContext
    match: `SELECT id, business_id, role_id
       FROM accounter_schema.api_keys
       WHERE key_hash = $1
         AND revoked_at IS NULL`,
    command: 'SELECT',
    run: async ([keyHash], db) => {
      if (keyHash == null) return [];
      return (await db.where('api_keys', { key_hash: keyHash as string }))
        .filter(key => key.revoked_at == null)
        .map(key => ({ id: key.id, business_id: key.business_id, role_id: key.role_id }));
    },
  },
  {
    // resolveApiKeyContext: usage timestamp, at most once an hour
    match: `UPDATE accounter_schema.api_keys
       SET last_used_at = NOW()
       WHERE id = $1
         AND (last_used_at IS NULL OR last_used_at < NOW() - INTERVAL '1 hour')`,
    command: 'UPDATE',
    run: async ([id], db) => {
      if (id == null) return [];
      for (const key of await db.where('api_keys', { id: id as string })) {
        if (key.last_used_at == null || isOlderThan(key.last_used_at, db, 60 * 60 * 1000)) {
          await db.update('api_keys', key, { last_used_at: db.ctx.now });
        }
      }
      return [];
    },
  },
  {
    // mapAuth0UserToLocal: byAuth0Query
    match: `SELECT bu.user_id, bu.business_id, bu.role_id
      FROM accounter_schema.business_users bu
      WHERE bu.auth0_user_id = $1
      ORDER BY bu.updated_at DESC`,
    command: 'SELECT',
    run: async ([auth0UserId], db) => {
      if (auth0UserId == null) return [];
      const rows = await db.where('business_users', { auth0_user_id: auth0UserId as string });
      return orderBy(rows, [{ value: row => row.updated_at, desc: true }]).map(row => ({
        user_id: row.user_id,
        business_id: row.business_id,
        role_id: row.role_id,
      }));
    },
  },
  {
    // mapAuth0UserToLocal: byVerifiedEmailQuery
    match: `SELECT bu.user_id
      FROM accounter_schema.invitations i
      JOIN accounter_schema.business_users bu
        ON bu.user_id = i.user_id
       AND bu.business_id = i.business_id
      WHERE LOWER(i.email) = LOWER($1)
        AND i.accepted_at IS NOT NULL
      ORDER BY i.accepted_at DESC
      LIMIT 1`,
    command: 'SELECT',
    run: async ([email], db) => {
      if (email == null) return [];
      const wanted = String(email).toLowerCase();
      const joined: { user_id: string; accepted_at: Date }[] = [];
      for (const i of await db.rows('invitations')) {
        if (i.accepted_at == null || i.email.toLowerCase() !== wanted) continue;
        for (const bu of await db.where('business_users', {
          user_id: i.user_id,
          business_id: i.business_id,
        })) {
          joined.push({ user_id: bu.user_id, accepted_at: i.accepted_at });
        }
      }
      return orderBy(joined, [{ value: row => row.accepted_at, desc: true }])
        .slice(0, 1)
        .map(row => ({ user_id: row.user_id }));
    },
  },
  {
    // mapAuth0UserToLocal: relinkAuth0IdQuery
    match: `UPDATE accounter_schema.business_users
      SET auth0_user_id = $1, updated_at = NOW()
      WHERE user_id = $2`,
    command: 'UPDATE',
    run: async ([auth0UserId, userId], db) => {
      if (userId == null) return [];
      for (const row of await db.where('business_users', { user_id: userId as string })) {
        await db.update('business_users', row, {
          auth0_user_id: (auth0UserId ?? null) as string | null,
          updated_at: db.ctx.now,
        });
      }
      return [];
    },
  },
  {
    // mapAuth0UserToLocal: byUserIdQuery
    match: `SELECT bu.user_id, bu.business_id, bu.role_id
      FROM accounter_schema.business_users bu
      WHERE bu.user_id = $1
      ORDER BY bu.updated_at DESC`,
    command: 'SELECT',
    run: async ([userId], db) =>
      (await membershipsOf(db, userId)).map(row => ({
        user_id: row.user_id,
        business_id: row.business_id,
        role_id: row.role_id,
      })),
  },

  // ----- modules/charges/providers/charges-authorization.provider.ts ---------------------------
  {
    match: 'SELECT id FROM accounter_schema.charges WHERE id = ANY($1::uuid[])',
    command: 'SELECT',
    run: async ([ids], db) => {
      const wanted = uuidArray(ids);
      if (!wanted) return [];
      return (await db.whereIn('charges', 'id', wanted)).map(charge => ({ id: charge.id }));
    },
  },

  // ----- modules/countries/helpers/seed-countries.helper.ts ------------------------------------
  {
    match: seedCountriesPattern,
    command: 'INSERT',
    run: async (values, db) => {
      const match = seedCountriesPattern.take();
      for (const pair of match[1]!.matchAll(/\((\$\d+), (\$\d+)\)/g)) {
        await db.insert(
          'countries',
          {
            name: placeholder(pair[1]!, values) as string,
            code: placeholder(pair[2]!, values) as string,
          },
          { target: ['code'], action: 'nothing' },
        );
      }
      return [];
    },
  },

  // ----- modules/onboarding/providers/admin-onboarding.provider.ts -----------------------------
  {
    match: userContextInsertPattern,
    command: 'INSERT',
    run: async (values, db) => {
      const match = userContextInsertPattern.take();
      const columns = match[1]!.split(', ');
      const placeholders = match[2]!.split(', ');
      if (columns.length !== placeholders.length) {
        throw new DbError('INSERT has more target columns than expressions', '42601');
      }
      const row: AnyRow = {};
      columns.forEach((column, i) => {
        row[column] = placeholder(placeholders[i]!, values);
      });
      await db.insert('user_context', row as Partial<Row<'user_context'>>, {
        target: ['owner_id'],
        action: 'nothing',
      });
      return [];
    },
  },

  // ----- demo-fixtures/helpers/admin-context.ts (demo seed) ------------------------------------
  {
    match: `INSERT INTO accounter_schema.businesses_admin (id, owner_id)
     VALUES ($1, $1)
     ON CONFLICT (id) DO UPDATE
     SET owner_id = EXCLUDED.owner_id`,
    command: 'INSERT',
    run: async ([id], db) => {
      await db.insert(
        'businesses_admin',
        { id: (id ?? null) as string, owner_id: (id ?? null) as string },
        { target: ['id'], action: (_existing, excluded) => ({ owner_id: excluded.owner_id }) },
      );
      return [];
    },
  },
  {
    match: `SELECT id
       FROM accounter_schema.financial_entities
      WHERE id = $1 OR (type = 'business' AND name = 'Accounter Admin Business')
      LIMIT 1`,
    command: 'SELECT',
    // LIMIT without ORDER BY: either matching row will do, as in Postgres.
    run: async ([id], db) =>
      (await db.rows('financial_entities'))
        .filter(
          fe =>
            (id != null && fe.id === id) ||
            (fe.type === 'business' && fe.name === 'Accounter Admin Business'),
        )
        .slice(0, 1)
        .map(fe => ({ id: fe.id })),
  },
  {
    // The root with owner_id NULL, which only the `allow_bootstrap_root` policy (id = current
    // business) admits; the store files it under its own id.
    match: `INSERT INTO accounter_schema.financial_entities (id, type, name, owner_id)
     VALUES ($1, 'business', 'Accounter Admin Business', NULL)`,
    command: 'INSERT',
    run: async ([id], db) => {
      await db.insert('financial_entities', {
        id: (id ?? null) as string,
        type: 'business',
        name: 'Accounter Admin Business',
        owner_id: null,
      });
      return [];
    },
  },
  {
    match: `INSERT INTO accounter_schema.businesses (id, owner_id)
     VALUES ($1, $1)`,
    command: 'INSERT',
    run: async ([id], db) => {
      await db.insert('businesses', {
        id: (id ?? null) as string,
        owner_id: (id ?? null) as string,
      });
      return [];
    },
  },
  {
    match: `UPDATE accounter_schema.financial_entities
     SET owner_id = $1
     WHERE id = $1`,
    command: 'UPDATE',
    run: async ([id], db) => setSelfOwner(db, id),
  },

  // ----- demo-fixtures/helpers/seed-demo-users.ts ----------------------------------------------
  {
    match: `INSERT INTO accounter_schema.business_users (user_id, business_id, role_id, auth0_user_id)
     VALUES
       ($1, $2, 'business_owner', $3),
       ($4, $2, 'accountant', NULL)
     ON CONFLICT (user_id, business_id) DO NOTHING`,
    command: 'INSERT',
    run: async ([adminUserId, businessId, auth0UserId, accountantUserId], db) => {
      const rows = [
        { user_id: adminUserId, role_id: 'business_owner', auth0_user_id: auth0UserId },
        { user_id: accountantUserId, role_id: 'accountant', auth0_user_id: null },
      ];
      for (const row of rows) {
        await db.insert(
          'business_users',
          {
            user_id: (row.user_id ?? null) as string,
            business_id: (businessId ?? null) as string,
            role_id: row.role_id,
            auth0_user_id: (row.auth0_user_id ?? null) as string | null,
          },
          { target: ['user_id', 'business_id'], action: 'nothing' },
        );
      }
      return [];
    },
  },

  // ----- demo-fixtures/helpers/seed-exchange-rates.ts ------------------------------------------
  {
    match: `INSERT INTO accounter_schema.exchange_rates (exchange_date, usd, eur, gbp)
     VALUES (CURRENT_DATE, 3.5, 4.0, 4.5)
     ON CONFLICT (exchange_date)
     DO UPDATE SET usd = EXCLUDED.usd, eur = EXCLUDED.eur, gbp = EXCLUDED.gbp`,
    command: 'INSERT',
    run: async (_values, db) => {
      await db.insert(
        'exchange_rates',
        {
          exchange_date: toDateString(db.ctx.now),
          usd: numericForColumn('exchange_rates', 'usd', '3.5'),
          eur: numericForColumn('exchange_rates', 'eur', '4.0'),
          gbp: numericForColumn('exchange_rates', 'gbp', '4.5'),
        },
        {
          target: ['exchange_date'],
          action: (_existing, excluded) => ({
            usd: excluded.usd,
            eur: excluded.eur,
            gbp: excluded.gbp,
          }),
        },
      );
      return [];
    },
  },

  // ----- demo-fixtures/helpers/seed-vat.ts -----------------------------------------------------
  {
    match: `INSERT INTO accounter_schema.vat_value (percentage, date)
       VALUES ($1, $2)
       ON CONFLICT (date) DO NOTHING`,
    command: 'INSERT',
    run: async ([percentage, date], db) => {
      await db.insert(
        'vat_value',
        {
          percentage: numericForColumn('vat_value', 'percentage', percentage) as string,
          date: (date == null ? null : toDateString(date)) as string,
        },
        { target: ['date'], action: 'nothing' },
      );
      return [];
    },
  },

  // ----- demo-fixtures/validate-demo-data.ts ---------------------------------------------------
  {
    match: `SELECT id FROM accounter_schema.financial_entities WHERE type = 'business' AND name = 'Admin Business'`,
    command: 'SELECT',
    run: async (_values, db) =>
      (await db.rows('financial_entities'))
        .filter(fe => fe.type === 'business' && fe.name === 'Admin Business')
        .map(fe => ({ id: fe.id })),
  },
  {
    match: 'SELECT COUNT(*) FROM accounter_schema.charges',
    command: 'SELECT',
    run: async (_values, db) => [{ count: String((await db.rows('charges')).length) }],
  },
  {
    match:
      'SELECT * FROM accounter_schema.ledger_records WHERE charge_id = ANY($1) ORDER BY created_at',
    command: 'SELECT',
    run: async ([chargeIds], db) => {
      const wanted = uuidArray(chargeIds);
      if (!wanted) return [];
      const rows = await db.whereIn('ledger_records', 'charge_id', wanted);
      return orderBy(rows, [{ value: row => row.created_at }]);
    },
  },
  {
    match: 'SELECT 1 FROM accounter_schema.vat_value WHERE percentage = 0.17',
    command: 'SELECT',
    run: async (_values, db) => {
      const isRate = inList(['0.17'], 'decimal');
      return (await db.rows('vat_value'))
        .filter(row => isRate(row.percentage))
        .map(() => ({ '?column?': 1 }));
    },
  },
];
