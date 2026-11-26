import type {
  IGetBankDepositsByIdsQuery,
  IInsertBankDepositQuery,
  IUpdateBankDepositQuery,
} from '../../../../../modules/bank-deposits/__generated__/bank-deposits.types.js';
import { caseFor, type Cases } from '../../../cases.js';
import { FX } from '../../charges/_fixture-ids.js';

export const cases: Cases = {
  getBankDepositsByIds: caseFor<IGetBankDepositsByIdsQuery>(s => [
    { depositIds: [FX.deposit1, FX.oldDeposit, s.missingId] },
    { depositIds: [s.missingId] },
  ]),

  insertBankDeposit: caseFor<IInsertBankDepositQuery>(s => [
    {
      name: 'New deposit',
      currency: 'GBP',
      accountId: FX.depositAccount,
      openDate: '2025-01-01',
      closeDate: null,
      ownerId: s.businessId,
    },
    {
      name: 'Bare deposit',
      currency: null,
      accountId: null,
      openDate: null,
      closeDate: null,
      ownerId: s.businessId,
    },
    // NOT NULL name
    {
      name: null,
      currency: 'ILS',
      accountId: null,
      openDate: null,
      closeDate: null,
      ownerId: s.businessId,
    },
    // unknown account
    {
      name: 'x',
      currency: 'ILS',
      accountId: s.missingId,
      openDate: null,
      closeDate: null,
      ownerId: s.businessId,
    },
  ]),

  updateBankDeposit: caseFor<IUpdateBankDepositQuery>(s => [
    {
      depositId: FX.deposit1,
      name: 'Renamed',
      currency: 'USD',
      openDate: '2024-01-02',
      closeDate: '2024-12-31',
      accountId: null,
    },
    // currency keeps its value; the other columns are set as given
    {
      depositId: FX.oldDeposit,
      name: 'Old',
      currency: null,
      openDate: null,
      closeDate: null,
      accountId: FX.depositAccount,
    },
    {
      depositId: FX.oldDeposit,
      name: null,
      currency: null,
      openDate: null,
      closeDate: null,
      accountId: null,
    },
    {
      depositId: s.missingId,
      name: 'x',
      currency: null,
      openDate: null,
      closeDate: null,
      accountId: null,
    },
  ]),
};
