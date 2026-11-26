import type { IGetNormalizedBalanceTransactionsQuery } from '../../../../../modules/reports/__generated__/balance-report.types.js';
import { caseFor, type Cases } from '../../../cases.js';

export const cases: Cases = {
  getNormalizedBalanceTransactions: caseFor<IGetNormalizedBalanceTransactionsQuery>(s => [
    // ranges whose amounts are all distinct, so ORDER BY amount is total
    { ownerId: s.businessId, fromDate: '2024-06-01', toDate: '2024-06-30' }, // EUR, ETH, USDC, USD, fee
    { ownerId: s.businessId, fromDate: '2024-07-01', toDate: '2024-07-10' }, // GBP by timestamp, SEK
    { ownerId: s.businessId, fromDate: '2024-10-02', toDate: '2024-11-14' }, // JPY override, GRT
    { ownerId: s.businessId, fromDate: '2024-11-15', toDate: '2024-11-20' }, // ILS, USD
    { ownerId: s.businessId, fromDate: '2024-12-30', toDate: '2024-12-31' }, // CAD by event date, ILS
    { ownerId: s.businessId, fromDate: '2024-01-03', toDate: '2024-01-14' }, // ILS before any rate
    { ownerId: s.businessId, fromDate: '2024-03-01', toDate: '2024-03-10' }, // AUD
    // the whole year: the demo's monthly USD -500.00 lines tie on amount (SOFT, order undefined)
    { ownerId: s.businessId, fromDate: '2024-01-01', toDate: '2024-12-31' },
    // no rows
    { ownerId: s.missingId, fromDate: '2024-01-01', toDate: '2024-12-31' },
    { ownerId: s.businessId, fromDate: null, toDate: '2024-12-31' },
    { ownerId: s.businessId, fromDate: '2024-12-31', toDate: '2024-01-01' },
  ]),
};
