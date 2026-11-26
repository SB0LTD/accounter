import type { Row } from '../../../../catalog.js';
import type {
  IGetAllSalaryRecordsQuery,
  IGetSalaryRecordsByChargeIdsQuery,
  IGetSalaryRecordsByDatesQuery,
  IGetSalaryRecordsByMonthQuery,
  IInsertSalaryRecordsQuery,
  IUpdateSalaryRecordQuery,
} from '../../../../../modules/salaries/__generated__/salaries.types.js';
import { coalescePatch, compareValues } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';
import { typed } from '../_helpers.js';

type SalaryRow = Row<'salaries'>;

/** SELECT * FROM salaries */
export const getAllSalaryRecords = port<IGetAllSalaryRecordsQuery>(async (_params, db) =>
  db.rows('salaries'),
);

/** SELECT * FROM salaries WHERE month = $month */
export const getSalaryRecordsByMonth = port<IGetSalaryRecordsByMonthQuery>(async ({ month }, db) => {
  if (month == null) return [];
  return db.where('salaries', { month });
});

/**
 * SELECT * FROM salaries WHERE month >= $fromDate AND month <= $toDate
 *
 * `month` is text ('YYYY-MM'): compared by collation, as Postgres compares text.
 */
export const getSalaryRecordsByDates = port<IGetSalaryRecordsByDatesQuery>(
  async ({ fromDate, toDate }, db) => {
    if (fromDate == null || toDate == null) return [];
    return (await db.rows('salaries')).filter(
      row => compareValues(row.month, fromDate) >= 0 && compareValues(row.month, toDate) <= 0,
    );
  },
);

/**
 * SELECT * FROM salaries WHERE $chargeIds && ARRAY[charge_id]
 *
 * Array overlap: some non-null element of $chargeIds equals charge_id. A NULL array matches nothing.
 */
export const getSalaryRecordsByChargeIds = port<IGetSalaryRecordsByChargeIdsQuery>(
  async ({ chargeIds }, db) => {
    if (chargeIds == null) return [];
    return db.whereIn('salaries', 'charge_id', chargeIds);
  },
);

/** The salary columns an INSERT / UPDATE sets, from the camel-case parameters. */
type SalaryValues = Omit<IInsertSalaryRecordsQuery['params']['salaryRecords'][number], 'ownerId'>;

function salaryColumns(record: Partial<SalaryValues>) {
  return {
    added_vacation_days: record.addedVacationDays,
    base_salary: record.baseSalary,
    bonus: record.bonus,
    charge_id: record.chargeId,
    compensations_employer_amount: record.compensationsEmployerAmount,
    compensations_employer_percentage: record.compensationsEmployerPercentage,
    direct_payment_amount: record.directPaymentAmount,
    employee: record.employee,
    employee_id: record.employeeId,
    employer: record.employer,
    gift: record.gift,
    global_additional_hours: record.globalAdditionalHours,
    health_payment_amount: record.healthPaymentAmount,
    hourly_rate: record.hourlyRate,
    hours: record.hours,
    job_percentage: record.jobPercentage,
    month: record.month,
    pension_employee_amount: record.pensionEmployeeAmount,
    pension_employee_percentage: record.pensionEmployeePercentage,
    pension_employer_amount: record.pensionEmployerAmount,
    pension_employer_percentage: record.pensionEmployerPercentage,
    pension_fund_id: record.pensionFundId,
    recovery: record.recovery,
    sickness_days_balance: record.sicknessDaysBalance,
    social_security_amount_employee: record.socialSecurityAmountEmployee,
    social_security_amount_employer: record.socialSecurityAmountEmployer,
    tax_amount: record.taxAmount,
    training_fund_employee_amount: record.trainingFundEmployeeAmount,
    training_fund_employee_percentage: record.trainingFundEmployeePercentage,
    training_fund_employer_amount: record.trainingFundEmployerAmount,
    training_fund_employer_percentage: record.trainingFundEmployerPercentage,
    training_fund_id: record.trainingFundId,
    travel_and_subsistence: record.travelAndSubsistence,
    vacation_days_balance: record.vacationDaysBalance,
    vacation_takeout: record.vacationTakeout,
    work_days: record.workDays,
    zkufot: record.zkufot,
  };
}

/**
 * INSERT INTO salaries (owner_id, added_vacation_days, base_salary, bonus, charge_id,
 *   compensations_employer_amount, compensations_employer_percentage, direct_payment_amount,
 *   employee, employee_id, employer, gift, global_additional_hours, health_payment_amount,
 *   hourly_rate, hours, job_percentage, month, pension_employee_amount, pension_employee_percentage,
 *   pension_employer_amount, pension_employer_percentage, pension_fund_id, recovery,
 *   sickness_days_balance, social_security_amount_employee, social_security_amount_employer,
 *   tax_amount, training_fund_employee_amount, training_fund_employee_percentage,
 *   training_fund_employer_amount, training_fund_employer_percentage, training_fund_id,
 *   travel_and_subsistence, vacation_days_balance, vacation_takeout, work_days, zkufot)
 * VALUES $$salaryRecords(ownerId, addedVacationDays, ..., zkufot)
 * RETURNING *
 *
 * Every listed column is set (NULL when the parameter is), so job_percentage takes no default.
 */
export const insertSalaryRecords = port<IInsertSalaryRecordsQuery>(
  async ({ salaryRecords }, db) => {
    const inserted: SalaryRow[] = [];
    for (const record of salaryRecords) {
      const values: Record<string, unknown> = { owner_id: record.ownerId ?? null };
      for (const [column, value] of Object.entries(salaryColumns(record))) {
        values[column] = value ?? null;
      }
      const row = await db.insert('salaries', typed('salaries', values));
      if (row) inserted.push(row);
    }
    return inserted;
  },
);

/**
 * UPDATE salaries SET <column> = COALESCE($param, <column>) for every column but month,
 *   employee_id, employee and owner_id
 * WHERE month = $month AND employee_id = $employeeId
 * RETURNING *
 */
export const updateSalaryRecord = port<IUpdateSalaryRecordQuery>(async (params, db) => {
  const { month, employeeId } = params;
  if (month == null || employeeId == null) return [];
  const set: Record<string, unknown> = salaryColumns(params as Partial<SalaryValues>);
  delete set.month;
  delete set.employee_id;
  delete set.employee;
  const patch = typed('salaries', coalescePatch(set));
  const updated: SalaryRow[] = [];
  for (const row of await db.where('salaries', { month, employee_id: employeeId })) {
    updated.push(await db.update('salaries', row, patch));
  }
  return updated;
});
