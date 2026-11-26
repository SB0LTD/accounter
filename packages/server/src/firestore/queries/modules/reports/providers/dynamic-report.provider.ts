import { asResult, uuidOrder } from '../_helpers.js';
import { jsonbParam } from '../_jsonb.js';
import type {
  IDeleteTemplateQuery,
  IGetLatestComparableSnapshotQuery,
  IGetSnapshotByIdQuery,
  IGetSnapshotsMetaByOwnerIdsQuery,
  IGetTemplateQuery,
  IGetTemplatesByOwnerIdsQuery,
  IInsertSnapshotQuery,
  IInsertTemplateQuery,
  ILockTemplateForSnapshotQuery,
  ILockTemplateQuery,
  IUnlockTemplateQuery,
  IUpdateTemplateNameQuery,
  IUpdateTemplateQuery,
} from '../../../../../modules/reports/__generated__/dynamic-report.types.js';
import type { Row } from '../../../../catalog.js';
import type { QueryDb } from '../../../../query-db.js';
import { coalesce, orderBy, sqlEquals, toDateString } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';

type Template = Row<'dynamic_report_templates'>;

const dateParam = (value: unknown) => (value == null ? null : toDateString(value));

/** `WHERE name = $name AND owner_id = $ownerId` on dynamic_report_templates. */
async function templatesNamed(db: QueryDb, name: unknown, ownerId: unknown): Promise<Template[]> {
  if (name == null || ownerId == null) return [];
  return (await db.where('dynamic_report_templates', { name: name as string })).filter(t =>
    sqlEquals(t.owner_id, ownerId),
  );
}

/** SELECT * FROM dynamic_report_templates WHERE name = $name AND owner_id = $ownerId */
export const getTemplate = port<IGetTemplateQuery>(async ({ name, ownerId }, db) =>
  asResult<IGetTemplateQuery>(await templatesNamed(db, name, ownerId)),
);

/** SELECT * FROM dynamic_report_templates WHERE owner_id IN $$ownerIds */
export const getTemplatesByOwnerIds = port<IGetTemplatesByOwnerIdsQuery>(async ({ ownerIds }, db) =>
  asResult<IGetTemplatesByOwnerIdsQuery>(
    await db.whereIn('dynamic_report_templates', 'owner_id', ownerIds),
  ),
);

/**
 * UPDATE dynamic_report_templates SET template = $template,
 *   from_date = COALESCE($fromDate, from_date), to_date = COALESCE($toDate, to_date)
 * WHERE name = $name AND owner_id = $ownerId RETURNING *
 */
export const updateTemplate = port<IUpdateTemplateQuery>(
  async ({ template, fromDate, toDate, name, ownerId }, db) => {
    const result: Template[] = [];
    for (const row of await templatesNamed(db, name, ownerId)) {
      result.push(
        await db.update('dynamic_report_templates', row, {
          template: (template ?? null) as never,
          from_date: coalesce(dateParam(fromDate), row.from_date),
          to_date: coalesce(dateParam(toDate), row.to_date),
        }),
      );
    }
    return asResult<IUpdateTemplateQuery>(result);
  },
);

/**
 * UPDATE dynamic_report_templates SET name = $newName
 * WHERE name = $prevName AND owner_id = $ownerId RETURNING *
 *
 * (owner_id, name) is the primary key, and dynamic_report_threads and
 * dynamic_report_template_snapshots reference it ON UPDATE CASCADE. The store rejects changing a
 * referenced key (it implements ON UPDATE NO ACTION only), so the cascade is done here: the row is
 * written under its new key (with the updated_at trigger's now()), the children are pointed at it,
 * and the old key is deleted. The end state, the errors (23505 for a taken name, 23502 for a NULL
 * one) and the returned row are those of the UPDATE.
 */
