import type {
  IGetSalaryRecordsByChargeIdsQuery,
  IGetSalaryRecordsByDatesQuery,
  IGetSalaryRecordsByMonthQuery,
  IInsertSalaryRecordsQuery,
  IUpdateSalaryRecordQuery,
} from '../../../../../modules/salaries/__generated__/salaries.types.js';
import { caseFor, type Cases } from '../../../cases.js';

// Fixture rows (scripts/firestore/fixtures/090-accounts-salaries.sql)
const ID = (n: number) => `0f090000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const EMPLOYEE_ONE = ID(101); // 2024-01, 2024-02
const EMPLOYEE_TWO = ID(102); // 2024-01, 2024-02
const EMPLOYEE_THREE = ID(103); // 2024-03
const PENSION_FUND = ID(111);
const TRAINING_FUND = ID(112);
const SECOND_EMPLOYER = ID(131);

type SalaryRecord = IInsertSalaryRecordsQuery['params']['salaryRecords'][number];

const emptyRecord: SalaryRecord = {
  ownerId: null,
  addedVacationDays: null,
  baseSalary: null,
  bonus: null,
  chargeId: null,
  compensationsEmployerAmount: null,
  compensationsEmployerPercentage: null,
  directPaymentAmount: null,
  employee: null,
  employeeId: null,
  employer: null,
  gift: null,
  globalAdditionalHours: null,
  healthPaymentAmount: null,
  hourlyRate: null,
  hours: null,
  jobPercentage: null,
  month: null,
  pensionEmployeeAmount: null,
  pensionEmployeePercentage: null,
  pensionEmployerAmount: null,
  pensionEmployerPercentage: null,
  pensionFundId: null,
  recovery: null,
  sicknessDaysBalance: null,
  socialSecurityAmountEmployee: null,
  socialSecurityAmountEmployer: null,
  taxAmount: null,
  trainingFundEmployeeAmount: null,
  trainingFundEmployeePercentage: null,
  trainingFundEmployerAmount: null,
  trainingFundEmployerPercentage: null,
  trainingFundId: null,
  travelAndSubsistence: null,
  vacationDaysBalance: null,
  vacationTakeout: null,
  workDays: null,
  zkufot: null,
};

export const cases: Cases = {
  getSalaryRecordsByMonth: caseFor<IGetSalaryRecordsByMonthQuery>(() => [
    { month: '2024-01' },
    { month: '2024-03' },
    { month: '2023-12' },
    { month: null },
  ]),
  getSalaryRecordsByDates: caseFor<IGetSalaryRecordsByDatesQuery>(() => [
    { fromDate: '2024-01', toDate: '2024-02' },
    { fromDate: '2000-01', toDate: '2024-12' },
    { fromDate: '2024-02', toDate: '2024-02' },
    { fromDate: '2024-03', toDate: '2024-01' },
    { fromDate: null, toDate: '2024-12' },
    { fromDate: '2024-01', toDate: null },
  ]),
  getSalaryRecordsByChargeIds: caseFor<IGetSalaryRecordsByChargeIdsQuery>(s => [
    { chargeIds: s.values('salaries', 'charge_id', 5) as string[] },
    { chargeIds: [(s.values('salaries', 'charge_id', 1) as string[])[0]!, s.missingId] },
    { chargeIds: [s.missingId] },
    { chargeIds: [] },
    { chargeIds: null },
  ]),
  insertSalaryRecords: caseFor<IInsertSalaryRecordsQuery>(s => [
    // two rows: amounts rounded to numeric(9,2) / numeric(5,2), real percentages to float4
    {
      salaryRecords: [
        {
          ownerId: s.businessId,
          addedVacationDays: 1.255,
          baseSalary: 20000.005,
          bonus: '1234.5',
          chargeId: s.ids('charges', 1)[0],
          compensationsEmployerAmount: '1666.666',
          compensationsEmployerPercentage: 8.333333333,
          directPaymentAmount: 15321.994,
          employee: 'Dana One',
          employeeId: EMPLOYEE_ONE,
          employer: s.businessId,
          gift: 0,
          globalAdditionalHours: -2.125,
          healthPaymentAmount: '621',
          hourlyRate: 110.1,
          hours: 186,
          jobPercentage: '99.999',
          month: '2024-03',
          pensionEmployeeAmount: 1200,
          pensionEmployeePercentage: 6.123456789,
          pensionEmployerAmount: '1300.00',
          pensionEmployerPercentage: 0.1 + 0.2,
          pensionFundId: PENSION_FUND,
          recovery: 418,
          sicknessDaysBalance: 19.5,
          socialSecurityAmountEmployee: 812.4,
          socialSecurityAmountEmployer: 760.15,
          taxAmount: 2531.885,
          trainingFundEmployeeAmount: 500,
          trainingFundEmployeePercentage: 2.5,
          trainingFundEmployerAmount: 1500,
          trainingFundEmployerPercentage: 7.5,
          trainingFundId: TRAINING_FUND,
          travelAndSubsistence: 315.2,
          vacationDaysBalance: 13.999,
          vacationTakeout: 0.004,
          workDays: 22,
          zkufot: 125,
        },
        {
          ...emptyRecord,
          ownerId: s.businessId,
          directPaymentAmount: 5000,
          employeeId: EMPLOYEE_TWO,
          employer: s.businessId,
          jobPercentage: 50,
          month: '2024-03',
        },
      ],
    },
    // primary key (month, employee_id) taken: 23505
    {
      salaryRecords: [
        {
          ...emptyRecord,
          ownerId: s.businessId,
          directPaymentAmount: 1,
          employeeId: EMPLOYEE_ONE,
          employer: s.businessId,
          jobPercentage: 100,
          month: '2024-01',
        },
      ],
    },
    // no such employee: 23503
    {
      salaryRecords: [
        {
          ...emptyRecord,
          ownerId: s.businessId,
          directPaymentAmount: 1,
          employeeId: s.missingId,
          employer: s.businessId,
          jobPercentage: 100,
          month: '2024-04',
        },
      ],
    },
    // direct_payment_amount is NOT NULL
    {
      salaryRecords: [
        {
          ...emptyRecord,
          ownerId: s.businessId,
          employeeId: EMPLOYEE_THREE,
          employer: SECOND_EMPLOYER,
          jobPercentage: 100,
          month: '2024-04',
        },
      ],
    },
    // job_percentage has a default, but an explicit NULL violates NOT NULL
    {
      salaryRecords: [
        {
          ...emptyRecord,
          ownerId: s.businessId,
          directPaymentAmount: 1,
          employeeId: EMPLOYEE_THREE,
          employer: SECOND_EMPLOYER,
          month: '2024-04',
        },
      ],
    },
    // numeric(9,2) overflow: 22003
    {
      salaryRecords: [
        {
          ...emptyRecord,
          ownerId: s.businessId,
          directPaymentAmount: 1,
          baseSalary: 9999999.995,
          employeeId: EMPLOYEE_THREE,
          employer: SECOND_EMPLOYER,
          jobPercentage: 100,
          month: '2024-04',
        },
      ],
    },
    // owner_id of another business: RLS WITH CHECK
    {
      salaryRecords: [
        {
          ...emptyRecord,
          ownerId: SECOND_EMPLOYER,
          directPaymentAmount: 1,
          employeeId: EMPLOYEE_THREE,
          employer: SECOND_EMPLOYER,
          jobPercentage: 100,
          month: '2024-04',
        },
      ],
    },
  ]),
  updateSalaryRecord: caseFor<IUpdateSalaryRecordQuery>(s => [
    {
      month: '2024-01',
      employeeId: EMPLOYEE_ONE,
      baseSalary: 21000.555,
      bonus: '0.005',
      chargeId: s.ids('charges', 1)[0],
      compensationsEmployerPercentage: 8.33,
      employer: SECOND_EMPLOYER,
      hourlyRate: '120',
      jobPercentage: 80.125,
      pensionEmployeePercentage: 6.66666666,
      pensionFundId: TRAINING_FUND,
      vacationTakeout: -1.5,
      zkufot: 130,
    },
    // every parameter NULL: the row comes back unchanged
    {
      month: '2024-01',
      employeeId: EMPLOYEE_TWO,
      ...Object.fromEntries(
        Object.keys(emptyRecord)
          .filter(k => !['ownerId', 'employee', 'month', 'employeeId'].includes(k))
          .map(k => [k, null]),
      ),
    },
    { month: '2023-01', employeeId: EMPLOYEE_ONE, bonus: 5 },
    { month: null, employeeId: EMPLOYEE_ONE, bonus: 5 },
    { month: '2024-02', employeeId: EMPLOYEE_ONE, chargeId: s.missingId }, // 23503
    { month: '2024-02', employeeId: EMPLOYEE_TWO, jobPercentage: 1000 }, // numeric(5,2) overflow
  ]),
};
