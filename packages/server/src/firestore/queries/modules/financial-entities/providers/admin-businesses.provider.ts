import { insertRow, pgParams, uuidList, uuidParam } from '../_helpers.js';
import type {
  IGetAdminBusinessesByIdsQuery,
  IGetAllAdminBusinessesQuery,
  IInsertAdminBusinessQuery,
  IUpdateAdminBusinessesQuery,
} from '../../../../../modules/financial-entities/__generated__/admin-businesses.types.js';
import type { Row } from '../../../../catalog.js';
import type { QueryDb } from '../../../../query-db.js';
import { coalescePatch } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';

/**
 * `businesses_admin ab INNER JOIN businesses b USING (id) INNER JOIN financial_entities f USING (id)`
 * → `ab.*, f.name, b.vat_number`
 */
async function joinAdmin(db: QueryDb, admins: readonly Row<'businesses_admin'>[]) {
  const ids = admins.map(ab => ab.id);
  const businesses = new Map((await db.whereIn('businesses', 'id', ids)).map(b => [b.id, b]));
  const entities = new Map(
    (await db.whereIn('financial_entities', 'id', ids)).map(fe => [fe.id, fe]),
  );
  const result = [];
  for (const ab of admins) {
    const b = businesses.get(ab.id);
    const f = entities.get(ab.id);
    if (b && f) result.push({ ...ab, name: f.name, vat_number: b.vat_number });
  }
  return result;
}

/**
 * SELECT ab.*, f.name, b.vat_number
 * FROM businesses_admin ab INNER JOIN businesses b USING (id) INNER JOIN financial_entities f USING (id)
 * WHERE ab.id IN $$ids
 */
export const getAdminBusinessesByIds = port<IGetAdminBusinessesByIdsQuery>(
  async ({ ids }, db) =>
    (await joinAdmin(db, await db.whereIn('businesses_admin', 'id', uuidList(ids)))) as never,
);

/**
 * SELECT ab.*, f.name, b.vat_number
 * FROM businesses_admin ab INNER JOIN businesses b USING (id) INNER JOIN financial_entities f USING (id)
 * INNER JOIN financial_entities fe USING (id)
 *
 * The second financial_entities join is on its primary key, so it only repeats the first one's
 * filter.
 */
export const getAllAdminBusinesses = port<IGetAllAdminBusinessesQuery>(
  async (_params, db) => (await joinAdmin(db, await db.rows('businesses_admin'))) as never,
);

/**
 * UPDATE businesses_admin SET
 *   business_registration_start_date = COALESCE($businessRegistrationStartDate, ...),
 *   company_tax_id = COALESCE($companyTaxId, ...), advance_tax_rates = COALESCE($advanceTaxRates, ...),
 *   tax_advances_ids = COALESCE($taxAdvancesIds, ...),
 *   social_security_employer_ids = COALESCE($socialSecurityEmployerIds, ...),
 *   withholding_tax_annual_ids = COALESCE($withholdingTaxAnnualIds, ...)
 * WHERE id = $id RETURNING *
 */
export const updateAdminBusinesses = port<IUpdateAdminBusinessesQuery>(async (params, db) => {
  const patch = pgParams(
    'businesses_admin',
    coalescePatch({
      business_registration_start_date: params.businessRegistrationStartDate,
      company_tax_id: params.companyTaxId,
      advance_tax_rates: params.advanceTaxRates,
      tax_advances_ids: params.taxAdvancesIds,
      social_security_employer_ids: params.socialSecurityEmployerIds,
      withholding_tax_annual_ids: params.withholdingTaxAnnualIds,
    }) as never,
  );
  const id = uuidParam(params.id);
  if (id == null) return [];
  const updated = [];
  for (const ab of await db.where('businesses_admin', { id })) {
    updated.push(await db.update('businesses_admin', ab, patch));
  }
  return updated as never;
});

/** INSERT INTO businesses_admin (id, owner_id) VALUES ($id, $id) ON CONFLICT (id) DO NOTHING */
export const insertAdminBusiness = port<IInsertAdminBusinessQuery>(async ({ id }, db) => {
  await insertRow(
    db,
    'businesses_admin',
    pgParams('businesses_admin', { id: id ?? null, owner_id: id ?? null } as never),
    { target: ['id'], action: 'nothing' },
  );
  return [];
});
