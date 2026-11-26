import type {
  IGetBankDepositsByChargeIdsQuery,
  IGetDepositTransactionsByChargeIdQuery,
  IGetTransactionsByBankDepositsQuery,
  IUnlinkChargesFromBankDepositsByChargeIdsQuery,
  IUpsertBankDepositChargeQuery,
} from '../../../../../modules/bank-deposits/__generated__/bank-deposit-charges.types.js';
import { caseFor, type Cases } from '../../../cases.js';
import { FX } from '../../charges/_fixture-ids.js';

export const cases: Cases = {
  getTransactionsByBankDeposits: caseFor<IGetTransactionsByBankDepositsQuery>(s => [
    { depositIds: [FX.deposit1, FX.oldDeposit] },
    { depositIds: [FX.emptyDeposit, s.missingId] },
  ]),

  getBankDepositsByChargeIds: caseFor<IGetBankDepositsByChargeIdsQuery>(s => [
    { chargeIds: [FX.deposit2024, FX.depositClose, FX.oldDepositFees, FX.officeSupplies] },
    { chargeIds: [s.missingId] },
  ]),

  getDepositTransactionsByChargeId: caseFor<IGetDepositTransactionsByChargeIdQuery>(s => [
    { chargeId: FX.deposit2024, includeCharge: true },
    { chargeId: FX.deposit2024, includeCharge: false },
    { chargeId: FX.depositClose, includeCharge: null },
    // a deposit whose only charge has no transactions: one row with NULL transaction columns
    { chargeId: FX.oldDepositFees, includeCharge: true },
    { chargeId: FX.oldDepositFees, includeCharge: false },
    { chargeId: FX.officeSupplies, includeCharge: true },
    { chargeId: s.missingId, includeCharge: true },
  ]),

  upsertBankDepositCharge: caseFor<IUpsertBankDepositChargeQuery>(s => [
    // new link
    {
      chargeId: FX.hardware,
      depositId: FX.emptyDeposit,
      ownerId: s.businessId,
      accountId: FX.depositAccount,
    },
    // existing link: updated
    {
      chargeId: FX.deposit2024,
      depositId: FX.oldDeposit,
      ownerId: s.businessId,
      accountId: FX.bank1,
    },
    // unknown charge
    {
      chargeId: s.missingId,
      depositId: FX.deposit1,
      ownerId: s.businessId,
      accountId: FX.depositAccount,
    },
    // NOT NULL account
    { chargeId: FX.retainer, depositId: FX.deposit1, ownerId: s.businessId, accountId: null },
  ]),

  unlinkChargesFromBankDepositsByChargeIds: caseFor<IUnlinkChargesFromBankDepositsByChargeIdsQuery>(
    s => [{ chargeIds: [FX.deposit2024, FX.oldDepositFees] }, { chargeIds: [s.missingId] }],
  ),
};
