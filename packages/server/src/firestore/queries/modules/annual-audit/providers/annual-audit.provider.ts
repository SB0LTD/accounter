import type {
  IGetBalanceChargeQuery,
  IGetStepStatusesQuery,
  IGetStepStatusQuery,
  IRemoveWorkingTemplateQuery,
  IRenameWorkingTemplateQuery,
  IResetStep09ForTemplateQuery,
  IUpsertStep05EvidenceQuery,
  IUpsertStep09StatusQuery,
  IUpsertStepStatusQuery,
} from '../../../../../modules/annual-audit/__generated__/annual-audit.types.js';
import type { Row } from '../../../../catalog.js';
import { DbError } from '../../../../errors.js';
import type { QueryDb } from '../../../../query-db.js';
import { containsInsensitive, maxOf, minOf, sqlEquals } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';
import {
  jsonbConcat,
  jsonbDeleteKeys,
  jsonbEquals,
  jsonbGetText,
  jsonbParam,
  type Json,
} from '../../reports/_jsonb.js';
import { intParam } from '../../reports/_params.js';

type StepStatus = Row<'annual_audit_step_status'>;

/** The columns these statements select and return. */
const project = (r: StepStatus) => ({
  owner_id: r.owner_id,
  year: r.year,
  step_id: r.step_id,
  status: r.status,
  notes: r.notes,
  evidence_json: r.evidence_json as Json | null,
  updated_at: r.updated_at,
  completed_at: r.completed_at,
});

/** A stored jsonb column: NULL is SQL NULL (`undefined` to the jsonb helpers). */
const stored = (value: unknown): Json | undefined =>
  value === null || value === undefined ? undefined : (value as Json);

/** `owner_id = $ownerId AND year = $year`, every year when `year` is undefined. */
async function statusesOf(db: QueryDb, ownerId: unknown, year?: number | null) {
  if (ownerId == null || year === null) return [];
  const rows = await db.where('annual_audit_step_status', { owner_id: ownerId as string });
  return year === undefined ? rows : rows.filter(r => sqlEquals(r.year, year));
}

/**
 * SELECT owner_id, year, step_id, status, notes, evidence_json, updated_at, completed_at
 * FROM annual_audit_step_status WHERE owner_id = $ownerId AND year = $year
 */
export const getStepStatuses = port<IGetStepStatusesQuery>(async ({ ownerId, year }, db) =>
  (await statusesOf(db, ownerId, intParam(year, 'smallint'))).map(project),
);

/** ... WHERE owner_id = $ownerId AND year = $year AND step_id = $stepId */
export const getStepStatus = port<IGetStepStatusQuery>(async ({ ownerId, year, stepId }, db) =>
  (await statusesOf(db, ownerId, intParam(year, 'smallint')))
    .filter(r => sqlEquals(r.step_id, stepId))
    .map(project),
);

/**
 * INSERT INTO annual_audit_step_status (owner_id, year, step_id, status, notes, completed_at)
 * VALUES ($ownerId, $year, $stepId, $status, $notes,
 *         CASE WHEN $status = 'COMPLETED' THEN now() ELSE NULL END)
 * ON CONFLICT (owner_id, year, step_id) DO UPDATE
 *   SET status = EXCLUDED.status, notes = EXCLUDED.notes,
 *       completed_at = CASE
 *         WHEN EXCLUDED.status = 'COMPLETED' AND annual_audit_step_status.completed_at IS NULL THEN now()
 *         WHEN EXCLUDED.status != 'COMPLETED' THEN NULL
 *         ELSE annual_audit_step_status.completed_at END
 * RETURNING owner_id, year, step_id, status, notes, evidence_json, updated_at, completed_at
 */
