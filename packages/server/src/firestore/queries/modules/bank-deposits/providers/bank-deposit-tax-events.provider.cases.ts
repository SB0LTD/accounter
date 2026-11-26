import type {
  IGetBankDepositsRevaluationChargeDescriptionsQuery,
  IGetPoalimDepositTaxEventsByAccountIdsQuery,
} from '../../../../../modules/bank-deposits/__generated__/bank-deposit-tax-events.types.js';
import { caseFor, type Cases } from '../../../cases.js';
import { FX } from '../../charges/_fixture-ids.js';

export const cases: Cases = {
  getPoalimDepositTaxEventsByAccountIds: caseFor<IGetPoalimDepositTaxEventsByAccountIdsQuery>(s => [
    { accountIds: [FX.depositAccount, FX.bank1] },
    // an account without bank details
    { accountIds: [FX.cc1] },
    { accountIds: [s.missingId] },
  ]),

  getBankDepositsRevaluationChargeDescriptions:
    caseFor<IGetBankDepositsRevaluationChargeDescriptionsQuery>(s => [
      { taxCategoryId: FX.revaluation },
      { taxCategoryId: FX.serviceIncome },
      { taxCategoryId: s.missingId },
      { taxCategoryId: null },
    ]),
};
