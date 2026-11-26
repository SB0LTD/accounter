import type {
  IGetEmployeesByEmployerQuery,
  IGetEmployeesByIdQuery,
} from '../../../../../modules/salaries/__generated__/employees.types.js';
import { caseFor, type Cases } from '../../../cases.js';

// Fixture rows (scripts/firestore/fixtures/090-accounts-salaries.sql)
const ID = (n: number) => `0f090000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const EMPLOYEE_ONE = ID(101);
const EMPLOYEE_THREE = ID(103);
const SECOND_EMPLOYER = ID(131);

export const cases: Cases = {
  getEmployeesByEmployer: caseFor<IGetEmployeesByEmployerQuery>(s => [
    { employerIDs: [s.businessId] },
    { employerIDs: [SECOND_EMPLOYER, s.missingId] },
    { employerIDs: [null, s.businessId, SECOND_EMPLOYER] },
    { employerIDs: [s.missingId] },
  ]),
  getEmployeesById: caseFor<IGetEmployeesByIdQuery>(s => [
    { employeeIDs: [EMPLOYEE_ONE, EMPLOYEE_THREE] },
    { employeeIDs: s.values('employees', 'business_id', 10) as string[] },
    { employeeIDs: [s.missingId] },
  ]),
};