export const upsertStepStatus = port<IUpsertStepStatusQuery>(
  async ({ ownerId, year, stepId, status, notes }, db) => {
    const now = db.ctx.now;
    const row = await db.insert(
      'annual_audit_step_status',
      {
        owner_id: (ownerId ?? null) as never,
        year: intParam(year, 'smallint') as never,
        step_id: (stepId ?? null) as never,
        status: (status ?? null) as never,
        notes: notes ?? null,
        completed_at: status === 'COMPLETED' ? now : null,
      },
      {
        target: ['owner_id', 'year', 'step_id'],
        action: (existing, excluded) => ({
          status: excluded.status,
          notes: excluded.notes,
          completed_at:
            excluded.status === 'COMPLETED' && existing.completed_at == null
              ? now
              : excluded.status != null && excluded.status !== 'COMPLETED'
                ? null
                : existing.completed_at,
        }),
      },
    );
    return row ? [project(row)] : [];
  },
);

/**
 * INSERT INTO annual_audit_step_status (owner_id, year, step_id, status, notes, evidence_json, completed_at)
 * VALUES ($ownerId, $year, '9', $status, NULL, $evidenceJson::jsonb,
 *         CASE WHEN $status = 'COMPLETED' THEN now() ELSE NULL END)
 * ON CONFLICT (owner_id, year, step_id) DO UPDATE
 *   SET status = EXCLUDED.status, notes = EXCLUDED.notes, evidence_json = EXCLUDED.evidence_json,
 *       completed_at = CASE WHEN EXCLUDED.status = 'COMPLETED'
 *         THEN COALESCE(annual_audit_step_status.completed_at, now()) ELSE NULL END
 * RETURNING owner_id, year, step_id, status, notes, evidence_json, updated_at, completed_at
 */
export const upsertStep09Status = port<IUpsertStep09StatusQuery>(
  async ({ ownerId, year, status, evidenceJson }, db) => {
    const now = db.ctx.now;
    const evidence = jsonbParam(evidenceJson) ?? null;
    const row = await db.insert(
      'annual_audit_step_status',
      {
        owner_id: (ownerId ?? null) as never,
        year: intParam(year, 'smallint') as never,
        step_id: '9',
        status: (status ?? null) as never,
        notes: null,
        evidence_json: evidence as never,
        completed_at: status === 'COMPLETED' ? now : null,
      },
      {
        target: ['owner_id', 'year', 'step_id'],
        action: (existing, excluded) => ({
          status: excluded.status,
          notes: excluded.notes,
          evidence_json: excluded.evidence_json,
          completed_at: excluded.status === 'COMPLETED' ? (existing.completed_at ?? now) : null,
        }),
      },
    );
    return row ? [project(row)] : [];
  },
);

/** The step's evidence keys that may name a template. */
const matchesTemplateKey = (evidence: unknown, keys: readonly string[], templateName: unknown) =>
  templateName != null &&
  keys.some(key => jsonbGetText(evidence as Json, key) === String(templateName));

/**
 * `SELECT COALESCE(jsonb_object_agg(e.key, e.value), '{}') FROM jsonb_each(evidence) e
 *  WHERE e.value <> to_jsonb($templateName::text)`: the evidence without the entries naming the
 * template. (Only objects reach it: the callers' WHERE needs a key to match.)
 */
function withoutTemplate(evidence: Json, templateName: string): { [key: string]: Json } {
  if (evidence === null || typeof evidence !== 'object' || Array.isArray(evidence)) {
    throw new DbError('cannot call jsonb_each on a non-object', '22023');
  }
  return Object.fromEntries(
    Object.entries(evidence).filter(([, value]) => !jsonbEquals(value, templateName)),
  );
}

const STEP_09_KEYS = [
  'lockedTemplateName',
  'balanceSheetTemplateName',
  'profitAndLossTemplateName',
];
const STEP_05_KEYS = ['balanceSheetTemplateName', 'profitAndLossTemplateName'];

