import {
  CANCELLED,
  DISTRIBUTION,
  DIVIDEND,
  DIVIDEND_IN_KIND,
  DIVIDEND_PAYMENT,
  E,
  linkedCharge,
  otherOwner,
} from '../_fixture.js';
import type {
  IGetChargeIdsByExecutionIdsQuery,
  IGetExecutionIdsByChargeIdsQuery,
  IGetUnlinkedDistributionsParams,
  IGetUnlinkedDistributionsQuery,
  IInsertChargeSecurityExecutionQuery,
  IReplaceChargeSecurityExecutionsChargeIdQuery,
} from '../../../../../modules/foreign-securities/__generated__/security-execution-charges.types.js';
import { caseFor, type Cases, type Snapshot } from '../../../cases.js';

const distributions = (s: Snapshot): IGetUnlinkedDistributionsParams => ({
  ownerId: s.businessId,
  tradeType: DISTRIBUTION,
  paymentType: DIVIDEND_IN_KIND,
  cancelledFlag: CANCELLED,
  ledgerLock: null,
});

export const cases: Cases = {
  getExecutionIdsByChargeIds: caseFor<IGetExecutionIdsByChargeIdsQuery>(s => [
    { chargeIds: [linkedCharge(s, 505), linkedCharge(s, 510)] }, // 510's link is hidden
    { chargeIds: [] },
    { chargeIds: [s.missingId] },
  ]),
  getChargeIdsByExecutionIds: caseFor<IGetChargeIdsByExecutionIdsQuery>(s => [
    { executionIds: [E(5), E(15), E(10), E(2)] }, // 515 dismissed (NULL charge), 510 hidden
    { executionIds: [s.missingId] },
  ]),
  replaceChargeSecurityExecutionsChargeId: caseFor<IReplaceChargeSecurityExecutionsChargeIdQuery>(
    s => [
      { replaceChargeID: linkedCharge(s, 505), assertChargeID: linkedCharge(s, 510) },
      { replaceChargeID: linkedCharge(s, 505), assertChargeID: null },
      { replaceChargeID: linkedCharge(s, 505), assertChargeID: s.missingId }, // 23503
      { replaceChargeID: linkedCharge(s, 510), assertChargeID: linkedCharge(s, 505) }, // hidden
      { replaceChargeID: s.missingId, assertChargeID: linkedCharge(s, 505) },
    ],
  ),
  getUnlinkedDistributions: caseFor<IGetUnlinkedDistributionsQuery>(s => [
    distributions(s),
    // 509's earlier date is its value date (2023-11-30)
    { ...distributions(s), ledgerLock: '2023-12-15' },
    { ...distributions(s), ledgerLock: '2023-11-30' },
    { ...distributions(s), ledgerLock: '2023-11-29' },
    { ...distributions(s), ledgerLock: '2024-07-31' },
    // a cash dividend with no size: abs(NULL) never pairs with a cancellation
    { ...distributions(s), tradeType: DIVIDEND_PAYMENT, paymentType: DIVIDEND },
    // no cancellation flag value matches: every distribution is live and none cancels
    { ...distributions(s), cancelledFlag: 'לא' },
    { ...distributions(s), ownerId: otherOwner(s) },
  ]),
  insertChargeSecurityExecution: caseFor<IInsertChargeSecurityExecutionQuery>(s => [
    { executionId: E(4), chargeId: linkedCharge(s, 505), ownerId: s.businessId },
    { executionId: E(5), chargeId: linkedCharge(s, 510), ownerId: s.businessId }, // linked: nothing
    { executionId: s.missingId, chargeId: linkedCharge(s, 505), ownerId: s.businessId }, // 23503
    { executionId: E(8), chargeId: linkedCharge(s, 505), ownerId: otherOwner(s) }, // 42501
  ]),
};
