import type {
  IDeleteCorporateTaxQuery,
  IGetCorporateTaxesByCorporateIdsQuery,
  IInsertCorporateTaxQuery,
  IUpdateCorporateTaxQuery,
} from '../../../../../modules/corporate-taxes/__generated__/corporate-taxes.types.js';
import type { QueryDb } from '../../../../query-db.js';
import { orderBy, toDateString } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';
import { asResult } from '../../reports/_helpers.js';
// pg sends a JS number as String(n), which Postgres parses exactly (not a float8 cast)
import { numericParam } from '../../reports/_params.js';

const dateParam = (value: unknown) => (value == null ? null : toDateString(value));

/** `WHERE corporate_id = $corporateId AND date = $date` */
async function ratesOf(db: QueryDb, corporateId: unknown, date: unknown) {
  if (corporateId == null || date == null) return [];
  return db.where('corporate_tax_variables', {
    corporate_id: corporateId as string,
    date: toDateString(date),
  });
}

/** SELECT * FROM corporate_tax_variables WHERE corporate_id IN $$corporateIds ORDER BY date DESC */
export const getCorporateTaxesByCorporateIds = port<IGetCorporateTaxesByCorporateIdsQuery>(
  async ({ corporateIds }, db) =>
    asResult<IGetCorporateTaxesByCorporateIdsQuery>(
      orderBy(await db.whereIn('corporate_tax_variables', 'corporate_id', corporateIds), [
        { value: r => r.date, desc: true, kind: 'date' },
      ]),
    ),
);

/**
 * UPDATE corporate_tax_variables SET date = COALESCE($date, date),
 *   tax_rate = COALESCE($taxRate, tax_rate), original_tax_rate = COALESCE($originalTaxRate, original_tax_rate)
 * WHERE corporate_id = $corporateId AND date = $originalDate RETURNING *
 */
export const updateCorporateTax = port<IUpdateCorporateTaxQuery>(
  async ({ corporateId, originalDate, date, taxRate, originalTaxRate }, db) => {
    const result = [];
    for (const row of await ratesOf(db, corporateId, originalDate)) {
      result.push(
        await db.update('corporate_tax_variables', row, {
          date: dateParam(date) ?? row.date,
          tax_rate: numericParam(taxRate) ?? row.tax_rate,
          original_tax_rate: numericParam(originalTaxRate) ?? row.original_tax_rate,
        }),
      );
    }
    return asResult<IUpdateCorporateTaxQuery>(result);
  },
);

/**
 * INSERT INTO corporate_tax_variables (corporate_id, date, tax_rate, original_tax_rate, owner_id)
 * VALUES ($corporateId, $date, $taxRate, $originalTaxRate, $ownerId) RETURNING *
 *
 * original_tax_rate is in the column list, so a NULL there is a not-null violation, not the
 * column default.
 */
export const insertCorporateTax = port<IInsertCorporateTaxQuery>(
  async ({ corporateId, date, taxRate, originalTaxRate, ownerId }, db) => {
    const row = await db.insert('corporate_tax_variables', {
      corporate_id: (corporateId ?? null) as never,
      date: dateParam(date) as never,
      tax_rate: numericParam(taxRate) as never,
      original_tax_rate: numericParam(originalTaxRate) as never,
      owner_id: (ownerId ?? null) as never,
    });
    return asResult<IInsertCorporateTaxQuery>(row ? [row] : []);
  },
);

/** DELETE FROM corporate_tax_variables WHERE corporate_id = $corporateId AND date = $date RETURNING * */
export const deleteCorporateTax = port<IDeleteCorporateTaxQuery>(
  async ({ corporateId, date }, db) => {
    const result = [];
    for (const row of await ratesOf(db, corporateId, date)) {
      result.push(await db.delete('corporate_tax_variables', row));
    }
    return asResult<IDeleteCorporateTaxQuery>(result);
  },
);
