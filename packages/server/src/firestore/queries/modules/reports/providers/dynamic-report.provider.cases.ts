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
import { caseFor, type Cases } from '../../../cases.js';

const PNL = 'fixture-040 P&L';
const BALANCE = 'fixture-040 Balance';
const SPARE = 'fixture-040 Spare';

export const cases: Cases = {
  getTemplate: caseFor<IGetTemplateQuery>(s => [
    { name: PNL, ownerId: s.businessId },
    { name: BALANCE, ownerId: s.businessId },
    { name: PNL, ownerId: s.missingId },
    { name: null, ownerId: s.businessId },
  ]),
  getTemplatesByOwnerIds: caseFor<IGetTemplatesByOwnerIdsQuery>(s => [
    { ownerIds: [s.businessId] },
    { ownerIds: [s.businessId, s.missingId] },
    { ownerIds: [s.missingId] },
  ]),
  updateTemplate: caseFor<IUpdateTemplateQuery>(s => [
    // dates kept (COALESCE)
    { name: BALANCE, ownerId: s.businessId, template: '{"v":2}', fromDate: null, toDate: null },
    // dates replaced
    {
      name: PNL,
      ownerId: s.businessId,
      template: '{"v":3}',
      fromDate: '2025-01-01',
      toDate: '2025-12-31',
    },
    // NULL template: not-null violation
    { name: PNL, ownerId: s.businessId, template: null, fromDate: null, toDate: null },
    // no such template
    { name: 'nope', ownerId: s.businessId, template: '{}', fromDate: null, toDate: null },
  ]),
  updateTemplateName: caseFor<IUpdateTemplateNameQuery>(s => [
    // has threads, comments and snapshots: ON UPDATE CASCADE
    { prevName: PNL, newName: 'fixture-040 P&L renamed', ownerId: s.businessId },
    // no children
    { prevName: SPARE, newName: 'fixture-040 Spare 2', ownerId: s.businessId },
    // same name
    { prevName: SPARE, newName: SPARE, ownerId: s.businessId },
    // name taken: unique violation
    { prevName: PNL, newName: BALANCE, ownerId: s.businessId },
    // NULL name: not-null violation
    { prevName: PNL, newName: null, ownerId: s.businessId },
    // no such template
    { prevName: 'nope', newName: 'other', ownerId: s.businessId },
  ]),
  insertTemplate: caseFor<IInsertTemplateQuery>(s => [
    {
      name: 'fixture-040 new',
      ownerId: s.businessId,
      template: '{"nodes":[]}',
      fromDate: '2024-01-01',
      toDate: null,
    },
    { name: PNL, ownerId: s.businessId, template: '{}', fromDate: null, toDate: null }, // 23505
    { name: 'x', ownerId: s.missingId, template: '{}', fromDate: null, toDate: null }, // RLS
    { name: 'y', ownerId: s.businessId, template: null, fromDate: null, toDate: null }, // 23502
  ]),
  insertSnapshot: caseFor<IInsertSnapshotQuery>(s => [
    {
      ownerId: s.businessId,
      templateName: PNL,
      fromDate: '2024-01-01',
      toDate: '2024-12-31',
      scopeOwnerId: s.businessId,
      tree: '[]',
      leafValues: JSON.stringify({ a: 1.5, b: 'x' }),
      leafFingerprints: null,
      leafApprovals: JSON.stringify({ a: { by: 'me' } }),
      createdBy: s.userId,
    },
    // objects as parameters (pg sends them as JSON), a JSON string literal
    {
      ownerId: s.businessId,
      templateName: BALANCE,
      fromDate: '2024-01-01',
      toDate: '2024-12-31',
      scopeOwnerId: s.businessId,
      tree: { id: 'root', children: [{ id: 'a' }] },
      leafValues: '"plain"',
      leafFingerprints: { a: 'f' },
      leafApprovals: null,
      createdBy: null,
    },
    // an empty JS array goes out as the array literal '{}', which is the empty JSON object
    {
      ownerId: s.businessId,
      templateName: BALANCE,
      fromDate: '2024-01-01',
      toDate: '2024-12-31',
      scopeOwnerId: s.businessId,
      tree: [],
      leafValues: '{}',
      leafFingerprints: null,
      leafApprovals: null,
      createdBy: null,
    },
    // not JSON: 22P02
    {
      ownerId: s.businessId,
      templateName: BALANCE,
      fromDate: '2024-01-01',
      toDate: '2024-12-31',
      scopeOwnerId: s.businessId,
      tree: 'not json',
      leafValues: '{}',
      leafFingerprints: null,
      leafApprovals: null,
      createdBy: null,
    },
    // no such template: foreign key violation
    {
      ownerId: s.businessId,
      templateName: 'nope',
      fromDate: '2024-01-01',
      toDate: '2024-12-31',
      scopeOwnerId: s.businessId,
      tree: '{}',
      leafValues: '{}',
      leafFingerprints: null,
      leafApprovals: null,
      createdBy: null,
    },
    // NULL tree: not-null violation
    {
      ownerId: s.businessId,
      templateName: PNL,
      fromDate: '2024-01-01',
      toDate: '2024-12-31',
      scopeOwnerId: s.businessId,
      tree: null,
      leafValues: '{}',
      leafFingerprints: null,
      leafApprovals: null,
      createdBy: null,
    },
  ]),
  getSnapshotsMetaByOwnerIds: caseFor<IGetSnapshotsMetaByOwnerIdsQuery>(s => [
    { ownerIds: [s.businessId] },
    { ownerIds: [s.missingId] },
  ]),
  getSnapshotById: caseFor<IGetSnapshotByIdQuery>(s => [
    ...s
      .rows('dynamic_report_template_snapshots')
      .filter(r => r.owner_id === s.businessId)
      .map(r => ({ id: r.id as string })),
    { id: s.missingId },
  ]),
  getLatestComparableSnapshot: caseFor<IGetLatestComparableSnapshotQuery>(s => [
    {
      ownerId: s.businessId,
      templateName: PNL,
      fromDate: '2024-01-01',
      toDate: '2024-12-31',
      scopeOwnerId: s.businessId,
    },
    {
      ownerId: s.businessId,
      templateName: PNL,
      fromDate: '2023-01-01',
      toDate: '2023-12-31',
      scopeOwnerId: s.businessId,
    },
    {
      ownerId: s.businessId,
      templateName: BALANCE,
      fromDate: '2024-01-01',
      toDate: '2024-12-31',
      scopeOwnerId: s.businessId,
    },
    {
      ownerId: s.businessId,
      templateName: PNL,
      fromDate: '2024-01-01',
      toDate: '2024-12-31',
      scopeOwnerId: s.missingId,
    },
  ]),
  lockTemplateForSnapshot: caseFor<ILockTemplateForSnapshotQuery>(s => [
    { name: PNL, ownerId: s.businessId },
    { name: 'nope', ownerId: s.businessId },
  ]),
  deleteTemplate: caseFor<IDeleteTemplateQuery>(s => [
    { name: PNL, ownerId: s.businessId }, // cascades to threads, comments, snapshots
    { name: SPARE, ownerId: s.businessId },
    { name: 'nope', ownerId: s.businessId },
  ]),
  lockTemplate: caseFor<ILockTemplateQuery>(s => [
    { name: PNL, ownerId: s.businessId },
    { name: BALANCE, ownerId: s.businessId },
    { name: 'nope', ownerId: s.businessId },
  ]),
  unlockTemplate: caseFor<IUnlockTemplateQuery>(s => [
    { name: BALANCE, ownerId: s.businessId },
    { name: PNL, ownerId: s.businessId },
    { name: null, ownerId: s.businessId },
  ]),
};
