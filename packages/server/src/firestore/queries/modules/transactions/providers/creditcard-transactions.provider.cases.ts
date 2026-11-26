import type {
  IGetCreditCardTransactionsByChargeIdsQuery,
  IValidateCreditCardTransactionsAmountByChargeIdsQuery,
} from '../../../../../modules/transactions/__generated__/creditcard-transactions.types.js';
import { caseFor, type Cases, type Snapshot } from '../../../cases.js';
import { FX } from '../../charges/_fixture-ids.js';

/** Charges of the bank debits the Poalim insert trigger created for card 4580 (generated ids). */
const poalimCardDebitCharges = (s: Snapshot) =>
  s
    .rows('transactions')
    .filter(t => t.source_origin === 'POALIM' && t.source_reference === '4580')
    .map(t => t.charge_id as string);

export const cases: Cases = {
  getCreditCardTransactionsByChargeIds: caseFor<IGetCreditCardTransactionsByChargeIdsQuery>(s => [
    // matched by card number; and by card name in the description
    { chargeIds: [FX.visaDebit] },
    { chargeIds: [FX.maxDebit] },
    // no card transactions to pay: one all-NULL row per origin
    { chargeIds: [FX.cardPurchases, FX.officeSupplies] },
    { chargeIds: [...poalimCardDebitCharges(s), FX.visaDebit] },
    { chargeIds: [s.missingId] },
  ]),

  validateCreditCardTransactionsAmountByChargeIds:
    caseFor<IValidateCreditCardTransactionsAmountByChargeIdsQuery>(s => [
      { chargeIds: [FX.visaDebit, FX.maxDebit] },
      { chargeIds: [...poalimCardDebitCharges(s)] },
      { chargeIds: [FX.cardPurchases, FX.officeSupplies, FX.demoJanuary] },
      { chargeIds: [s.missingId] },
    ]),
};
