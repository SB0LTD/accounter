import type {
  ICalculateCreditcardDebitDateQuery,
  IFlagForeignFeeTransactionsQuery,
  IGetReferenceMergeCandidatesQuery,
} from '../../../../../modules/manual-automations/__generated__/manual-automations.types.js';
import { caseFor, type Cases } from '../../../cases.js';

// The fixture (070-charges-ledger.sql) has: transactions sharing a reference across charges
// (WIRE-555, and the demo seed's TEST-REF), Poalim foreign-securities descriptions with zero-padded
// references (English "FSEC", Hebrew with geresh), a foreign wire fee, card transactions without a
// debit date, and Poalim card-debit rows (activity 491) for card 4580.
export const cases: Cases = {
  // Many rows share a source reference (ORDER BY source_reference has ties): may come back SOFT.
  getReferenceMergeCandidates: caseFor<IGetReferenceMergeCandidatesQuery>(s => [
    { ownerId: s.businessId },
    { ownerId: s.missingId },
    { ownerId: null },
  ]),

  flagForeignFeeTransactions: caseFor<IFlagForeignFeeTransactionsQuery>(s => [
    { ownerId: s.businessId },
    { ownerId: s.missingId },
  ]),

  calculateCreditcardDebitDate: caseFor<ICalculateCreditcardDebitDateQuery>(s => [
    { ownerId: s.businessId },
    { ownerId: s.missingId },
  ]),
};
