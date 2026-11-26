import type {
  IGetAllTaxVariablesQuery,
  IGetAllTaxVariablesResult,
} from '../../../../../modules/business-trips/__generated__/business-trips-tax-variables.types.js';
import { orderBy } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';

/** SELECT * FROM business_trips_tax_variables ORDER BY date DESC */
export const getAllTaxVariables = port<IGetAllTaxVariablesQuery>(
  async (_params, db) =>
    orderBy(await db.rows('business_trips_tax_variables'), [
      { value: row => row.date, desc: true, kind: 'date' },
    ]) as IGetAllTaxVariablesResult[],
);
