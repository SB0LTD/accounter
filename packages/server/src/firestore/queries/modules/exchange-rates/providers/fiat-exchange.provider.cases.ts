import type {
  IGetExchangeRatesByDateQuery,
  IGetExchangeRatesByDatesQuery,
} from '../../../../../modules/exchange-rates/__generated__/fiat-exchange.types.js';
import { caseFor, type Cases } from '../../../cases.js';

export const cases: Cases = {
  getExchangeRatesByDate: caseFor<IGetExchangeRatesByDateQuery>(() => [
    { date: '2024-01-03' }, // between rates: the earlier one
    { date: '2024-01-01' }, // exactly on a rate
    { date: '2023-12-31' }, // before the first rate
    { date: '2099-01-01' }, // after the last
    { date: '2024-1-5' }, // to_date's lenient form
    { date: '2024-02-01T10:00:00Z' }, // trailing text ignored
    { date: null },
    { date: '2024-02-30' }, // 22008
    { date: 'not a date' }, // 22007
  ]),
  getExchangeRatesByDates: caseFor<IGetExchangeRatesByDatesQuery>(() => [
    { fromDate: '2024-01-03', toDate: '2024-02-01' },
    { fromDate: '2024-01-01', toDate: '2024-01-01' },
    { fromDate: '2024-02-15', toDate: '2099-12-31' },
    { fromDate: '2023-01-01', toDate: '2024-12-31' }, // no rate on or before fromDate
    { fromDate: '2024-02-01', toDate: '2024-01-01' }, // reversed range
    { fromDate: '2024-01-03', toDate: null },
    { fromDate: null, toDate: '2024-12-31' },
  ]),
};
