import type {
  IGetCommentsByThreadIdsQuery,
  IGetThreadsByTemplateQuery,
  IInsertCommentQuery,
  ISetThreadResolvedQuery,
  ISoftDeleteCommentQuery,
  IUpdateCommentContentQuery,
  IUpsertThreadQuery,
} from '../../../../../modules/reports/__generated__/dynamic-report-comments.types.js';
import { caseFor, type Cases, type Snapshot } from '../../../cases.js';

const threads = (s: Snapshot) =>
  s.rows('dynamic_report_threads').filter(t => t.owner_id === s.businessId);
const comments = (s: Snapshot) =>
  s.rows('dynamic_report_comments').filter(c => c.owner_id === s.businessId);
const threadAt = (s: Snapshot, nodeId: string) =>
  threads(s).find(t => t.node_id === nodeId) ?? threads(s)[0];

export const cases: Cases = {
  getThreadsByTemplate: caseFor<IGetThreadsByTemplateQuery>(s => [
    // two threads with the same created_at: id breaks the tie
    { ownerId: s.businessId, templateName: 'fixture-040 P&L' },
    { ownerId: s.businessId, templateName: 'fixture-040 Balance' },
    { ownerId: s.businessId, templateName: 'no such template' },
    { ownerId: s.missingId, templateName: 'fixture-040 P&L' },
  ]),
  getCommentsByThreadIds: caseFor<IGetCommentsByThreadIdsQuery>(s => [
    { threadIds: threads(s).map(t => t.id as string) },
    { threadIds: [threadAt(s, 'rev')?.id as string] },
    { threadIds: [s.missingId] },
  ]),
  upsertThread: caseFor<IUpsertThreadQuery>(s => [
    // new node
    {
      ownerId: s.businessId,
      templateName: 'fixture-040 P&L',
      nodeId: 'new-node',
      nodeKind: 'leaf',
      nodeLabel: 'New node',
    },
    // existing, resolved thread: relabelled and reopened
    {
      ownerId: s.businessId,
      templateName: 'fixture-040 P&L',
      nodeId: 'costs',
      nodeKind: 'leaf',
      nodeLabel: 'Costs (renamed)',
    },
    // no such template: foreign key violation
    {
      ownerId: s.businessId,
      templateName: 'no such template',
      nodeId: 'x',
      nodeKind: 'leaf',
      nodeLabel: 'X',
    },
    // check constraint on node_kind
    {
      ownerId: s.businessId,
      templateName: 'fixture-040 P&L',
      nodeId: 'bad-kind',
      nodeKind: 'trunk',
      nodeLabel: 'Bad',
    },
    // another tenant: RLS
    {
      ownerId: s.missingId,
      templateName: 'fixture-040 P&L',
      nodeId: 'rev',
      nodeKind: 'leaf',
      nodeLabel: 'Other',
    },
  ]),
  insertComment: caseFor<IInsertCommentQuery>(s => [
    {
      ownerId: s.businessId,
      threadId: threadAt(s, 'rev')?.id as string,
      authorId: s.userId ?? s.missingId,
      content: 'A new comment',
      fromDate: '2024-01-01',
      toDate: '2024-12-31',
      scopeOwnerId: s.businessId,
    },
    // blank content: check constraint
    {
      ownerId: s.businessId,
      threadId: threadAt(s, 'rev')?.id as string,
      authorId: s.userId ?? s.missingId,
      content: '   ',
      fromDate: '2024-01-01',
      toDate: '2024-12-31',
      scopeOwnerId: s.businessId,
    },
    // missing thread: foreign key violation
    {
      ownerId: s.businessId,
      threadId: s.missingId,
      authorId: s.userId ?? s.missingId,
      content: 'orphan',
      fromDate: '2024-01-01',
      toDate: '2024-12-31',
      scopeOwnerId: s.businessId,
    },
  ]),
  updateCommentContent: caseFor<IUpdateCommentContentQuery>(s =>
    comments(s).map(c => ({
      // the user's live comment matches; someone else's and a deleted one do not
      id: c.id as string,
      ownerId: s.businessId,
      userId: s.userId ?? s.missingId,
      content: 'Edited text',
    })),
  ),
  softDeleteComment: caseFor<ISoftDeleteCommentQuery>(s => [
    ...comments(s).map(c => ({
      id: c.id as string,
      ownerId: s.businessId,
      userId: s.userId ?? s.missingId,
    })),
    { id: s.missingId, ownerId: s.businessId, userId: s.userId ?? s.missingId },
  ]),
  setThreadResolved: caseFor<ISetThreadResolvedQuery>(s =>
    threads(s).flatMap(t => [
      { ownerId: s.businessId, threadId: t.id as string, resolved: true, userId: s.userId! },
      { ownerId: s.businessId, threadId: t.id as string, resolved: false, userId: s.userId! },
      {
        ownerId: s.businessId,
        threadId: t.id as string,
        resolved: null as unknown as boolean,
        userId: s.userId!,
      },
      { ownerId: s.missingId, threadId: t.id as string, resolved: true, userId: s.userId! },
    ]),
  ),
};
