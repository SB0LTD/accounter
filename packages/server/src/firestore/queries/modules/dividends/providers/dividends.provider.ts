import type {
  IGetAllDividendsQuery,
  IGetDividendsByBusinessIdsQuery,
  IGetDividendsByChargeIdQuery,
} from '../../../../../modules/dividends/__generated__/dividends.types.js';
import { inList, orderBy } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';
import { asResult } from '../../reports/_helpers.js';

type Dated = { date: string };
const byDateDesc = <T extends Dated>(rows: readonly T[]) =>
  orderBy(rows, [{ value: r => r.date, desc: true, kind: 'date' }]);

/** SELECT * FROM dividends ORDER BY date DESC */
export const getAllDividends = port<IGetAllDividendsQuery>(async (_params, db) =>
  asResult<IGetAllDividendsQuery>(byDateDesc(await db.rows('dividends'))),
);

/**
 * SELECT d.*, t.charge_id FROM dividends d LEFT JOIN transactions t ON d.transaction_id = t.id
 * WHERE t.charge_id IN $$chargeIds ORDER BY date DESC
 *
 * The WHERE on t makes the LEFT JOIN an inner one.
 */
export const getDividendsByChargeId = port<IGetDividendsByChargeIdQuery>(
  async ({ chargeIds }, db) => {
    const inCharges = inList(chargeIds);
    const transactions = (await db.whereIn('transactions', 'charge_id', chargeIds)).filter(t =>
      inCharges(t.charge_id),
    );
    const chargeOf = new Map(transactions.map(t => [t.id, t.charge_id]));
    const rows = (await db.rows('dividends'))
      .filter(d => d.transaction_id != null && chargeOf.has(d.transaction_id))
      .map(d => ({ ...d, charge_id: chargeOf.get(d.transaction_id!)! }));
    return asResult<IGetDividendsByChargeIdQuery>(byDateDesc(rows));
  },
);

/** SELECT * FROM dividends WHERE business_id IN $$businessIds ORDER BY date DESC */
export const getDividendsByBusinessIds = port<IGetDividendsByBusinessIdsQuery>(
  async ({ businessIds }, db) =>
    asResult<IGetDividendsByBusinessIdsQuery>(
      byDateDesc(await db.whereIn('dividends', 'business_id', businessIds)),
    ),
);
