import type {
  IGetAllFundsQuery,
  IGetAllPensionFundsQuery,
  IGetAllTrainingFundsQuery,
} from '../../../../../modules/salaries/__generated__/funds.types.js';
import { port } from '../../../port.js';

/** SELECT * FROM pension_funds WHERE pension_funds.type = 'pension' */
export const getAllPensionFunds = port<IGetAllPensionFundsQuery>(async (_params, db) =>
  (await db.rows('pension_funds')).filter(fund => fund.type === 'pension'),
);

/** SELECT * FROM pension_funds WHERE pension_funds.type = 'training_fund' */
export const getAllTrainingFunds = port<IGetAllTrainingFundsQuery>(async (_params, db) =>
  (await db.rows('pension_funds')).filter(fund => fund.type === 'training_fund'),
);

/** SELECT * FROM pension_funds */
export const getAllFunds = port<IGetAllFundsQuery>(async (_params, db) => db.rows('pension_funds'));
