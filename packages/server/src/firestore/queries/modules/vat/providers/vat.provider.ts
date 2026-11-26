import type { IGetAllVatValuesQuery } from '../../../../../modules/vat/__generated__/vat.types.js';
import { orderBy } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';
import { asResult } from '../../reports/_helpers.js';

/** SELECT * FROM vat_value ORDER BY date DESC (date is the primary key: no ties) */
export const getAllVatValues = port<IGetAllVatValuesQuery>(async (_params, db) =>
  asResult<IGetAllVatValuesQuery>(
    orderBy(await db.rows('vat_value'), [{ value: r => r.date, desc: true, kind: 'date' }]),
  ),
);