/**
 * UPDATE annual_audit_step_status
 * SET (evidence_json, status) = (
 *       SELECT remaining.evidence,
 *              CASE WHEN remaining.evidence = '{}'::jsonb THEN 'PENDING' ELSE 'IN_PROGRESS' END
 *       FROM (SELECT COALESCE(jsonb_object_agg(e.key, e.value), '{}'::jsonb) AS evidence
 *             FROM jsonb_each(evidence_json) AS e
 *             WHERE e.value <> to_jsonb($templateName::text)) AS remaining),
 *     completed_at = NULL
 * WHERE owner_id = $ownerId AND step_id = '9'
 *   AND (evidence_json->>'lockedTemplateName' = $templateName
 *     OR evidence_json->>'balanceSheetTemplateName' = $templateName
 *     OR evidence_json->>'profitAndLossTemplateName' = $templateName)
 */
export const resetStep09ForTemplate = port<IResetStep09ForTemplateQuery>(
  async ({ ownerId, templateName }, db) => {
    for (const row of await statusesOf(db, ownerId)) {
      if (row.step_id !== '9') continue;
      if (!matchesTemplateKey(row.evidence_json, STEP_09_KEYS, templateName)) continue;
      const remaining = withoutTemplate(row.evidence_json as Json, String(templateName));
      await db.update('annual_audit_step_status', row, {
        evidence_json: remaining as never,
        status: Object.keys(remaining).length === 0 ? 'PENDING' : 'IN_PROGRESS',
        completed_at: null,
      });
    }
    return [];
  },
);

/**
 * INSERT INTO annual_audit_step_status (owner_id, year, step_id, status, evidence_json)
 * VALUES ($ownerId, $year, '5', 'PENDING', $patch::jsonb)
 * ON CONFLICT (owner_id, year, step_id) DO UPDATE
 *   SET evidence_json = (COALESCE(annual_audit_step_status.evidence_json, '{}'::jsonb)
 *                        - $removedKeys::text[]) || EXCLUDED.evidence_json
 * RETURNING owner_id, year, step_id, status, notes, evidence_json, updated_at, completed_at
 *
 * A NULL $removedKeys or $patch makes the whole expression (and so evidence_json) NULL.
 */
export const upsertStep05Evidence = port<IUpsertStep05EvidenceQuery>(
  async ({ ownerId, year, patch, removedKeys }, db) => {
    const patchValue = jsonbParam(patch);
    const row = await db.insert(
      'annual_audit_step_status',
      {
        owner_id: (ownerId ?? null) as never,
        year: intParam(year, 'smallint') as never,
        step_id: '5',
        status: 'PENDING',
        evidence_json: (patchValue ?? null) as never,
      },
      {
        target: ['owner_id', 'year', 'step_id'],
        action: existing => {
          const kept = jsonbDeleteKeys(stored(existing.evidence_json) ?? {}, removedKeys);
          return { evidence_json: (jsonbConcat(kept, patchValue) ?? null) as never };
        },
      },
    );
    return row ? [project(row)] : [];
  },
);

/**
 * UPDATE annual_audit_step_status
 * SET evidence_json = (
 *   SELECT jsonb_object_agg(e.key, CASE WHEN e.value = to_jsonb($prevName::text)
 *                                       THEN to_jsonb($newName::text) ELSE e.value END)
 *   FROM jsonb_each(evidence_json) AS e)
 * WHERE owner_id = $ownerId AND step_id = '5'
 *   AND (evidence_json->>'balanceSheetTemplateName' = $prevName
 *     OR evidence_json->>'profitAndLossTemplateName' = $prevName)
 *
 * A NULL $newName gives the renamed entries a JSON null (to_jsonb(NULL) is NULL, which
 * jsonb_object_agg stores as null).
 */
export const renameWorkingTemplate = port<IRenameWorkingTemplateQuery>(
  async ({ ownerId, prevName, newName }, db) => {
    for (const row of await statusesOf(db, ownerId)) {
      if (row.step_id !== '5') continue;
      if (!matchesTemplateKey(row.evidence_json, STEP_05_KEYS, prevName)) continue;
      const evidence = row.evidence_json as { [key: string]: Json };
      const renamed = Object.fromEntries(
        Object.entries(evidence).map(([key, value]) => [
          key,
          jsonbEquals(value, String(prevName)) ? (newName ?? null) : value,
        ]),
      );
      await db.update('annual_audit_step_status', row, { evidence_json: renamed as never });
    }
    return [];
  },
);