export const updateTemplateName = port<IUpdateTemplateNameQuery>(
  async ({ newName, prevName, ownerId }, db) => {
    const result: Template[] = [];
    for (const row of await templatesNamed(db, prevName, ownerId)) {
      if (newName == null || newName === row.name) {
        result.push(
          await db.update('dynamic_report_templates', row, { name: (newName ?? null) as never }),
        );
        continue;
      }
      const renamed = await db.insert('dynamic_report_templates', {
        ...row,
        name: newName,
        updated_at: db.ctx.now,
      });
      for (const child of [
        'dynamic_report_threads',
        'dynamic_report_template_snapshots',
      ] as const) {
        const rows = await db.where(child, { owner_id: row.owner_id, template_name: row.name });
        for (const childRow of rows) {
          await db.update(child, childRow as never, { template_name: newName } as never);
        }
      }
      await db.delete('dynamic_report_templates', row);
      result.push(renamed!);
    }
    return asResult<IUpdateTemplateNameQuery>(result);
  },
);

/**
 * INSERT INTO dynamic_report_templates (name, owner_id, template, from_date, to_date)
 * VALUES ($name, $ownerId, $template, $fromDate, $toDate) RETURNING *
 */
export const insertTemplate = port<IInsertTemplateQuery>(
  async ({ name, ownerId, template, fromDate, toDate }, db) => {
    const row = await db.insert('dynamic_report_templates', {
      name: (name ?? null) as never,
      owner_id: (ownerId ?? null) as never,
      template: (template ?? null) as never,
      from_date: dateParam(fromDate),
      to_date: dateParam(toDate),
    });
    return asResult<IInsertTemplateQuery>(row ? [row] : []);
  },
);

/**
 * INSERT INTO dynamic_report_template_snapshots (owner_id, template_name, from_date, to_date,
 *   scope_owner_id, tree, leaf_values, leaf_fingerprints, leaf_approvals, created_by, created_at)
 * VALUES ($ownerId, $templateName, $fromDate, $toDate, $scopeOwnerId, $tree, $leafValues,
 *   $leafFingerprints, $leafApprovals, $createdBy, clock_timestamp()) RETURNING *
 */
export const insertSnapshot = port<IInsertSnapshotQuery>(async (params, db) => {
  const json = (value: unknown) => jsonbParam(value) ?? null;
  const row = await db.insert('dynamic_report_template_snapshots', {
    owner_id: (params.ownerId ?? null) as never,
    template_name: (params.templateName ?? null) as never,
    from_date: dateParam(params.fromDate) as never,
    to_date: dateParam(params.toDate) as never,
    scope_owner_id: (params.scopeOwnerId ?? null) as never,
    tree: json(params.tree) as never,
    leaf_values: json(params.leafValues) as never,
    leaf_fingerprints: json(params.leafFingerprints) as never,
    leaf_approvals: json(params.leafApprovals) as never,
    created_by: params.createdBy ?? null,
    created_at: new Date(),
  });
  return asResult<IInsertSnapshotQuery>(row ? [row] : []);
});

/**
 * SELECT id, owner_id, template_name, from_date, to_date, scope_owner_id, created_by, created_at
 * FROM dynamic_report_template_snapshots WHERE owner_id IN $$ownerIds ORDER BY created_at DESC
 */
export const getSnapshotsMetaByOwnerIds = port<IGetSnapshotsMetaByOwnerIdsQuery>(
  async ({ ownerIds }, db) => {
    const rows = await db.whereIn('dynamic_report_template_snapshots', 'owner_id', ownerIds);
    const ordered = orderBy(rows, [{ value: r => r.created_at, desc: true }]);
    return asResult<IGetSnapshotsMetaByOwnerIdsQuery>(
      ordered.map(r => ({
        id: r.id,
        owner_id: r.owner_id,
        template_name: r.template_name,
        from_date: r.from_date,
        to_date: r.to_date,
        scope_owner_id: r.scope_owner_id,
        created_by: r.created_by,
        created_at: r.created_at,
      })),
    );
  },
);

