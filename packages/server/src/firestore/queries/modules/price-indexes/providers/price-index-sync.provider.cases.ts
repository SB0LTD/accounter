import type {
  IGetLatestPriceIndexPeriodQuery,
  IGetPriceIndexBasesForSyncQuery,
  IUpsertPriceIndexBasesQuery,
  IUpsertPriceIndexValuesParams,
  IUpsertPriceIndexValuesQuery,
} from '../../../../../modules/price-indexes/__generated__/price-index-sync.types.js';
import type { TimelessDateString } from '../../../../../shared/types/index.js';
import { caseFor, type Cases } from '../../../cases.js';

const CPI = 120_010;

const base = (
  baseLabel: string,
  firstPeriod: TimelessDateString | null,
  chainCoefficient: number | string | null,
  chainedFactor: number | string | null,
  indexCode: number = CPI,
) => ({ indexCode, baseLabel, firstPeriod, chainCoefficient, chainedFactor });

const value = (
  period: TimelessDateString,
  overrides: Partial<{
    indexCode: number;
    value: number | string | null;
    baseLabel: string;
    chainedValue: number | string | null;
    monthlyChangePct: number | string | null;
    yearlyChangePct: number | string | null;
    publishedOn: TimelessDateString | null;
  }> = {},
): IUpsertPriceIndexValuesParams['values'][number] => ({
  indexCode: CPI,
  period,
  value: 100.4,
  baseLabel: 'Average 2022',
  chainedValue: 109.183594,
  monthlyChangePct: 0.4,
  yearlyChangePct: null,
  publishedOn: '2023-03-15',
  ...overrides,
});

export const cases: Cases = {
  getLatestPriceIndexPeriod: caseFor<IGetLatestPriceIndexPeriodQuery>(() => [
    { indexCode: CPI },
    { indexCode: 120_020 },
    { indexCode: 999 }, // no values: one row, NULL
  ]),
  getPriceIndexBasesForSync: caseFor<IGetPriceIndexBasesForSyncQuery>(() => [
    { indexCode: CPI },
    { indexCode: 999 },
  ]),
  upsertPriceIndexBases: caseFor<IUpsertPriceIndexBasesQuery>(() => [
    // new base
    { bases: [base('Average 2024', '2025-01-01', 1.029, '1.119023094')] },
    // unchanged (same values, other scale): skipped
    { bases: [base('Average 2020', '2021-01-01', '1.0060', 1.006)] },
    // NULL coefficient stays NULL: skipped; a coefficient appears: updated
    { bases: [base('Average 2018', '2019-01-01', null, 1)] },
    { bases: [base('Average 2018', '2019-01-01', 1.5, 1)] },
    // an earlier first period wins; a later one keeps the stored one while the factor changes
    { bases: [base('Average 2020', '2020-12-01', 1.006, 1.006)] },
    { bases: [base('Average 2020', '2021-06-01', 1.006, 1.0061)] },
    // several rows: new, updated, skipped, another index
    {
      bases: [
        base('Average 2026', '2027-01-01', 1.01, 1.2),
        base('Average 2022', '2023-01-01', 1.081, 1.087487),
        base('Average 2020', '2021-01-01', 1.006, 1.006),
        base('Average 2022', '2023-01-01', 2, 1, 120_020),
      ],
    },
    // the same existing key twice, both skipped: no error
    {
      bases: [
        base('Average 2020', '2021-01-01', 1.006, 1.006),
        base('Average 2020', '2021-01-01', 1.006, 1.006),
      ],
    },
    // a key the statement inserted, then again (21000)
    {
      bases: [
        base('Average 2028', '2029-01-01', 1.01, 1.3),
        base('Average 2028', '2029-01-01', 1.01, 1.3),
      ],
    },
    // a key the statement updated, then again (21000)
    {
      bases: [
        base('Average 2022', '2023-01-01', 1.08, 1.08),
        base('Average 2022', '2023-01-01', 1.07, 1.07),
      ],
    },
    // not the first of a month (23514), missing factor (23502), also on an existing key
    { bases: [base('Average 2030', '2031-01-15', 1, 1)] },
    { bases: [base('Average 2030', '2031-01-01', 1, null)] },
    { bases: [base('Average 2020', '2021-01-01', 1.006, null)] },
  ]),
  upsertPriceIndexValues: caseFor<IUpsertPriceIndexValuesQuery>(() => [
    // new period
    {
      values: [
        value('2023-03-01', { value: 101.1, chainedValue: '109.944834', monthlyChangePct: 0.7 }),
      ],
    },
    // unchanged (NULL yearly on both sides): skipped
    { values: [value('2023-02-01', { value: '100.40', publishedOn: '2030-01-01' })] },
    // a revised value: updated (published_on kept)
    { values: [value('2023-02-01', { value: 100.5, publishedOn: '2030-01-01' })] },
    // only the NULL-able change columns differ
    { values: [value('2023-02-01', { yearlyChangePct: 4.9 })] },
    {
      values: [
        value('2023-01-01', {
          value: 100.0,
          chainedValue: 108.7486,
          monthlyChangePct: null,
          yearlyChangePct: 5.4,
        }),
      ],
    },
    // several rows across indexes
    {
      values: [
        value('2023-04-01', { value: 101.3 }),
        value('2023-01-01', {
          indexCode: 120_020,
          value: 100,
          chainedValue: 100,
          monthlyChangePct: 0.1,
        }),
        value('2022-12-01', {
          value: 105.2,
          baseLabel: 'Average 2020',
          chainedValue: 105.8312,
          monthlyChangePct: -0.1,
          yearlyChangePct: 5.3,
        }),
      ],
    },
    // the same new period twice (21000)
    { values: [value('2023-05-01'), value('2023-05-01', { value: 1 })] },
    // unknown base, on insert and on update (23503)
    { values: [value('2023-06-01', { baseLabel: 'Average 1999' })] },
    { values: [value('2023-02-01', { baseLabel: 'Average 1999' })] },
    // not the first of a month (23514); NULL value (23502)
    { values: [value('2023-06-15')] },
    { values: [value('2023-06-01', { value: null })] },
  ]),
};
