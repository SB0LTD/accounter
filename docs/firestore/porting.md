# Porting a query to Firestore

Read `docs/firestore/design.md` first. This is the how-to for turning one pgTyped `sql` query into
its TypeScript port and proving it.

## Where things go

A query declared in `packages/server/src/<path>.ts` as

```ts
const getChargesByIds = sql<IGetChargesByIdsQuery>`SELECT * FROM accounter_schema.charges WHERE id IN $$chargeIds;`
```

is ported in `packages/server/src/firestore/queries/<path>.ts` (same relative path) as an export
with the same name:

```ts
import type { IGetChargesByIdsQuery } from '../../../../../modules/charges/__generated__/charges.types.js'
import { port } from '../../../port.js'

/** SELECT * FROM charges WHERE id IN $$chargeIds */
export const getChargesByIds = port<IGetChargesByIdsQuery>(async ({ chargeIds }, db) =>
  db.whereIn('charges', 'id', chargeIds)
)
```

Its cases go in `<same path>.cases.ts` next to it (see "Cases"). Helpers shared by one module's
ports go in `src/firestore/queries/<path-to-module>/_helpers.ts`. Fixture rows go in
`packages/server/scripts/firestore/fixtures/<NNN>-<module>.sql`.

Do **not** edit provider files, the store core (`src/firestore/*.ts`), `index.generated.ts`, the
catalog, or another module's ports. If the store lacks something, work around it in your module and
say so in your report.

## The `db` a port gets (`QueryDb`, src/firestore/query-db.ts)

| Call                                                               | SQL it stands for                                          |
| ------------------------------------------------------------------ | ---------------------------------------------------------- |
| `await db.rows('charges')`                                         | `SELECT * FROM charges` (only rows RLS lets you read)      |
| `await db.where('charges', { id, owner_id })`                      | `WHERE id = $1 AND owner_id = $2` (index-backed)           |
| `await db.whereIn('charges', 'id', ids)`                           | `WHERE id IN (...)` / `= ANY($ids)` (index-backed)         |
| `await db.insert('tags', values, onConflict?)`                     | one-row INSERT; returns the row, or null when skipped      |
| `await db.update('tags', row, patch)`                              | UPDATE of that row; returns the new row                    |
| `await db.delete('tags', row)`                                     | DELETE of that row (applies ON DELETE actions); returns it |
| `db.views.extendedTags()` etc.                                     | the schema's views                                         |
| `db.ctx.businessId`, `db.ctx.scope`, `db.ctx.userId`, `db.ctx.now` | `app.*` settings, `now()`                                  |

- Tenant isolation (RLS) is the store's job: `rows`/`where` already return only what the request may
  read, and writes outside the current business raise 42501. Still apply every `WHERE owner_id = $x`
  the SQL has: it is part of the query.
- Rows are frozen and shared. Never mutate one; build new objects (`{ ...row, extra }`).
- Run writes one after another (`for ... of` + `await`), never `Promise.all`.
- INSERT: for every column in the statement's column list pass `param ?? null`. An explicit NULL
  never takes the column default; only columns left out of the list get defaults (`id`,
  `created_at`, ...).
- `ON CONFLICT DO NOTHING` → `{ action: 'nothing' }`;
  `ON CONFLICT (a, b) DO UPDATE SET x = EXCLUDED.x` →
  `{ target: ['a', 'b'], action: (existing, excluded) => ({ x: excluded.x }) }`;
  `ON CONSTRAINT name` → `target: { constraint: 'name' }`. A conflict on a different constraint than
  the target still raises 23505, as in Postgres.
- Statements without RETURNING return `[]`.

## Postgres semantics to keep (src/firestore/sql-helpers.ts has helpers for each)

- **Types as `pg` returns them.** `numeric`, `bigint`, `count(*)`, `sum(int)` are **strings**;
  `integer`/`real` are numbers; `date` columns are `'YYYY-MM-DD'` strings; `timestamp(tz)` are
  `Date`; json is the parsed value. The generated `I…Result` types tell you which. Do numeric math
  with `Numeric` / `num()` (exact, Postgres result scales), never with JS floats.
