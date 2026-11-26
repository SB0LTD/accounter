import type {
  IGetReportByBusinessIdAndDatesQuery,
  IInsertReportQuery,
  IUpdateReportQuery,
} from '../../../../../modules/reports/__generated__/vat-report.types.js';
import { caseFor, type Cases } from '../../../cases.js';

const ACME_USA = '87916ff6-a3f1-5d39-b6e0-7b5d7e155426';

export const cases: Cases = {
  getReportByBusinessIdAndDates: caseFor<IGetReportByBusinessIdAndDatesQuery>(s => [
    { businessId: s.businessId, monthDates: ['2024-01-01', '2024-02-01', '2024-03-01'] },
    { businessId: s.businessId, monthDates: ['2024-02-01', null] },
    { businessId: ACME_USA, monthDates: ['2024-01-01'] },
    { businessId: s.missingId, monthDates: ['2024-01-01'] },
    { businessId: null, monthDates: ['2024-01-01'] },
  ]),
  updateReport: caseFor<IUpdateReportQuery>(s => [
    { businessId: s.businessId, monthDate: '2024-01-01', content: 'updated content' },
    { businessId: s.businessId, monthDate: '2024-03-01', content: 'no such month' },
    { businessId: s.businessId, monthDate: '2024-02-01', content: null }, // 23502
  ]),
  insertReport: caseFor<IInsertReportQuery>(s => [
    { businessId: s.businessId, monthDate: '2024-03-01', content: 'march', ownerId: s.businessId },
    { businessId: s.businessId, monthDate: '2024-01-01', content: 'dup', ownerId: s.businessId }, // 23505
    { businessId: s.missingId, monthDate: '2024-01-01', content: 'fk', ownerId: s.businessId }, // 23503
    { businessId: s.businessId, monthDate: '2024-04-01', content: 'rls', ownerId: s.missingId }, // 42501
    { businessId: s.businessId, monthDate: null, content: 'null', ownerId: s.businessId }, // 23502
  ]),
};
