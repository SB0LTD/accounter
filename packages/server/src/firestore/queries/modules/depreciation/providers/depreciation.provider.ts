import { given, numericParam } from '../_helpers.js';
import type {
  IDeleteDepreciationRecordByChargeIdQuery,
  IDeleteDepreciationRecordQuery,
  IGetDepreciationRecordsActivatedByQuery,
  IGetDepreciationRecordsByChargeIdsQuery,
  IGetDepreciationRecordsByDatesQuery,
  IGetDepreciationRecordsByIdsQuery,
  IGetDepreciationRecordsByIdsResult,
  IInsertDepreciationRecordQuery,
  IReplaceDepreciationRecordsChargeIdQuery,
  IUpdateDepreciationRecordQuery,
} from '../../../../../modules/depreciation/__generated__/depreciation.types.js';
import type { Row } from '../../../../catalog.js';
import {
  coalesce,
  num,
  Numeric,
  orderBy,
  sqlEquals,
  toDateString,
} from '../../../../sql-helpers.js';
import { port } from '../../../port.js';

type Depreciation = Row<'depreciation'>;

/** pgTyped types activation_date as TimelessDateString; rows hold the same `YYYY-MM-DD` text. */
const asResults = (rows: readonly Depreciation[]) =>
  rows as readonly IGetDepreciationRecordsByIdsResult[];

/** SELECT d.* FROM depreciation d WHERE d.charge_id IN $$chargeIds */
export const getDepreciationRecordsByChargeIds = port<IGetDepreciationRecordsByChargeIdsQuery>(
  async ({ chargeIds }, db) => asResults(await db.whereIn('depreciation', 'charge_id', chargeIds)),
);

/** SELECT d.* FROM depreciation d WHERE d.id IN $$depreciationRecordIds */
export const getDepreciationRecordsByIds = port<IGetDepreciationRecordsByIdsQuery>(
  async ({ depreciationRecordIds }, db) =>
    asResults(await db.whereIn('depreciation', 'id', depreciationRecordIds)),
);

/**
 * WITH depreciation AS (SELECT d.* FROM depreciation d WHERE activation_date <= $toDate)
 * SELECT d.* FROM depreciation d
 * WHERE COALESCE(d.local_amount, d.amount) IS NULL
 *   OR (d.local_amount IS NULL AND d.currency IS NOT NULL AND d.currency <> $localCurrency)
 *   OR ROUND(COALESCE(d.local_amount, d.amount)) > COALESCE((
 *     SELECT SUM(ROUND(dd.disposed_cost)) FROM depreciation_disposals dd
 *     WHERE dd.depreciation_id = d.id AND dd.disposal_date < $fromDate
 *   ), 0)
 *
 * The OR keeps a row only when one branch is true: a NULL $localCurrency makes the second branch
 * NULL, never true. Disposals the request cannot read (RLS) are not summed, as in Postgres.
 */
export const getDepreciationRecordsByDates = port<IGetDepreciationRecordsByDatesQuery>(
  async ({ fromDate, toDate, localCurrency }, db) => {
    if (toDate == null) return [];
    const to = toDateString(toDate);
    const from = fromDate == null ? null : toDateString(fromDate);

    // SUM(ROUND(disposed_cost)) per asset over disposals before fromDate; no sum is 0
    const disposedBefore = new Map<string, Numeric>();
    if (from != null) {
      for (const disposal of await db.rows('depreciation_disposals')) {
        if (disposal.disposed_cost == null || !(disposal.disposal_date < from)) continue;
        const rounded = num(disposal.disposed_cost).round(0);
        const sum = disposedBefore.get(disposal.depreciation_id);
        disposedBefore.set(disposal.depreciation_id, sum ? sum.add(rounded) : rounded);
      }
    }

    const assets = (await db.rows('depreciation')).filter(d => {
      if (!(d.activation_date <= to)) return false;
      const cost = coalesce(d.local_amount, d.amount);
      if (cost == null) return true;
      if (
        d.local_amount == null &&
        d.currency != null &&
        localCurrency != null &&
        !sqlEquals(d.currency, localCurrency)
      ) {
        return true;
      }
      return num(cost)
        .round(0)
        .gt(disposedBefore.get(d.id) ?? Numeric.ZERO);
    });
    return asResults(assets);
  },
);

/**
 * SELECT d.* FROM depreciation d
 * WHERE d.activation_date <= $date AND d.owner_id = $ownerId
 * ORDER BY d.activation_date, d.id
 */