/**
 * UPDATE annual_audit_step_status
 * SET evidence_json = (SELECT COALESCE(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
 *                      FROM jsonb_each(evidence_json) AS e
 *                      WHERE e.value <> to_jsonb($templateName::text))
 * WHERE owner_id = $ownerId AND step_id = '5'
 *   AND (evidence_json->>'balanceSheetTemplateName' = $templateName
 *     OR evidence_json->>'profitAndLossTemplateName' = $templateName)
 */
export const removeWorkingTemplate = port<IRemoveWorkingTemplateQuery>(
  async ({ ownerId, templateName }, db) => {
    for (const row of await statusesOf(db, ownerId)) {
      if (row.step_id !== '5') continue;
      if (!matchesTemplateKey(row.evidence_json, STEP_05_KEYS, templateName)) continue;
      await db.update('annual_audit_step_status', row, {
        evidence_json: withoutTemplate(row.evidence_json as Json, String(templateName)) as never,
      });
    }
    return [];
  },
);

/**
 * WITH ledger_by_charge AS (
 *   SELECT count(DISTINCT x.id) AS ledger_count, array_remove(array_agg(DISTINCT
 *     x.financial_entity), NULL) AS ledger_financial_entities, min(x.value_date) AS min_value_date,
 *     max(x.value_date) AS max_value_date, min(x.invoice_date), max(x.invoice_date), x.charge_id
 *   FROM (SELECT lr.charge_id, lr.id, lr.value_date, lr.invoice_date,
 *           unnest(ARRAY[lr.credit_entity1, lr.credit_entity2, lr.debit_entity1, lr.debit_entity2])
 *           AS financial_entity
 *         FROM ledger_records lr WHERE lr.charge_id IS NOT NULL AND lr.owner_id = $ownerId) x
 *   GROUP BY x.charge_id)
 * SELECT c.id FROM charges c LEFT JOIN ledger_by_charge l ON l.charge_id = c.id
 * WHERE c.owner_id = $ownerId AND type = 'FINANCIAL'
 *   AND l.min_value_date <= make_date($year, 12, 31) AND l.max_value_date >= make_date($year, 12, 31)
 *   AND user_description ILIKE '%balance%'
 *
 * Only the value-date bounds reach the result, so only they are computed. No ORDER BY.
 */
export const getBalanceCharge = port<IGetBalanceChargeQuery>(async ({ ownerId, year }, db) => {
  const y = intParam(year, 'integer');
  if (ownerId == null || y == null) return [];
  if (y === 0) throw new DbError('date field value out of range: 0-12-31', '22008');
  // make_date of a BC year, or of one past 9999, is before / after every stored date
  if (y < 0 || y > 9999) return [];
  const yearEnd = `${String(y).padStart(4, '0')}-12-31`;

  const valueDates = new Map<string, string[]>();
  for (const lr of await db.where('ledger_records', { owner_id: ownerId })) {
    if (lr.charge_id == null || !sqlEquals(lr.owner_id, ownerId)) continue;
    const list = valueDates.get(lr.charge_id);
    if (list) list.push(lr.value_date);
    else valueDates.set(lr.charge_id, [lr.value_date]);
  }

  const result: { id: string }[] = [];
  for (const c of await db.where('charges', { owner_id: ownerId })) {
    if (!sqlEquals(c.owner_id, ownerId) || c.type !== 'FINANCIAL') continue;
    if (!containsInsensitive(c.user_description, 'balance')) continue;
    const dates = valueDates.get(c.id);
    if (!dates) continue;
    const min = minOf(dates, 'date');
    const max = maxOf(dates, 'date');
    if (min != null && max != null && min <= yearEnd && max >= yearEnd) result.push({ id: c.id });
  }
  return result;
});