/** SELECT * FROM dynamic_report_template_snapshots WHERE id = $id */
export const getSnapshotById = port<IGetSnapshotByIdQuery>(async ({ id }, db) =>
  id == null
    ? []
    : asResult<IGetSnapshotByIdQuery>(await db.where('dynamic_report_template_snapshots', { id })),
);

/**
 * SELECT id, created_at, leaf_fingerprints, leaf_approvals FROM dynamic_report_template_snapshots
 * WHERE owner_id = $ownerId! AND template_name = $templateName! AND from_date = $fromDate!
 *   AND to_date = $toDate! AND scope_owner_id = $scopeOwnerId!
 * ORDER BY created_at DESC LIMIT 1
 *
 * Two snapshots with the same created_at leave the row undefined in Postgres; the port takes the
 * larger id.
 */
export const getLatestComparableSnapshot = port<IGetLatestComparableSnapshotQuery>(
  async ({ ownerId, templateName, fromDate, toDate, scopeOwnerId }, db) => {
    if (ownerId == null || templateName == null || fromDate == null || toDate == null) return [];
    const from = toDateString(fromDate);
    const to = toDateString(toDate);
    const rows = (
      await db.where('dynamic_report_template_snapshots', {
        owner_id: ownerId,
        template_name: templateName,
      })
    ).filter(
      r => r.from_date === from && r.to_date === to && sqlEquals(r.scope_owner_id, scopeOwnerId),
    );
    return orderBy(rows, [
      { value: r => r.created_at, desc: true },
      { value: r => uuidOrder(r.id), desc: true },
    ])
      .slice(0, 1)
      .map(r => ({
        id: r.id,
        created_at: r.created_at,
        leaf_fingerprints: r.leaf_fingerprints,
        leaf_approvals: r.leaf_approvals,
      })) as never;
  },
);

/**
 * SELECT * FROM dynamic_report_templates WHERE name = $name! AND owner_id = $ownerId!
 * FOR NO KEY UPDATE
 *
 * The row lock has no counterpart: the store's writes go through one process and commit with
 * preconditions on the rows they read.
 */
export const lockTemplateForSnapshot = port<ILockTemplateForSnapshotQuery>(
  async ({ name, ownerId }, db) =>
    asResult<ILockTemplateForSnapshotQuery>(await templatesNamed(db, name, ownerId)),
);

/**
 * DELETE FROM dynamic_report_templates WHERE name = $name AND owner_id = $ownerId RETURNING name
 * (threads, their comments and snapshots go with it: ON DELETE CASCADE)
 */
export const deleteTemplate = port<IDeleteTemplateQuery>(async ({ name, ownerId }, db) => {
  const result: { name: string }[] = [];
  for (const row of await templatesNamed(db, name, ownerId)) {
    await db.delete('dynamic_report_templates', row);
    result.push({ name: row.name });
  }
  return result;
});

async function setLocked(db: QueryDb, name: unknown, ownerId: unknown, isLocked: boolean) {
  const result: Template[] = [];
  for (const row of await templatesNamed(db, name, ownerId)) {
    result.push(await db.update('dynamic_report_templates', row, { is_locked: isLocked }));
  }
  return result;
}

/** UPDATE dynamic_report_templates SET is_locked = TRUE WHERE name = $name AND owner_id = $ownerId RETURNING * */
export const lockTemplate = port<ILockTemplateQuery>(async ({ name, ownerId }, db) =>
  asResult<ILockTemplateQuery>(await setLocked(db, name, ownerId, true)),
);

/** UPDATE dynamic_report_templates SET is_locked = FALSE WHERE name = $name AND owner_id = $ownerId RETURNING * */
export const unlockTemplate = port<IUnlockTemplateQuery>(async ({ name, ownerId }, db) =>
  asResult<IUnlockTemplateQuery>(await setLocked(db, name, ownerId, false)),
);
