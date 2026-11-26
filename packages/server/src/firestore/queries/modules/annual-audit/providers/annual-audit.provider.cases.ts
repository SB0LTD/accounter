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
import { caseFor, type Cases } from '../../../cases.js';

const BALANCE = 'fixture-040 Balance';
const PNL = 'fixture-040 P&L';
const SPARE = 'fixture-040 Spare';

export const cases: Cases = {
  getStepStatuses: caseFor<IGetStepStatusesQuery>(s => [
    { ownerId: s.businessId, year: 2024 },
    { ownerId: s.businessId, year: 2022 },
    { ownerId: s.businessId, year: 2030 },
    { ownerId: s.missingId, year: 2024 },
    { ownerId: s.businessId, year: null },
  ]),
  getStepStatus: caseFor<IGetStepStatusQuery>(s => [
    { ownerId: s.businessId, year: 2024, stepId: '9' },
    { ownerId: s.businessId, year: 2024, stepId: '1' },
    { ownerId: s.businessId, year: 2023, stepId: '1' },
  ]),
  upsertStepStatus: caseFor<IUpsertStepStatusQuery>(s => [
    // new rows
    { ownerId: s.businessId, year: 2025, stepId: '1', status: 'COMPLETED', notes: 'n' },
    { ownerId: s.businessId, year: 2025, stepId: '2', status: 'IN_PROGRESS', notes: null },
    // completed stays completed: completed_at kept
    { ownerId: s.businessId, year: 2024, stepId: '1', status: 'COMPLETED', notes: 'again' },
    // completed now: completed_at set
    { ownerId: s.businessId, year: 2024, stepId: '3', status: 'COMPLETED', notes: null },
    // reopened: completed_at cleared
    { ownerId: s.businessId, year: 2024, stepId: '9', status: 'PENDING', notes: 'reopen' },
    // CHECK on status, NOT NULL on status
    { ownerId: s.businessId, year: 2024, stepId: '1', status: 'DONE', notes: null },
    { ownerId: s.businessId, year: 2024, stepId: '1', status: null, notes: null },
    // another tenant: RLS
    { ownerId: s.missingId, year: 2024, stepId: '1', status: 'PENDING', notes: null },
  ]),
  upsertStep09Status: caseFor<IUpsertStep09StatusQuery>(s => [
    {
      ownerId: s.businessId,
      year: 2025,
      status: 'IN_PROGRESS',
      evidenceJson: JSON.stringify({ balanceSheetTemplateName: BALANCE }),
    },
    // completed before: completed_at kept
    {
      ownerId: s.businessId,
      year: 2024,
      status: 'COMPLETED',
      evidenceJson: JSON.stringify({
        balanceSheetTemplateName: BALANCE,
        profitAndLossTemplateName: SPARE,
      }),
    },
    // completing now
    {
      ownerId: s.businessId,
      year: 2023,
      status: 'COMPLETED',
      evidenceJson: JSON.stringify({
        balanceSheetTemplateName: BALANCE,
        profitAndLossTemplateName: PNL,
      }),
    },
    // back to in progress: notes and completed_at cleared
    {
      ownerId: s.businessId,
      year: 2024,
      status: 'IN_PROGRESS',
      evidenceJson: JSON.stringify({ profitAndLossTemplateName: PNL }),
    },
    { ownerId: s.businessId, year: 2024, status: 'IN_PROGRESS', evidenceJson: null },
    { ownerId: s.businessId, year: 2024, status: 'IN_PROGRESS', evidenceJson: 'nope' }, // 22P02
  ]),
  resetStep09ForTemplate: caseFor<IResetStep09ForTemplateQuery>(s => [
    { ownerId: s.businessId, templateName: BALANCE },
    { ownerId: s.businessId, templateName: SPARE },
    { ownerId: s.businessId, templateName: 'nope' },
    { ownerId: s.businessId, templateName: null },
  ]),
  upsertStep05Evidence: caseFor<IUpsertStep05EvidenceQuery>(s => [
    // set one report's template on a new year
    {
      ownerId: s.businessId,
      year: 2025,
      patch: JSON.stringify({ balanceSheetTemplateName: BALANCE }),
      removedKeys: [],
    },
    // set both on a year that has other keys
    {
      ownerId: s.businessId,
      year: 2023,
      patch: JSON.stringify({ balanceSheetTemplateName: PNL, profitAndLossTemplateName: PNL }),
      removedKeys: [],
    },
    // clear both
    {
      ownerId: s.businessId,
      year: 2024,
      patch: '{}',
      removedKeys: ['balanceSheetTemplateName', 'profitAndLossTemplateName'],
    },
    // on a row whose evidence is NULL
    {
      ownerId: s.businessId,
      year: 2022,
      patch: JSON.stringify({ profitAndLossTemplateName: SPARE }),
      removedKeys: ['balanceSheetTemplateName'],
    },
    // NULL removedKeys / patch: the merged evidence is NULL
    {
      ownerId: s.businessId,
      year: 2023,
      patch: JSON.stringify({ x: 1 }),
      removedKeys: null,
    },
    { ownerId: s.businessId, year: 2023, patch: null, removedKeys: [] },
    // an array patch concatenates
    { ownerId: s.businessId, year: 2023, patch: '[1, "a"]', removedKeys: ['note'] },
  ]),
  renameWorkingTemplate: caseFor<IRenameWorkingTemplateQuery>(s => [
    { ownerId: s.businessId, prevName: BALANCE, newName: 'renamed' },
    { ownerId: s.businessId, prevName: PNL, newName: null },
    { ownerId: s.businessId, prevName: 'nope', newName: 'x' },
  ]),
  removeWorkingTemplate: caseFor<IRemoveWorkingTemplateQuery>(s => [
    { ownerId: s.businessId, templateName: BALANCE },
    { ownerId: s.businessId, templateName: PNL },
    { ownerId: s.businessId, templateName: 'nope' },
  ]),
  getBalanceCharge: caseFor<IGetBalanceChargeQuery>(s => [
    { ownerId: s.businessId, year: 2023 },
    { ownerId: s.businessId, year: 2024 },
    { ownerId: s.businessId, year: 2022 },
    { ownerId: s.missingId, year: 2023 },
    { ownerId: s.businessId, year: null },
    { ownerId: s.businessId, year: 0 }, // make_date raises
  ]),
};
