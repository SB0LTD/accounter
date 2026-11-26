import type {
  ICopyShareholdersQuery,
  IDeleteShareholdersByOwnerAndYearQuery,
  IGetShareholdersByOwnerAndYearsQuery,
  IInsertShareholdersQuery,
  ILockShareholdersOfOwnerAndYearQuery,
} from '../../../../../modules/report-1214/__generated__/shareholders.types.js';
import { caseFor, type Cases } from '../../../cases.js';

type Input = IInsertShareholdersQuery['params']['shareholders'][number];

const holder = (ownerId: string, overrides: Partial<Input>): Input => ({
  ownerId,
  year: 2025,
  businessId: null,
  idNumber: '111111118',
  fullName: 'New Holder',
  isControlling: false,
  dividendRightsPercent: null,
  votingRightsPercent: null,
  otherRightsPercent: null,
  isMaterial: null,
  salaryMonths1To9: null,
  salaryMonths10To12: null,
  otherPayments: null,
  sortOrder: 0,
  ...overrides,
});

export const cases: Cases = {
  getShareholdersByOwnerAndYears: caseFor<IGetShareholdersByOwnerAndYearsQuery>(s => [
    // 2024 has two rows with the same sort_order: id breaks the tie
    { ownerIds: [s.businessId, s.businessId], years: [2024, 2023] },
    { ownerIds: [s.businessId], years: [2024] },
    { ownerIds: [s.businessId], years: [2030] },
    { ownerIds: [s.missingId], years: [2024] },
  ]),
  lockShareholdersOfOwnerAndYear: caseFor<ILockShareholdersOfOwnerAndYearQuery>(s => [
    { ownerId: s.businessId, year: 2024 },
    { ownerId: null, year: null },
  ]),
  deleteShareholdersByOwnerAndYear: caseFor<IDeleteShareholdersByOwnerAndYearQuery>(s => [
    { ownerId: s.businessId, year: 2024 },
    { ownerId: s.businessId, year: 2031 },
  ]),
  insertShareholders: caseFor<IInsertShareholdersQuery>(s => [
    {
      shareholders: [
        holder(s.businessId, {
          isControlling: true,
          dividendRightsPercent: 33.33333, // numeric(7,4): rounds to 33.3333
          votingRightsPercent: '66.66665', // rounds half away from zero: 66.6667
          otherRightsPercent: 0,
          isMaterial: true,
          salaryMonths1To9: 0.1 + 0.2,
          salaryMonths10To12: '1000.10',
          otherPayments: 12,
          sortOrder: 0,
        }),
        holder(s.businessId, {
          idNumber: '999999998',
          fullName: 'Public',
          businessId: '87916ff6-a3f1-5d39-b6e0-7b5d7e155426',
          dividendRightsPercent: '0.00005', // rounds up to 0.0001
          sortOrder: 1,
        }),
        holder(s.businessId, { idNumber: '999999998', fullName: 'Public 2', sortOrder: 2 }),
        // trailing spaces past varchar(9) are dropped
        holder(s.businessId, { idNumber: '222222226   ', fullName: 'Padded', sortOrder: 3 }),
      ],
    },
    // same id number twice in a year: unique violation
    {
      shareholders: [
        holder(s.businessId, { idNumber: '333333334' }),
        holder(s.businessId, { idNumber: '333333334', sortOrder: 1 }),
      ],
    },
    // an id number already used in 2024
    { shareholders: [holder(s.businessId, { year: 2024, idNumber: '123456782' })] },
    // 100.00001 rounds to 100.0000 before the CHECK, so it passes
    { shareholders: [holder(s.businessId, { dividendRightsPercent: 100.00001 })] },
    // CHECKs: percent over 100, id number not 9 digits, year out of range
    { shareholders: [holder(s.businessId, { dividendRightsPercent: '100.0001' })] },
    { shareholders: [holder(s.businessId, { idNumber: '12345' })] },
    { shareholders: [holder(s.businessId, { year: 2101 })] },
    // numeric(7,4) overflow, varchar(9) too long, not an integer
    { shareholders: [holder(s.businessId, { votingRightsPercent: 999.99995 })] },
    { shareholders: [holder(s.businessId, { idNumber: '1234567890' })] },
    { shareholders: [holder(s.businessId, { sortOrder: 1.5 })] },
    // explicit NULLs: no column defaults
    { shareholders: [holder(s.businessId, { isControlling: null })] },
    { shareholders: [holder(s.businessId, { sortOrder: null })] },
    // unknown business: foreign key violation
    { shareholders: [holder(s.businessId, { businessId: s.missingId })] },
    // another tenant: RLS
    { shareholders: [holder(s.missingId, {})] },
  ]),
  copyShareholders: caseFor<ICopyShareholdersQuery>(s => [
    // two rows with the same sort_order: inserted and returned by id
    { ownerId: s.businessId, fromYear: 2024, toYear: 2025 },
    { ownerId: s.businessId, fromYear: 2023, toYear: 2026 },
    // into a year that has them: unique violation on the first non-placeholder id number
    { ownerId: s.businessId, fromYear: 2023, toYear: 2024 },
    // nothing to copy
    { ownerId: s.businessId, fromYear: 2030, toYear: 2031 },
    // NULL target year with rows: not-null violation
    { ownerId: s.businessId, fromYear: 2024, toYear: null },
    // target year out of range
    { ownerId: s.businessId, fromYear: 2024, toYear: 2150 },
  ]),
};
