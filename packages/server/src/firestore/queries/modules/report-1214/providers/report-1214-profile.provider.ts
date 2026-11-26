import type {
  IGetReport1214ProfilesByOwnerAndYearsQuery,
  IUpsertReport1214ProfileQuery,
} from '../../../../../modules/report-1214/__generated__/report-1214-profile.types.js';
import type { Row } from '../../../../catalog.js';
import { sqlEquals, unnestZip } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';
import { jsonbParam, type Json } from '../../reports/_jsonb.js';
import { intParam } from '../../reports/_params.js';

type Profile = Row<'report_1214_profiles'>;

/**
 * SELECT p.* FROM report_1214_profiles p
 * WHERE (p.owner_id, p.year) IN (
 *   SELECT k.owner_id, k.year FROM unnest($ownerIds::uuid[], $years::smallint[]) AS k(owner_id, year))
 *
 * unnest pads the shorter array with NULLs, and a pair with a NULL never matches.
 */
export const getReport1214ProfilesByOwnerAndYears =
  port<IGetReport1214ProfilesByOwnerAndYearsQuery>(async ({ ownerIds, years }, db) => {
    const yearValues = (years ?? []).map(y => intParam(y, 'smallint'));
    const pairs = unnestZip(ownerIds ?? [], yearValues).filter(
      ([owner, year]) => owner != null && year != null,
    );
    if (pairs.length === 0) return [];
    const rows = await db.whereIn(
      'report_1214_profiles',
      'owner_id',
      pairs.map(([owner]) => owner),
    );
    return rows.filter(row =>
      pairs.some(([owner, year]) => sqlEquals(row.owner_id, owner) && sqlEquals(row.year, year)),
    );
  });

const BLOCKS = [
  ['company', 'company', {}],
  ['declarations', 'declarations', {}],
  ['preparer', 'preparer', {}],
  ['attachments', 'attachments', {}],
  ['bank_account', 'bankAccount', {}],
  ['other_taxable_income', 'otherTaxableIncome', {}],
  ['capital_gains_summary', 'capitalGainsSummary', {}],
  ['qualifying_company', 'qualifyingCompany', {}],
  ['related_companies', 'relatedCompanies', []],
  ['rd_investments', 'rdInvestments', []],
  ['amount_overrides', 'amountOverrides', {}],
] as const satisfies readonly (readonly [
  keyof Profile,
  keyof IUpsertReport1214ProfileQuery['params'],
  Json,
])[];

/**
 * A block as the row gets it. A JSON `null` parameter is a jsonb null, not SQL NULL: COALESCE keeps
 * it, and it fails the table's object/array CHECK. The store cannot hold a top-level JSON null in a
 * jsonb column, so it gets a non-JSON text stand-in that fails the same CHECK (and is never stored).
 */
const blockValue = (value: Json) => (value === null ? 'null' : value);

/**
 * INSERT INTO report_1214_profiles (owner_id, year, company, ..., amount_overrides)
 * VALUES ($ownerId, $year, COALESCE($company::jsonb, '{}'::jsonb), ...,
 *   COALESCE($relatedCompanies::jsonb, '[]'::jsonb), ...)
 * ON CONFLICT (owner_id, year) DO UPDATE SET
 *   company = COALESCE($company::jsonb, report_1214_profiles.company), ...
 * RETURNING *
 */
export const upsertReport1214Profile = port<IUpsertReport1214ProfileQuery>(async (params, db) => {
  const blocks = BLOCKS.map(
    ([column, param, fallback]) => [column, jsonbParam(params[param]), fallback] as const,
  );
  const values: Record<string, unknown> = {
    owner_id: params.ownerId ?? null,
    year: intParam(params.year, 'smallint'),
  };
  for (const [column, value, fallback] of blocks) {
    values[column] = value === undefined ? fallback : blockValue(value);
  }
  const row = await db.insert('report_1214_profiles', values as Partial<Profile>, {
    target: ['owner_id', 'year'],
    action: () => {
      const patch: Record<string, unknown> = {};
      for (const [column, value] of blocks) {
        if (value !== undefined) patch[column] = blockValue(value);
      }
      return patch;
    },
  });
  return row ? [row] : [];
});
