import type {
  IGetCryptoCurrenciesBySymbolQuery,
  IGetRateByCurrencyAndDateQuery,
  IInsertRatesQuery,
} from '../../../../../modules/exchange-rates/__generated__/crypto-exchange.types.js';
import { caseFor, type Cases, type Snapshot } from '../../../cases.js';

/** The stored `date` of a fixture rate (a local-time Date, as pg reads `timestamp`). */
const rateDate = (s: Snapshot, symbol: string, index = 0): Date => {
  const rows = s
    .rows('crypto_exchange_rates')
    .filter(row => row.coin_symbol === symbol)
    .sort((a, b) => (a.date as Date).getTime() - (b.date as Date).getTime());
  return (rows[index]?.date as Date | undefined) ?? new Date(2024, 0, 1);
};

export const cases: Cases = {
  getRateByCurrencyAndDate: caseFor<IGetRateByCurrencyAndDateQuery>(s => [
    { currency: 'ETH', date: rateDate(s, 'ETH') },
    { currency: 'GRT', date: rateDate(s, 'GRT') },
    // the same instant as wall-clock text
    { currency: 'ETH', date: '2024-01-02 12:30:00' },
    { currency: 'ETH', date: '2024-01-01' },
    // same date, other coin; no rate at that time
    { currency: 'USDC', date: rateDate(s, 'ETH') },
    { currency: 'ETH', date: new Date(2024, 0, 1, 0, 0, 1) },
    { currency: null, date: rateDate(s, 'ETH') },
    { currency: 'ETH', date: null },
  ]),
  insertRates: caseFor<IInsertRatesQuery>(s => [
    // a new rate
    {
      rates: [
        {
          date: new Date(2024, 1, 1, 9, 0),
          currency: 'ETH',
          value: 2400.123,
          against: 'USD',
          sampleDate: new Date(2024, 1, 1, 8, 59, 30),
        },
      ],
    },
    // an existing (date, coin, against): DO UPDATE SET value
    {
      rates: [
        {
          date: rateDate(s, 'ETH'),
          currency: 'ETH',
          value: '2290.5000',
          against: 'USD',
          sampleDate: new Date(2030, 0, 1),
        },
      ],
    },
    // several rows, a float that needs all 17 digits, and a string date
    {
      rates: [
        {
          date: '2024-03-01 10:15:00',
          currency: 'GRT',
          value: 0.1 + 0.2,
          against: 'USD',
          sampleDate: '2024-03-01 10:14:00',
        },
        {
          date: rateDate(s, 'GRT'),
          currency: 'GRT',
          value: 0.2,
          against: 'USD',
          sampleDate: rateDate(s, 'GRT'),
        },
        {
          date: new Date(2024, 2, 1, 10, 15),
          currency: 'USDC',
          value: 1,
          against: 'ILS',
          sampleDate: new Date(2024, 2, 1, 10, 15),
        },
      ],
    },
    // same date and coin, other currency: violates the (date, coin_symbol) unique key (23505)
    {
      rates: [
        {
          date: rateDate(s, 'ETH'),
          currency: 'ETH',
          value: 1,
          against: 'EUR',
          sampleDate: rateDate(s, 'ETH'),
        },
      ],
    },
    // the same key twice in one statement (21000)
    {
      rates: [
        {
          date: new Date(2024, 4, 1),
          currency: 'ETH',
          value: 1,
          against: 'USD',
          sampleDate: new Date(2024, 4, 1),
        },
        {
          date: new Date(2024, 4, 1),
          currency: 'ETH',
          value: 2,
          against: 'USD',
          sampleDate: new Date(2024, 4, 1),
        },
      ],
    },
    // an explicit NULL never takes the 'USD' default (23502)
    {
      rates: [
        {
          date: new Date(2024, 4, 2),
          currency: 'ETH',
          value: 1,
          against: null,
          sampleDate: new Date(2024, 4, 2),
        },
      ],
    },
    // unknown coin (23503)
    {
      rates: [
        {
          date: new Date(2024, 4, 3),
          currency: 'NOPE',
          value: 1,
          against: 'USD',
          sampleDate: new Date(2024, 4, 3),
        },
      ],
    },
  ]),
  getCryptoCurrenciesBySymbol: caseFor<IGetCryptoCurrenciesBySymbolQuery>(() => [
    { currencySymbols: ['ETH', 'USDC', 'NOPE'] },
    { currencySymbols: ['GRT'] },
    { currencySymbols: ['eth'] },
  ]),
};
