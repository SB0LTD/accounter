import { asResult, uuidOrder } from '../_helpers.js';
import type {
  IGetCommentsByThreadIdsQuery,
  IGetThreadsByTemplateQuery,
  IInsertCommentQuery,
  ISetThreadResolvedQuery,
  ISoftDeleteCommentQuery,
  IUpdateCommentContentQuery,
  IUpsertThreadQuery,
} from '../../../../../modules/reports/__generated__/dynamic-report-comments.types.js';
import type { QueryDb } from '../../../../query-db.js';
import { orderBy, sqlEquals } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';

const byCreatedAtThenId = <T extends { created_at: Date; id: string }>(rows: readonly T[]) =>
  orderBy(rows, [{ value: r => r.created_at }, { value: r => uuidOrder(r.id) }]);

/**
 * SELECT * FROM dynamic_report_threads WHERE owner_id = $ownerId! AND template_name = $templateName!
 * ORDER BY created_at, id
 */
export const getThreadsByTemplate = port<IGetThreadsByTemplateQuery>(
  async ({ ownerId, templateName }, db) => {
    if (ownerId == null || templateName == null) return [];
    return byCreatedAtThenId(
      await db.where('dynamic_report_threads', { owner_id: ownerId, template_name: templateName }),
    );
  },
);

/** SELECT * FROM dynamic_report_comments WHERE thread_id IN $$threadIds ORDER BY created_at, id */
export const getCommentsByThreadIds = port<IGetCommentsByThreadIdsQuery>(
  async ({ threadIds }, db) =>
    asResult<IGetCommentsByThreadIdsQuery>(
      byCreatedAtThenId(await db.whereIn('dynamic_report_comments', 'thread_id', threadIds)),
    ),
);

/**
 * INSERT INTO dynamic_report_threads (owner_id, template_name, node_id, node_kind, node_label)
 * VALUES (...)
 * ON CONFLICT (owner_id, template_name, node_id) DO UPDATE SET node_label = EXCLUDED.node_label,
 *   node_kind = EXCLUDED.node_kind, resolved_at = NULL, resolved_by = NULL
 * RETURNING *
 */
export const upsertThread = port<IUpsertThreadQuery>(
  async ({ ownerId, templateName, nodeId, nodeKind, nodeLabel }, db) => {
    const row = await db.insert(
      'dynamic_report_threads',
      {
        owner_id: ownerId ?? null,
        template_name: templateName ?? null,
        node_id: nodeId ?? null,
        node_kind: nodeKind ?? null,
        node_label: nodeLabel ?? null,
      } as never,
      {
        target: ['owner_id', 'template_name', 'node_id'],
        action: (_existing, excluded) => ({
          node_label: excluded.node_label,
          node_kind: excluded.node_kind,
          resolved_at: null,
          resolved_by: null,
        }),
      },
    );
    return row ? [row] : [];
  },
);

/**
 * INSERT INTO dynamic_report_comments (owner_id, thread_id, author_id, content, from_date, to_date,
 * scope_owner_id) VALUES (...) RETURNING *
 */
export const insertComment = port<IInsertCommentQuery>(
  async ({ ownerId, threadId, authorId, content, fromDate, toDate, scopeOwnerId }, db) => {
    const row = await db.insert('dynamic_report_comments', {
      owner_id: ownerId ?? null,
      thread_id: threadId ?? null,
      author_id: authorId ?? null,
      content: content ?? null,
      from_date: fromDate ?? null,
      to_date: toDate ?? null,
      scope_owner_id: scopeOwnerId ?? null,
    } as never);
    return asResult<IInsertCommentQuery>(row ? [row] : []);
  },
);

/** The comments `WHERE id = $id AND owner_id = $ownerId AND author_id = $userId AND deleted_at IS NULL`. */
async function liveCommentsOf(
  db: QueryDb,
  { id, ownerId, userId }: { id: string; ownerId: string; userId: string },
) {
  if (id == null) return [];
  return (await db.where('dynamic_report_comments', { id })).filter(
    c => sqlEquals(c.owner_id, ownerId) && sqlEquals(c.author_id, userId) && c.deleted_at == null,
  );
}

/**
 * UPDATE dynamic_report_comments SET content = $content!, edited_at = clock_timestamp()
 * WHERE id = $id! AND owner_id = $ownerId! AND author_id = $userId! AND deleted_at IS NULL
 * RETURNING *
 */
export const updateCommentContent = port<IUpdateCommentContentQuery>(
  async ({ content, id, ownerId, userId }, db) => {
    const result = [];
    for (const row of await liveCommentsOf(db, { id, ownerId, userId })) {
      result.push(
        await db.update('dynamic_report_comments', row, {
          content: content ?? null,
          edited_at: new Date(),
        } as never),
      );
    }
    return asResult<IUpdateCommentContentQuery>(result);
  },
);

/**
 * UPDATE dynamic_report_comments SET deleted_at = clock_timestamp()
 * WHERE id = $id! AND owner_id = $ownerId! AND author_id = $userId! AND deleted_at IS NULL
 * RETURNING *
 */
export const softDeleteComment = port<ISoftDeleteCommentQuery>(
  async ({ id, ownerId, userId }, db) => {
    const result = [];
    for (const row of await liveCommentsOf(db, { id, ownerId, userId })) {
      result.push(await db.update('dynamic_report_comments', row, { deleted_at: new Date() }));
    }
    return asResult<ISoftDeleteCommentQuery>(result);
  },
);

/**
 * UPDATE dynamic_report_threads
 * SET resolved_at = CASE WHEN $resolved! THEN COALESCE(resolved_at, clock_timestamp()) END,
 *     resolved_by = CASE WHEN NOT $resolved! THEN NULL WHEN resolved_at IS NULL THEN $userId!
 *                        ELSE resolved_by END
 * WHERE id = $threadId! AND owner_id = $ownerId!
 * RETURNING *
 *
 * Both SET expressions read the row as it was. A NULL $resolved falls to the ELSE of the first
 * CASE and past the first WHEN of the second.
 */
export const setThreadResolved = port<ISetThreadResolvedQuery>(
  async ({ ownerId, resolved, threadId, userId }, db) => {
    if (threadId == null) return [];
    const rows = (await db.where('dynamic_report_threads', { id: threadId })).filter(t =>
      sqlEquals(t.owner_id, ownerId),
    );
    const result = [];
    for (const row of rows) {
      const resolvedAt = resolved === true ? (row.resolved_at ?? new Date()) : null;
      const resolvedBy =
        resolved === false ? null : row.resolved_at == null ? (userId ?? null) : row.resolved_by;
      result.push(
        await db.update('dynamic_report_threads', row, {
          resolved_at: resolvedAt,
          resolved_by: resolvedBy,
        }),
      );
    }
    return result;
  },
);
