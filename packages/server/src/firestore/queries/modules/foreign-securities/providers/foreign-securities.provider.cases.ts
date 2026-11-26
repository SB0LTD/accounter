import {
  APPLE_KEY,
  BUY,
  CORPORATE_ACTIONS,
  DISTRIBUTION,
  IWDA_KEY,
  linkedCharge,
  otherOwner,
  SB1,
  SB2,
  SB3,
  SELL,
} from '../_fixture.js';
import type {
  IGetFilteredSecurityExecutionsQuery,
  IGetOwnerSecurityExecutionsByTradeDatesQuery,
  IGetSecuritiesByKeysQuery,
  IGetSecurityExecutionsByBusinessIdsQuery,
  IGetSecurityExecutionsByChargeIdsQuery,
  IGetSecurityExecutionsQuery,
} from '../../../../../modules/foreign-securities/__generated__/foreign-securities.types.js';
import { caseFor, type Cases } from '../../../cases.js';

const filters = {
  businessIds: [SB1, SB2],
  isTradeTypes: 0,
  isTransactionTypes: 0,
  // pgTyped needs a non-empty list; the provider passes [null] with the flag off
  tradeTypes: [null],
  transactionTypes: [null],
  fromTradeDate: null,
  toTradeDate: null,
  limit: 5,
  offset: 0,
};

export const cases: Cases = {
  getSecuritiesByKeys: caseFor<IGetSecuritiesByKeysQuery>(s => [
    // 1105467 is held in two accounts: the freshest scrape wins
    { ownerId: s.businessId, securityKeys: [APPLE_KEY, IWDA_KEY, 'nope'] },
    { ownerId: s.businessId, securityKeys: [IWDA_KEY] },
    { ownerId: s.businessId, securityKeys: [] },
    { ownerId: otherOwner(s), securityKeys: [APPLE_KEY] }, // hidden by RLS
  ]),
  getSecurityExecutions: caseFor<IGetSecurityExecutionsQuery>(() => [
    {
      securities: [APPLE_KEY, IWDA_KEY],
      bankNumbers: [12],
      branchNumbers: [600],
      accountNumbers: [123456],
      fromDate: '2024-01-11',
      toDate: '2024-06-30',
    },
    // COALESCE(value_date, trade_date) >= fromDate
    {
      securities: [APPLE_KEY],
      bankNumbers: [12],
      branchNumbers: [600],
      accountNumbers: [123456, 654321],
      fromDate: '2024-01-12',
      toDate: '2024-12-31',
    },
    {
      securities: [APPLE_KEY, '9999999'],
      bankNumbers: [12, 11],
      branchNumbers: [600, 601],
      accountNumbers: [123456, 777777],
      fromDate: '2023-01-01',
      toDate: '2024-03-15',
    },
    {
      securities: [APPLE_KEY],
      bankNumbers: [10],
      branchNumbers: [600],
      accountNumbers: [123456],
      fromDate: '2023-01-01',
      toDate: '2025-01-01',
    },
  ]),
  getSecurityExecutionsByBusinessIds: caseFor<IGetSecurityExecutionsByBusinessIdsQuery>(s => [
    { businessIds: [SB1] },
    { businessIds: [SB1, SB2] },
    { businessIds: [SB3] }, // another business's identifier: hidden
    { businessIds: [s.missingId] },
  ]),
  getFilteredSecurityExecutions: caseFor<IGetFilteredSecurityExecutionsQuery>(() => [
    filters,
    { ...filters, offset: 5 },
    { ...filters, limit: 100, offset: 0 },
    { ...filters, offset: 100 }, // past the end: no rows, so no total either
    { ...filters, isTradeTypes: 1, tradeTypes: [BUY, SELL] },
    { ...filters, isTradeTypes: null, tradeTypes: [BUY] }, // NULL flag: only the list counts
    { ...filters, isTradeTypes: null, tradeTypes: [null] }, // nothing passes
    { ...filters, isTransactionTypes: 1, transactionTypes: [CORPORATE_ACTIONS], limit: '3' },
    { ...filters, fromTradeDate: '2024-03-15', toTradeDate: '2024-07-03' },
    {
      ...filters,
      businessIds: [SB2],
      isTradeTypes: 1,
      tradeTypes: [DISTRIBUTION],
      toTradeDate: '2024-07-01',
    },
    { ...filters, businessIds: [SB3] },
    { ...filters, limit: -1 }, // 2201W
    { ...filters, offset: -1 }, // 2201X
  ]),
  getOwnerSecurityExecutionsByTradeDates: caseFor<IGetOwnerSecurityExecutionsByTradeDatesQuery>(
    s => [
      // 9999999 has no identifier: the LEFT JOIN leaves its business NULL
      {
        ownerId: s.businessId,
        fromDate: '2024-01-01',
        toDate: '2024-12-31',
        tradeTypes: [DISTRIBUTION, BUY],
      },
      { ownerId: s.businessId, fromDate: '2024-01-10', toDate: '2024-01-10', tradeTypes: [BUY] },
      { ownerId: s.businessId, fromDate: '2024-01-01', toDate: '2024-12-31', tradeTypes: [null] },
      {
        ownerId: otherOwner(s),
        fromDate: '2020-01-01',
        toDate: '2030-12-31',
        tradeTypes: [DISTRIBUTION],
      },
    ],
  ),
  getSecurityExecutionsByChargeIds: caseFor<IGetSecurityExecutionsByChargeIdsQuery>(s => [
    { chargeIds: [linkedCharge(s, 505)] },
    { chargeIds: [linkedCharge(s, 505), linkedCharge(s, 510)] }, // 510's link is another business's
    { chargeIds: [] },
    { chargeIds: [s.missingId] },
  ]),
};
