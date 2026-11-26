import type {
  IGetLatestPriceIndexPeriodQuery,
  IGetPriceIndexBasesForSyncQuery,
  ITryLockPriceIndexSyncQuery,
  IUpsertPriceIndexBasesQuery,
  IUpsertPriceIndexValuesQuery,
} from '../../../../../modules/price-indexes/__generated__/price-index-sync.types.js';
import type { TimelessDateString } from '../../../../../shared/types/index.js';
import { maxOf, notDistinct, num, sqlEquals } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';
// The generic ON CONFLICT DO UPDATE ... WHERE emulation lives with the exchange-rates ports.
import { numericParam, upsertRow } from '../../exchange-rates/_helpers.js';

/**
 * SELECT pg_try_advisory_xact_lock(hashtext('accounter.price_index_sync')) AS locked
 *
 * Firestore has no advisory locks. The lock only keeps two sync runs from writing at once; the
 * upserts are idempotent, the store runs on one instance, and its commits are preconditioned on
 * the versions they read, so a concurrent run fails its commit instead of losing data. The lock is
 * therefore always granted, as Postgres grants it when no other session holds it.
 */
export const tryLockPriceIndexSync = port<ITryLockPriceIndexSyncQuery>(async () => [
  { locked: true },
]);

/** SELECT max(period) AS latest_period FROM price_index_values WHERE index_code = $indexCode! */
export const getLatestPriceIndexPeriod = port<IGetLatestPriceIndexPeriodQuery>(
  async ({ indexCode }, db) => {
    const rows =
      indexCode == null
        ? []
        : await db.where('price_index_values', { index_code: Number(indexCode) });
    const latest = maxOf(
      rows.map(row => row.period),
      'date',
    );
    return [{ latest_period: latest as TimelessDateString | null }];
  },
);

/**
 * SELECT base_label, first_period, chain_coefficient, chained_factor
 * FROM price_index_bases WHERE index_code = $indexCode!
 */
export const getPriceIndexBasesForSync = port<IGetPriceIndexBasesForSyncQuery>(
  async ({ indexCode }, db) => {
    if (indexCode == null) return [];
    return (await db.where('price_index_bases', { index_code: Number(indexCode) })).map(row => ({
      base_label: row.base_label,
      first_period: row.first_period as TimelessDateString,
      chain_coefficient: row.chain_coefficient,
      chained_factor: row.chained_factor,
    }));
  },
);

/**
 * INSERT INTO price_index_bases (index_code, base_label, first_period, chain_coefficient, chained_factor)
 * VALUES $$bases(indexCode, baseLabel, firstPeriod, chainCoefficient, chainedFactor)
 * ON CONFLICT (index_code, base_label) DO UPDATE SET
 *   first_period = LEAST(price_index_bases.first_period, EXCLUDED.first_period),
 *   chain_coefficient = EXCLUDED.chain_coefficient,
 *   chained_factor = EXCLUDED.chained_factor
 * WHERE price_index_bases.first_period > EXCLUDED.first_period
 *   OR price_index_bases.chain_coefficient IS DISTINCT FROM EXCLUDED.chain_coefficient
 *   OR price_index_bases.chained_factor <> EXCLUDED.chained_factor
 * RETURNING base_label, (xmax = 0) AS inserted
 */
export const upsertPriceIndexBases = port<IUpsertPriceIndexBasesQuery>(async ({ bases }, db) => {
  const affected = new Set<string>();
  const result: { base_label: string; inserted: boolean }[] = [];
  for (const base of bases) {
    const upserted = await upsertRow(
      db,
      'price_index_bases',
      {
        index_code: base.indexCode ?? null,
        base_label: base.baseLabel ?? null,
        first_period: base.firstPeriod ?? null,
        chain_coefficient: numericParam(base.chainCoefficient),
        chained_factor: numericParam(base.chainedFactor),
      } as never,
      ['index_code', 'base_label'],
      (existing, excluded) => {
        // Both NOT NULL columns are set on both sides here (the proposed row was validated).
        const changed =
          existing.first_period > excluded.first_period ||
          !notDistinct(existing.chain_coefficient, excluded.chain_coefficient, 'decimal') ||
          !num(existing.chained_factor).eq(excluded.chained_factor);
        if (!changed) return null;
        return {
          first_period:
            existing.first_period <= excluded.first_period
              ? existing.first_period
              : excluded.first_period,
          chain_coefficient: excluded.chain_coefficient,
          chained_factor: excluded.chained_factor,
        };
      },
      affected,
    );
    if (upserted) result.push({ base_label: upserted.row.base_label, inserted: upserted.inserted });
  }
  return result;
});

/**
 * INSERT INTO price_index_values
 *   (index_code, period, value, base_label, chained_value, monthly_change_pct, yearly_change_pct, published_on)
 * VALUES $$values(indexCode, period, value, baseLabel, chainedValue, monthlyChangePct, yearlyChangePct, publishedOn)
 * ON CONFLICT (index_code, period) DO UPDATE SET
 *   value = EXCLUDED.value, base_label = EXCLUDED.base_label, chained_value = EXCLUDED.chained_value,
 *   monthly_change_pct = EXCLUDED.monthly_change_pct, yearly_change_pct = EXCLUDED.yearly_change_pct,
 *   updated_at = now()
 * WHERE price_index_values.value <> EXCLUDED.value
 *   OR price_index_values.base_label <> EXCLUDED.base_label
 *   OR price_index_values.chained_value <> EXCLUDED.chained_value
 *   OR price_index_values.monthly_change_pct IS DISTINCT FROM EXCLUDED.monthly_change_pct
 *   OR price_index_values.yearly_change_pct IS DISTINCT FROM EXCLUDED.yearly_change_pct
 * RETURNING period, (xmax = 0) AS inserted
 *
 * published_on is never overwritten.
 */
export const upsertPriceIndexValues = port<IUpsertPriceIndexValuesQuery>(async ({ values }, db) => {
  const affected = new Set<string>();
  const result: { period: TimelessDateString; inserted: boolean }[] = [];
  for (const value of values) {
    const upserted = await upsertRow(
      db,
      'price_index_values',
      {
        index_code: value.indexCode ?? null,
        period: value.period ?? null,
        value: numericParam(value.value),
        base_label: value.baseLabel ?? null,
        chained_value: numericParam(value.chainedValue),
        monthly_change_pct: numericParam(value.monthlyChangePct),
        yearly_change_pct: numericParam(value.yearlyChangePct),
        published_on: value.publishedOn ?? null,
      } as never,
      ['index_code', 'period'],
      (existing, excluded) => {
        const changed =
          !num(existing.value).eq(excluded.value) ||
          !sqlEquals(existing.base_label, excluded.base_label) ||
          !num(existing.chained_value).eq(excluded.chained_value) ||
          !notDistinct(existing.monthly_change_pct, excluded.monthly_change_pct, 'decimal') ||
          !notDistinct(existing.yearly_change_pct, excluded.yearly_change_pct, 'decimal');
        if (!changed) return null;
        return {
          value: excluded.value,
          base_label: excluded.base_label,
          chained_value: excluded.chained_value,
          monthly_change_pct: excluded.monthly_change_pct,
          yearly_change_pct: excluded.yearly_change_pct,
          updated_at: new Date(db.ctx.now.getTime()),
        };
      },
      affected,
    );
    if (upserted) {
      result.push({
        period: upserted.row.period as TimelessDateString,
        inserted: upserted.inserted,
      });
    }
  }
  return result;
});
