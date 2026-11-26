import type {
  IGetPriceIndexBasesByCodesQuery,
  IGetPriceIndexValuesByCodesQuery,
} from '../../../../../modules/price-indexes/__generated__/price-indexes.types.js';
import type { TimelessDateString } from '../../../../../shared/types/index.js';
import { orderBy } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';

const codes = (indexCodes: readonly (number | null | void)[]) =>
  indexCodes.filter((code): code is number => code != null).map(Number);

/**
 * SELECT index_code, period, value, base_label, chained_value, monthly_change_pct, yearly_change_pct, published_on
 * FROM price_index_values WHERE index_code IN $$indexCodes ORDER BY index_code, period
 */
export const getPriceIndexValuesByCodes = port<IGetPriceIndexValuesByCodesQuery>(
  async ({ indexCodes }, db) => {
    const rows = await db.whereIn('price_index_values', 'index_code', codes(indexCodes));
    return orderBy(rows, [
      { value: row => row.index_code },
      { value: row => row.period, kind: 'date' },
    ]).map(row => ({
      index_code: row.index_code,
      period: row.period as TimelessDateString,
      value: row.value,
      base_label: row.base_label,
      chained_value: row.chained_value,
      monthly_change_pct: row.monthly_change_pct,
      yearly_change_pct: row.yearly_change_pct,
      published_on: row.published_on as TimelessDateString,
    }));
  },
);

/**
 * SELECT index_code, base_label, first_period, chain_coefficient, chained_factor
 * FROM price_index_bases WHERE index_code IN $$indexCodes ORDER BY index_code, first_period
 *
 * Nothing makes first_period unique per index; two bases starting in the same period would be in
 * an undefined order in Postgres too (CBS never publishes such a pair).
 */
export const getPriceIndexBasesByCodes = port<IGetPriceIndexBasesByCodesQuery>(
  async ({ indexCodes }, db) => {
    const rows = await db.whereIn('price_index_bases', 'index_code', codes(indexCodes));
    return orderBy(rows, [
      { value: row => row.index_code },
      { value: row => row.first_period, kind: 'date' },
    ]).map(row => ({
      index_code: row.index_code,
      base_label: row.base_label,
      first_period: row.first_period as TimelessDateString,
      chain_coefficient: row.chain_coefficient,
      chained_factor: row.chained_factor,
    }));
  },
);
