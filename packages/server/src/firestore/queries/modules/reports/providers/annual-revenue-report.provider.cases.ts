import type { IGetNormalizedRevenueRecordsQuery } from '../../../../../modules/reports/__generated__/annual-revenue-report.types.js';
import { caseFor, type Cases, type Snapshot } from '../../../cases.js';

const category = (s: Snapshot, name: string) =>
  (s.rows('financial_entities').find(r => r.name === name && r.owner_id === s.businessId)?.id as
    string | undefined) ?? s.missingId;

export const cases: Cases = {
  getNormalizedRevenueRecords: caseFor<IGetNormalizedRevenueRecordsQuery>(s => {
    const income = [category(s, 'Service Income'), category(s, 'Income Exchange Rates')];
    const toCollect = category(s, 'Income to Collect');
    return [
      // the whole year: every branch, the UNION duplicate, every currency
      {
        ownerId: s.businessId,
        incomeTaxCategoriesIDs: income,
        incomeToCollectId: toCollect,
        fromDate: '2024-01-01',
        toDate: '2024-12-31',
      },
      // half a year: no closing income to collect on 2024-06-30
      {
        ownerId: s.businessId,
        incomeTaxCategoriesIDs: [income[0]!],
        incomeToCollectId: toCollect,
        fromDate: '2024-01-01',
        toDate: '2024-06-30',
      },
      // a NULL in the category list; no income to collect
      {
        ownerId: s.businessId,
        incomeTaxCategoriesIDs: [income[1]!, null],
        incomeToCollectId: null,
        fromDate: '2024-02-01',
        toDate: '2024-12-31',
      },
      // nothing matches
      {
        ownerId: s.businessId,
        incomeTaxCategoriesIDs: [s.missingId],
        incomeToCollectId: s.missingId,
        fromDate: '2024-01-01',
        toDate: '2024-12-31',
      },
      // another owner
      {
        ownerId: s.missingId,
        incomeTaxCategoriesIDs: income,
        incomeToCollectId: toCollect,
        fromDate: '2024-01-01',
        toDate: '2024-12-31',
      },
      // NULL dates
      {
        ownerId: s.businessId,
        incomeTaxCategoriesIDs: income,
        incomeToCollectId: toCollect,
        fromDate: null,
        toDate: '2024-12-31',
      },
      // a later year: the income to collect of 2024-12-31 opens it
      {
        ownerId: s.businessId,
        incomeTaxCategoriesIDs: income,
        incomeToCollectId: toCollect,
        fromDate: '2024-12-31',
        toDate: '2025-12-31',
      },
    ];
  }),
};
