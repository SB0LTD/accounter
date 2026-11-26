import { numericParam, timestampWithoutTimeZone, upsertRow } from '../_helpers.js';
import type {
  IGetCryptoCurrenciesBySymbolQuery,
  IGetRateByCurrencyAndDateQuery,
  IInsertRatesQuery,
} from '../../../../../modules/exchange-rates/__generated__/crypto-exchange.types.js';
import type { Row } from '../../../../catalog.js';
import { port } from '../../../port.js';

/** SELECT * FROM crypto_exchange_rates WHERE coin_symbol = $currency AND date = $date */
export const getRateByCurrencyAndDate = port<IGetRateByCurrencyAndDateQuery>(
  async ({ currency, date }, db) => {
    if (currency == null || date == null) return [];
    return db.where('crypto_exchange_rates', {
      coin_symbol: currency,
      date: timestampWithoutTimeZone(date),
    });
  },
);

/**
 * INSERT INTO crypto_exchange_rates (date, coin_symbol, value, against, sample_date)
 * VALUES $$rates(date, currency, value, against, sampleDate)
 * ON CONFLICT (date, coin_symbol, against) DO UPDATE SET value = EXCLUDED.value
 * RETURNING *
 */
export const insertRates = port<IInsertRatesQuery>(async ({ rates }, db) => {
  const affected = new Set<string>();
  const result: Row<'crypto_exchange_rates'>[] = [];
  for (const rate of rates) {
    const upserted = await upsertRow(
      db,
      'crypto_exchange_rates',
      {
        date: rate.date == null ? null : timestampWithoutTimeZone(rate.date),
        coin_symbol: rate.currency ?? null,
        value: numericParam(rate.value),
        against: rate.against ?? null,
        sample_date: rate.sampleDate == null ? null : timestampWithoutTimeZone(rate.sampleDate),
      } as never,
      ['date', 'coin_symbol', 'against'],
      (_existing, excluded) => ({ value: excluded.value }),
      affected,
    );
    if (upserted) result.push(upserted.row);
  }
  return result;
});

/** SELECT * FROM crypto_currencies WHERE symbol IN $$currencySymbols */
export const getCryptoCurrenciesBySymbol = port<IGetCryptoCurrenciesBySymbolQuery>(
  async ({ currencySymbols }, db) => db.whereIn('crypto_currencies', 'symbol', currencySymbols),
);
