import { asResult } from '../_helpers.js';
import type {
  IGetReportByBusinessIdAndDatesQuery,
  IInsertReportQuery,
  IUpdateReportQuery,
} from '../../../../../modules/reports/__generated__/vat-report.types.js';
import { inList, toDateString } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';

/** SELECT * FROM pcn874 WHERE business_id = $businessId AND month_date IN $$monthDates */
export const getReportByBusinessIdAndDates = port<IGetReportByBusinessIdAndDatesQuery>(
  async ({ businessId, monthDates }, db) => {
    if (businessId == null) return [];
    const inMonths = inList(monthDates.map(d => (d == null ? null : toDateString(d))));
    return asResult<IGetReportByBusinessIdAndDatesQuery>(
      (await db.where('pcn874', { business_id: businessId })).filter(r => inMonths(r.month_date)),
    );
  },
);

/**
 * UPDATE pcn874 SET content = $content WHERE business_id = $businessId AND month_date = $monthDate
 * RETURNING *
 */
export const updateReport = port<IUpdateReportQuery>(
  async ({ businessId, monthDate, content }, db) => {
    if (businessId == null || monthDate == null) return [];
    const result = [];
    for (const row of await db.where('pcn874', {
      business_id: businessId,
      month_date: toDateString(monthDate),
    })) {
      result.push(await db.update('pcn874', row, { content: (content ?? null) as never }));
    }
    return asResult<IUpdateReportQuery>(result);
  },
);

/**
 * INSERT INTO pcn874 (business_id, month_date, content, owner_id)
 * VALUES ($businessId, $monthDate, $content, $ownerId) RETURNING *
 */
export const insertReport = port<IInsertReportQuery>(
  async ({ businessId, monthDate, content, ownerId }, db) => {
    const row = await db.insert('pcn874', {
      business_id: (businessId ?? null) as never,
      month_date: (monthDate == null ? null : toDateString(monthDate)) as never,
      content: (content ?? null) as never,
      owner_id: (ownerId ?? null) as never,
    });
    return asResult<IInsertReportQuery>(row ? [row] : []);
  },
);
