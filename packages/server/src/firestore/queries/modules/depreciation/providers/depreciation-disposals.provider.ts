import { given, numericParam } from '../_helpers.js';
import type {
  IDeleteDepreciationDisposalQuery,
  IGetDepreciationDisposalsByChargeIdsQuery,
  IGetDepreciationDisposalsByDatesQuery,
  IGetDepreciationDisposalsByDepreciationIdsQuery,
  IGetDepreciationDisposalsByIdsQuery,
  IGetDepreciationDisposalsByIdsResult,
  IInsertDepreciationDisposalQuery,
  IReplaceDepreciationDisposalsChargeIdQuery,
  IUpdateDepreciationDisposalQuery,
} from '../../../../../modules/depreciation/__generated__/depreciation-disposals.types.js';
import type { Row } from '../../../../catalog.js';
import { orderBy, toDateString } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';

type Disposal = Row<'depreciation_disposals'>;

/** pgTyped types disposal_date as TimelessDateString; rows hold the same `YYYY-MM-DD` text. */
const asResults = (rows: readonly Disposal[]) =>
  rows as readonly IGetDepreciationDisposalsByIdsResult[];

/** ORDER BY disposal_date, id */
const byDateThenId = (rows: readonly Disposal[]) =>
  asResults(
    orderBy(rows, [{ value: row => row.disposal_date, kind: 'date' }, { value: row => row.id }]),
  );

/** SELECT * FROM depreciation_disposals WHERE id IN $$ids */
export const getDepreciationDisposalsByIds = port<IGetDepreciationDisposalsByIdsQuery>(
  async ({ ids }, db) => asResults(await db.whereIn('depreciation_disposals', 'id', ids)),
);

/** SELECT * FROM depreciation_disposals WHERE depreciation_id IN $$depreciationIds ORDER BY disposal_date, id */
export const getDepreciationDisposalsByDepreciationIds =
  port<IGetDepreciationDisposalsByDepreciationIdsQuery>(async ({ depreciationIds }, db) =>
    byDateThenId(await db.whereIn('depreciation_disposals', 'depreciation_id', depreciationIds)),
  );

/** SELECT * FROM depreciation_disposals WHERE charge_id IN $$chargeIds ORDER BY disposal_date, id */
export const getDepreciationDisposalsByChargeIds = port<IGetDepreciationDisposalsByChargeIdsQuery>(
  async ({ chargeIds }, db) =>
    byDateThenId(await db.whereIn('depreciation_disposals', 'charge_id', chargeIds)),
);

/**
 * SELECT * FROM depreciation_disposals
 * WHERE disposal_date BETWEEN $fromDate AND $toDate
 * ORDER BY disposal_date, id
 */
export const getDepreciationDisposalsByDates = port<IGetDepreciationDisposalsByDatesQuery>(
  async ({ fromDate, toDate }, db) => {
    if (fromDate == null || toDate == null) return [];
    const from = toDateString(fromDate);
    const to = toDateString(toDate);
    return byDateThenId(
      (await db.rows('depreciation_disposals')).filter(
        row => row.disposal_date >= from && row.disposal_date <= to,
      ),
    );
  },
);

/**
 * INSERT INTO depreciation_disposals (owner_id, depreciation_id, charge_id, type, refund_mode,
 *   disposal_date, disposed_cost, original_amount, original_currency, proceeds, description)
 * VALUES ($ownerId, $depreciationId, $chargeId, $type, $refundMode, $disposalDate, $disposedCost,
 *   $originalAmount, $originalCurrency, $proceeds, $description)
 * RETURNING *
 *
 * An explicit NULL proceeds does not take the column's default 0: it violates NOT NULL.
 */
export const insertDepreciationDisposal = port<IInsertDepreciationDisposalQuery>(
  async (params, db) => {
    const row = await db.insert('depreciation_disposals', {
      owner_id: params.ownerId ?? null,
      depreciation_id: params.depreciationId ?? null,
      charge_id: params.chargeId ?? null,
      type: params.type ?? null,
      refund_mode: params.refundMode ?? null,
      disposal_date: params.disposalDate ?? null,
      disposed_cost: numericParam(params.disposedCost),
      original_amount: numericParam(params.originalAmount),
      original_currency: params.originalCurrency ?? null,
      proceeds: numericParam(params.proceeds),
      description: params.description ?? null,
    } as never);
    return row ? asResults([row]) : [];
  },
);

/**
 * UPDATE depreciation_disposals SET
 *   charge_id = CASE WHEN $clearChargeId::boolean THEN NULL ELSE COALESCE($chargeId, charge_id) END,
 *   type = COALESCE($type, type),
 *   refund_mode = $refundMode,
 *   disposal_date = COALESCE($disposalDate, disposal_date),
 *   disposed_cost = $disposedCost,
 *   original_amount = $originalAmount,
 *   original_currency = $originalCurrency,
 *   proceeds = COALESCE($proceeds, proceeds),
 *   description = $description,
 *   updated_at = clock_timestamp()
 * WHERE id = $id
 * RETURNING *
 */
export const updateDepreciationDisposal = port<IUpdateDepreciationDisposalQuery>(
  async (params, db) => {
    if (params.id == null) return [];
    const result: Disposal[] = [];
    for (const row of await db.where('depreciation_disposals', { id: params.id })) {
      result.push(
        await db.update('depreciation_disposals', row, {
          charge_id:
            params.clearChargeId === true ? null : (given(params.chargeId) ?? row.charge_id),
          type: given(params.type) ?? row.type,
          refund_mode: given(params.refundMode),
          disposal_date: given(params.disposalDate) ?? row.disposal_date,
          disposed_cost: numericParam(params.disposedCost),
          original_amount: numericParam(params.originalAmount),
          original_currency: given(params.originalCurrency),
          proceeds: numericParam(params.proceeds) ?? row.proceeds,
          description: given(params.description),
          updated_at: new Date(),
        }),
      );
    }
    return asResults(result);
  },
);

/** DELETE FROM depreciation_disposals WHERE id = $id RETURNING * */
export const deleteDepreciationDisposal = port<IDeleteDepreciationDisposalQuery>(
  async ({ id }, db) => {
    if (id == null) return [];
    const result: Disposal[] = [];
    for (const row of await db.where('depreciation_disposals', { id })) {
      result.push(await db.delete('depreciation_disposals', row));
    }
    return asResults(result);
  },
);

/**
 * UPDATE depreciation_disposals
 * SET charge_id = $assertChargeID, updated_at = clock_timestamp()
 * WHERE charge_id = $replaceChargeID
 * RETURNING id
 */
export const replaceDepreciationDisposalsChargeId =
  port<IReplaceDepreciationDisposalsChargeIdQuery>(
    async ({ assertChargeID, replaceChargeID }, db) => {
      if (replaceChargeID == null) return [];
      const result: { id: string }[] = [];
      for (const row of await db.where('depreciation_disposals', { charge_id: replaceChargeID })) {
        await db.update('depreciation_disposals', row, {
          charge_id: assertChargeID ?? null,
          updated_at: new Date(),
        });
        result.push({ id: row.id });
      }
      return result;
    },
  );
