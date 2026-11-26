import type {
  IGetEmployeesByEmployerQuery,
  IGetEmployeesByEmployerResult,
  IGetEmployeesByIdQuery,
  IGetEmployeesByIdResult,
} from '../../../../../modules/salaries/__generated__/employees.types.js';
import { port } from '../../../port.js';

// Date columns are 'YYYY-MM-DD' strings in rows; pgTyped types them as TimelessDateString.

/** SELECT * FROM employees WHERE employer IN $$employerIDs */
export const getEmployeesByEmployer = port<IGetEmployeesByEmployerQuery>(
  async ({ employerIDs }, db) =>
    (await db.whereIn(
      'employees',
      'employer',
      employerIDs,
    )) as readonly IGetEmployeesByEmployerResult[],
);

/** SELECT * FROM employees WHERE business_id IN $$employeeIDs */
export const getEmployeesById = port<IGetEmployeesByIdQuery>(
  async ({ employeeIDs }, db) =>
    (await db.whereIn('employees', 'business_id', employeeIDs)) as readonly IGetEmployeesByIdResult[],
);