- **NULL.** `=`, `IN`, `<` with NULL are never true (`sqlEquals`, `inList`). `IS NOT DISTINCT FROM`
  is `notDistinct`. `COALESCE` is `coalesce`.
- **`SET col = COALESCE($param, col)`** is `coalescePatch({ col: param, ... })`.
- **ILIKE / LIKE** with `%`, `_`: `ilike`, `like`, `containsInsensitive`.
- **Aggregates.** `count` → string (`countText`); `sum` → `sumText`/`sumNumeric`; `min`/`max` →
  `minOf`/`maxOf`; `array_agg(DISTINCT x)` is **sorted ascending** (`arrayAggDistinct`);
  `array_agg(x)` follows input order; all of them return NULL (not `[]`, not `0`) over no rows,
  except `count`, which is `'0'`.
- **ORDER BY.** Use `orderBy(rows, [{ value: r => r.date, desc: true }])`: NULLs sort last ascending
  and first descending, as in Postgres. Text compares by collation (`compareText`). Without ORDER BY
  the row order does not matter (the harness compares as sets).
- **LIMIT/OFFSET** with NULL meaning "none": `limitOffset`.
- **DISTINCT ON** after ordering: `distinctOn`. `SELECT DISTINCT`: `distinctRows`.
- **Joins.** Build a `Map` from one side (`groupBy`), look up from the other. LEFT JOIN fills the
  right side's columns with `null`.
- **`SELECT *` / `t.*`** means every column of the table, all of them, with their names.
- **Dates.** `truncDate`, `extractPart`, `addToDate` (month-end clamped like Postgres),
  `toDateString`. `now()` is `db.ctx.now` (transaction start time).
- **pgTyped parameters.** `$$list` is an array; `VALUES $$rows(a, b)` is an array of objects (insert
  one row per element, in order, returning them in order); `$x!` means the caller always passes it.
  An empty `$$list` makes invalid SQL in Postgres — don't use one in a case.

## Cases

Every port needs cases unless its SQL has no parameters:

```ts
import type { IGetChargesByIdsQuery } from '../../../../../modules/charges/__generated__/charges.types.js'
import { caseFor, type Cases } from '../../../cases.js'

export const cases: Cases = {
  getChargesByIds: caseFor<IGetChargesByIdsQuery>(s => [
    { chargeIds: s.ids('charges', 5) }, // hits
    { chargeIds: [s.missingId] } // misses
  ])
}
```

`s` (`Snapshot`) gives the loaded data: `s.rows(table)`, `s.ids(table, n)`,
`s.values(table, column, n)`, `s.businessId` (the tenant the case runs as), `s.userId`,
`s.missingId`. Pick parameters that make the query return rows, plus edge cases: no match, NULL
optional parameters, conflicts for upserts, a write that must raise (both sides must raise the same
code).

When the demo data has nothing for your tables, add rows in your fixtures file
(`scripts/firestore/fixtures/<NNN>-<module>.sql`): idempotent (`ON CONFLICT DO NOTHING`), fixed
UUIDs from your assigned range, owned by the demo tenant
(`(SELECT owner_id FROM accounter_schema.user_context LIMIT 1)`).

## Running

Each porter has a database of their own (a copy of the demo database). Set it once per shell:

```sh
cd packages/server
export POSTGRES_HOST=localhost POSTGRES_PORT=54329 POSTGRES_USER=postgres POSTGRES_PASSWORD=postgres
export POSTGRES_DB=<your database>
yarn firestore:fixtures --only <NNN>-<module>      # apply your fixtures
yarn firestore:verify --only modules/<module>/ --verbose
```

`firestore:verify` prints `ok` / `FAIL` / `SOFT` (order-only differences) per case and a summary. A
port is done when all its cases pass. `SOFT` is acceptable only when the SQL itself leaves the order
undefined (no ORDER BY, or ties); say so in a comment on the port.

Typecheck once at the end (it is slow; run it alone):

```sh
npx tsc --noEmit -p tsconfig.json 2>&1 | grep "src/firestore/queries/modules/<module>"
```

Do not run `yarn firestore:queries` (it rewrites the shared index; the integrator runs it).
