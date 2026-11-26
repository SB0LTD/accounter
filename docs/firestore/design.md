# Accounter on Firestore and Firebase Auth

Status: in progress on branch `sb0/firestore` of `SB0LTD/accounter` (fork of
`urigo/accounter-fullstack`). Target: `https://acc.sb0.tech`.

## Goals

- Firestore is the only database. No Postgres in production.
- Firebase Auth replaces Auth0.
- The GraphQL API and the web client keep working unchanged for users.
- Every ported query returns what the Postgres version returned for the same data. Tax and VAT
  reports must not drift.

## Where things run

| Piece                   | Where                                                        |
| ----------------------- | ------------------------------------------------------------ |
| GraphQL server          | Cloud Run service `accounter-api`, project `sb0-tech`        |
| Database                | Firestore **named** database `accounter`, project `sb0-tech` |
| Sign-in                 | Firebase Auth, project `sb0-tech`                            |
| Web client (static SPA) | Firebase Hosting in its own project, domain `acc.sb0.tech`   |
| Daily jobs              | Cloud Scheduler → authenticated job endpoints on the server  |

The project's `(default)` Firestore database is left alone for sb0.tech's own backend. The client
calls the API on its Cloud Run URL. The server already serves CORS with a two-hour preflight cache.

## What the Postgres schema really holds

Measured from a database built by all 230 migrations (Postgres 18):

- 109 tables, 68 with an `owner_id` tenant column, no sequences (all ids are UUIDs).
- 3 views: `extended_charges`, `extended_tags`, `extended_business_trip_transactions`.
- 22 functions: 4 RLS context getters, 15 bank-scrape insert handlers, 2 `updated_at` helpers.
- 25 triggers: 11 raw-bank-row insert triggers and 14 `updated_at` triggers.
- 146 RLS policies. Reads: `owner_id = ANY(current_business_scope)`. Writes:
  `owner_id = current_business_id`.

The logic lives in the server: 439 typed SQL queries (pgTyped) across 102 providers, plus a few raw
`query()` calls.

## Data model

```
tenants/{ownerId}/{table}/{rowId}   tenant rows (owner_id, or tenant via a parent row)
{table}/{rowId}                     global rows (countries, exchange_rates, users, roles, ...)
_meta/schema                         schema version of the stored data
```

- Document id = primary key. Composite keys join their parts with `~`.
- Field names are the Postgres column names, so ported code reads rows the way it always did.
- Values are stored so that a row read back equals what `pg` returned:

| Postgres type                   | Firestore                  | Row value in the server          |
| ------------------------------- | -------------------------- | -------------------------------- |
| uuid, text, varchar, enum, inet | string                     | string                           |
| numeric, bigint                 | string (exact)             | string (as `pg` returns them)    |
| integer, smallint, real, double | number                     | number                           |
| boolean                         | boolean                    | boolean                          |
| date, time                      | string `YYYY-MM-DD`        | string (the server's pg parsers) |
| timestamp, timestamptz          | Timestamp                  | `Date`                           |
| json, jsonb                     | string (JSON text)         | parsed value                     |
| bit(n)                          | string of `0`/`1`          | string                           |
| arrays                          | array (jsonb[] as strings) | array                            |

JSON is stored as text because Firestore rejects nested arrays, which JSON values can hold.

## Server data layer

### Live replica per instance

Each Cloud Run instance keeps a live in-memory copy of the tenants it serves:

- The first request for a tenant attaches one snapshot listener per tenant collection and waits for
  the initial snapshot. Global collections are listened to once per instance.
- Reads are in memory. A report that joins charges, transactions, documents and ledger records is a
  loop over arrays, not dozens of Firestore round trips.
- Listener updates keep every instance current within about a second.

### Unit of work

`TenantAwareDBClient` keeps its public API (`query`, `transaction`, `dispose`), backed by a
request-scoped unit of work:

- Writes go to an overlay that the same request reads through (read-your-writes).
- A stand-alone write commits at once. `transaction()` commits at the end of the outermost scope.
  Savepoints roll back the overlay to a mark.
- A commit is one Firestore batch (chunked past the batch limit), then applied to the replica.
- Constraints are checked against replica + overlay before commit: primary keys, unique keys
  (including `ON CONFLICT` targets), NOT NULL, foreign keys, and `ON DELETE CASCADE / SET NULL`.
- Column defaults (`uuidv7()`, `now()`, literals) and the `updated_at` triggers run in the store.
- The bank insert handlers become TypeScript hooks on the raw bank tables.

The first deploy runs with `max-instances=1`, so all writes go through one process. Commits carry
`lastUpdateTime` preconditions on the rows they update, so a second instance would fail a stale
write rather than lose data.

### Tenant isolation instead of RLS

The store a request gets is built from its auth context:

- reads see the tenants in `current_business_scope` and the global collections,
- writes may only touch `tenants/{current_business_id}`,
- tables whose policies are read-only for the app (`super_admins`, ...) reject writes.

A query cannot reach another tenant: the path is not in its store.

### Queries

pgTyped stays the source of query types. The `sql` tag comes from a local module instead of
`@pgtyped/runtime`. It hashes the query text and dispatches `.run(params, db)` to a TypeScript
implementation registered under the provider's constant name:

```ts
// packages/server/src/firestore/queries/charges/charges.provider.ts
export const getChargesByIds: Impl<IGetChargesByIdsQuery> = ({ chargeIds }, db) =>
  db.table('charges').filter(c => chargeIds.includes(c.id))
```

- Provider code does not change, so upstream fixes to provider logic still merge.
- A test fails when a `sql` query has no implementation or its text changed since it was ported.
  Merging upstream then lists exactly the queries to revisit.
- The three views are TypeScript functions memoised per replica version.

### Proving each query

`yarn firestore:verify` loads one dataset into Postgres (the original queries) and into the store
(the ports). It runs every query with recorded parameter sets and compares the rows, ignoring order
unless the SQL orders them. Ports land only when they match.

## Sign-in

- Server: Firebase ID tokens checked with `jose` against Google's `securetoken` JWKS, issuer
  `https://securetoken.google.com/sb0-tech`, audience `sb0-tech`. The Firebase uid takes the place
  of the Auth0 `sub` in `business_users.auth0_user_id`.
- User management (`Auth0ManagementProvider`) moves to the Firebase Admin SDK: look up by email,
  create disabled user for an invitation, enable on acceptance, disable, delete, password-reset
  email.
- Client: `@auth0/auth0-react` is replaced by a small Firebase Auth provider with the same hooks the
  app uses, plus a sign-in page (Google and email/password).

## Build and deploy

- pgTyped types are generated from a local Postgres built by the migrations and committed, so builds
  do not need a database.
- Server: Node 26 container, deployed with `gcloud run deploy --source`.
- Client: `vite build` with the Firebase web config and `GRAPHQL_URL`, then
  `firebase deploy --only hosting`.

## Order of work

1. Catalog of tables, columns, keys and defaults (`firestore/schema/catalog.json`), generated from
   the migrated database.
2. Store: replica, unit of work, constraints, defaults, triggers, views.
3. `sql` dispatch, registry and drift test.
4. Verification harness against Postgres.
5. Port the queries module by module, verified.
6. Firebase Auth on server and client.
7. Infrastructure and deploy to `acc.sb0.tech`.