export const getDepreciationRecordsActivatedBy = port<IGetDepreciationRecordsActivatedByQuery>(
  async ({ date, ownerId }, db) => {
    if (date == null || ownerId == null) return [];
    const until = toDateString(date);
    const rows = (await db.where('depreciation', { owner_id: ownerId })).filter(
      d => d.activation_date <= until,
    );
    return asResults(
      orderBy(rows, [{ value: d => d.activation_date, kind: 'date' }, { value: d => d.id }]),
    );
  },
);

/** UPDATE depreciation SET charge_id = $assertChargeID WHERE charge_id = $replaceChargeID RETURNING id */
export const replaceDepreciationRecordsChargeId = port<IReplaceDepreciationRecordsChargeIdQuery>(
  async ({ assertChargeID, replaceChargeID }, db) => {
    if (replaceChargeID == null) return [];
    const result: { id: string }[] = [];
    for (const row of await db.where('depreciation', { charge_id: replaceChargeID })) {
      await db.update('depreciation', row, { charge_id: (assertChargeID ?? null) as never });
      result.push({ id: row.id });
    }
    return result;
  },
);

/**
 * UPDATE depreciation SET
 *   charge_id = COALESCE($chargeId, charge_id), amount = COALESCE($amount, amount),
 *   currency = COALESCE($currency, currency), activation_date = COALESCE($activationDate, activation_date),
 *   type = COALESCE($type, type), category = COALESCE($categoryId, category),
 *   local_amount = CASE WHEN $clearLocalAmount::boolean THEN NULL ELSE COALESCE($localAmount, local_amount) END,
 *   asset_tax_category_id = CASE WHEN $clearAssetTaxCategoryId::boolean THEN NULL
 *     ELSE COALESCE($assetTaxCategoryId, asset_tax_category_id) END
 * WHERE id = $id
 * RETURNING *
 */
export const updateDepreciationRecord = port<IUpdateDepreciationRecordQuery>(async (params, db) => {
  if (params.id == null) return [];
  const result: Depreciation[] = [];
  for (const row of await db.where('depreciation', { id: params.id })) {
    result.push(
      await db.update('depreciation', row, {
        charge_id: given(params.chargeId) ?? row.charge_id,
        amount: numericParam(params.amount) ?? row.amount,
        currency: given(params.currency) ?? row.currency,
        activation_date: given(params.activationDate) ?? row.activation_date,
        type: given(params.type) ?? row.type,
        category: given(params.categoryId) ?? row.category,
        local_amount:
          params.clearLocalAmount === true
            ? null
            : (numericParam(params.localAmount) ?? row.local_amount),
        asset_tax_category_id:
          params.clearAssetTaxCategoryId === true
            ? null
            : (given(params.assetTaxCategoryId) ?? row.asset_tax_category_id),
      }),
    );
  }
  return asResults(result);
});

/**
 * INSERT INTO depreciation (charge_id, amount, local_amount, currency, activation_date, type,
 *   category, asset_tax_category_id, owner_id)
 * VALUES ($chargeId, $amount, $localAmount, $currency, $activationDate, $type, $categoryId,
 *   $assetTaxCategoryId, $ownerId)
 * RETURNING *
 */
export const insertDepreciationRecord = port<IInsertDepreciationRecordQuery>(async (params, db) => {
  const row = await db.insert('depreciation', {
    charge_id: params.chargeId ?? null,
    amount: numericParam(params.amount),
    local_amount: numericParam(params.localAmount),
    currency: params.currency ?? null,
    activation_date: params.activationDate ?? null,
    type: params.type ?? null,
    category: params.categoryId ?? null,
    asset_tax_category_id: params.assetTaxCategoryId ?? null,
    owner_id: params.ownerId ?? null,
  } as never);
  return row ? asResults([row]) : [];
});

/** DELETE FROM depreciation WHERE id = $depreciationRecordId RETURNING id (disposals cascade) */
export const deleteDepreciationRecord = port<IDeleteDepreciationRecordQuery>(
  async ({ depreciationRecordId }, db) => {
    if (depreciationRecordId == null) return [];
    const result: { id: string }[] = [];
    for (const row of await db.where('depreciation', { id: depreciationRecordId })) {
      await db.delete('depreciation', row);
      result.push({ id: row.id });
    }
    return result;
  },
);

/** DELETE FROM depreciation WHERE charge_id = $chargeId RETURNING id (disposals cascade) */
export const deleteDepreciationRecordByChargeId = port<IDeleteDepreciationRecordByChargeIdQuery>(
  async ({ chargeId }, db) => {
    if (chargeId == null) return [];
    const result: { id: string }[] = [];
    for (const row of await db.where('depreciation', { charge_id: chargeId })) {
      await db.delete('depreciation', row);
      result.push({ id: row.id });
    }
    return result;
  },
);
