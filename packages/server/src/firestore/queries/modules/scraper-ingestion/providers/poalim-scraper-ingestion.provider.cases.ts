import {
  depositTaxEventRow,
  poalimForeignRow,
  poalimIlsConversionRow,
  poalimIlsRow,
  poalimSwiftRow,
  securityRow,
  securityTransactionRow,
} from '../_case-rows.js';
import type {
  IFetchPoalimDepositTaxEventsByKeysQuery,
  IFetchPoalimForeignByKeysQuery,
  IFetchPoalimIlsByKeysQuery,
  IFetchPoalimSecuritiesByKeysQuery,
  IFetchPoalimSecuritiesTransactionsByKeysQuery,
  IFetchPoalimSwiftByIdsQuery,
  IUploadPoalimDepositTaxEventsQuery,
  IUploadPoalimForeignTransactionsQuery,
  IUploadPoalimIlsTransactionsQuery,
  IUploadPoalimSecuritiesQuery,
  IUploadPoalimSecuritiesTransactionsQuery,
  IUploadPoalimSwiftTransactionsQuery,
} from '../../../../../modules/scraper-ingestion/__generated__/poalim-scraper-ingestion.types.js';
import { caseFor, type Cases } from '../../../cases.js';

export const cases: Cases = {
  fetchPoalimIlsByKeys: caseFor<IFetchPoalimIlsByKeysQuery>(() => [
    { accountNumbers: [112233], branchNumbers: [12], eventDates: ['2026-11-03'] },
    { accountNumbers: [112233], branchNumbers: [12], eventDates: ['2026-11-04'] },
    {
      accountNumbers: [112233, 5],
      branchNumbers: [1, 12],
      eventDates: ['2026-11-03', '2026-11-04'],
    },
  ]),

  uploadPoalimIlsTransactions: caseFor<IUploadPoalimIlsTransactionsQuery>(() => [
    // a fee (452/105) and a plain transfer
    {
      transactions: [
        poalimIlsRow(),
        poalimIlsRow({
          serialNumber: 2,
          activityTypeCode: 100,
          textCode: 1,
          eventActivityTypeCode: 1,
          eventAmount: '1000',
          contraAccountNumber: 0,
        }),
      ],
    },
    // the ILS leg of the fixture's conversion: joins that charge
    { transactions: [poalimIlsConversionRow()] },
    // the fixture row's dedup key, and a duplicate inside the statement
    {
      transactions: [
        poalimIlsRow({ eventDate: '2026-11-03', serialNumber: 1 }),
        poalimIlsRow({ serialNumber: 3 }),
        poalimIlsRow({ serialNumber: 3, eventAmount: 1 }),
      ],
    },
    // no account: the trigger's charge has no owner
    { transactions: [poalimIlsRow({ accountNumber: 999999 })] },
    // varchar(14)
    { transactions: [poalimIlsRow({ activityDescription: 'A description too long' })] },
  ]),

  fetchPoalimForeignByKeys: caseFor<IFetchPoalimForeignByKeysQuery>(() => [
    { accountNumbers: [112233], branchNumbers: [12], executingDates: ['2026-11-02', '2026-11-07'] },
    { accountNumbers: [112233], branchNumbers: [12], executingDates: ['2026-11-07'] },
    { accountNumbers: [1], branchNumbers: [12], executingDates: ['2026-11-07'] },
  ]),

  uploadPoalimForeignTransactions: caseFor<IUploadPoalimForeignTransactionsQuery>(() => [
    // a small fee (1279, 0..30) and a 884/390 conversion fee
    {
      transactions: [
        poalimForeignRow(),
        poalimForeignRow({
          eventNumber: 4,
          activityTypeCode: 884,
          originalSystemId: 390,
          referenceNumber: 889,
          eventAmount: '3.333',
          contraAccountNumber: 12345,
          contraBankNumber: 12,
          contraBranchNumber: 600,
        }),
      ],
    },
    // an EUR leg of the fixture's conversion (reference 555): joins that charge
    {
      transactions: [
        poalimForeignRow({
          eventNumber: 5,
          executingDate: '2026-11-02',
          valueDate: '2026-11-02',
          activityTypeCode: 957,
          referenceNumber: 555,
          currency: 'EUR',
          eventAmount: 920,
          eventActivityTypeCode: 1,
        }),
      ],
    },
    // the fixture row's dedup key
    {
      transactions: [
        poalimForeignRow({ executingDate: '2026-11-02', eventNumber: 1 }),
        poalimForeignRow({ eventNumber: 6 }),
      ],
    },
    // numeric(10,2) overflow
    { transactions: [poalimForeignRow({ eventAmount: 123456789 })] },
  ]),

  fetchPoalimSwiftByIds: caseFor<IFetchPoalimSwiftByIdsQuery>(() => [
    { transferCatenatedIds: ['F030-SWIFT-1'] },
    { transferCatenatedIds: ['F030-SWIFT-1', 'nope'] },
    { transferCatenatedIds: ['nope'] },
  ]),

  uploadPoalimSwiftTransactions: caseFor<IUploadPoalimSwiftTransactionsQuery>(() => [
    // a 10 USD fee; and a transfer with no fee left (value date amount above the instructed one)
    {
      transactions: [
        poalimSwiftRow(),
        poalimSwiftRow({
          transferCatenatedId: 'V030-SWIFT-2',
          swiftValueDateCurrencyAmount32A: '261109USD1000,50',
        }),
      ],
    },
    // two currencies with a rate: EUR 1000 at 1,08 = USD 1080.00, fee 5.00
    {
      transactions: [
        poalimSwiftRow({
          swiftCurrencyInstructedAmount33B: 'EUR1000,00',
          swiftValueDateCurrencyAmount32A: '261109USD1075,00',
          swiftExchangeRate36: '1,08',
        }),
      ],
    },
    // the fixture's transfer id; NULL ids are not distinct in its unique index
    {
      transactions: [
        poalimSwiftRow({ transferCatenatedId: 'F030-SWIFT-1' }),
        poalimSwiftRow({ transferCatenatedId: null }),
        poalimSwiftRow({ transferCatenatedId: null }),
      ],
    },
    // two currencies without a rate (the RAISE's SQLERRM fails: 42703)
    {
      transactions: [
        poalimSwiftRow({
          swiftCurrencyInstructedAmount33B: 'EUR1000,00',
          swiftValueDateCurrencyAmount32A: '261109USD1075,00',
        }),
      ],
    },
    // malformed amounts / currency: RAISE
    { transactions: [poalimSwiftRow({ swiftCurrencyInstructedAmount33B: 'US' })] },
    { transactions: [poalimSwiftRow({ swiftCurrencyInstructedAmount33B: 'XXX1,00' })] },
    { transactions: [poalimSwiftRow({ swiftValueDateCurrencyAmount32A: '261109USDabc' })] },
    // no account
    { transactions: [poalimSwiftRow({ accountNumber: 999999 })] },
  ]),

  fetchPoalimSecuritiesByKeys: caseFor<IFetchPoalimSecuritiesByKeysQuery>(() => [
    { bankNumbers: [12], branchNumbers: [12], accountNumbers: [112233], securityKeys: ['SEC-1'] },
    { bankNumbers: [12], branchNumbers: [12], accountNumbers: [112233], securityKeys: ['SEC-9'] },
  ]),

  uploadPoalimSecurities: caseFor<IUploadPoalimSecuritiesQuery>(s => [
    {
      securities: [securityRow(s.businessId), securityRow(s.businessId, { securityKey: 'SEC-3' })],
    },
    // the fixture's (owner, bank, branch, account, security_key)
    { securities: [securityRow(s.businessId, { securityKey: 'SEC-1' })] },
    // another tenant (RLS)
    { securities: [securityRow(s.missingId)] },
  ]),

  fetchPoalimSecuritiesTransactionsByKeys: caseFor<IFetchPoalimSecuritiesTransactionsByKeysQuery>(
    () => [
      {
        bankNumbers: [12],
        branchNumbers: [12],
        accountNumbers: [112233],
        securities: ['SEC-1'],
        tradeDates: ['2026-11-03'],
      },
      {
        bankNumbers: [12],
        branchNumbers: [12],
        accountNumbers: [112233],
        securities: ['SEC-1'],
        tradeDates: ['2026-11-04'],
      },
    ],
  ),

  uploadPoalimSecuritiesTransactions: caseFor<IUploadPoalimSecuritiesTransactionsQuery>(s => [
    // the fixture's execution unchanged (numeric 100.5 = 100.50): the WHERE skips it
    { transactions: [securityTransactionRow(s.businessId)] },
    // restated: DO UPDATE, inserted = false; plus a new execution, inserted = true
    {
      transactions: [
        securityTransactionRow(s.businessId, { tradePrice: '101', settlementDate: '2026-11-06' }),
        securityTransactionRow(s.businessId, { occurrence: 2, nv: 5 }),
      ],
    },
    // one key twice in a DO UPDATE statement
    {
      transactions: [
        securityTransactionRow(s.businessId, { occurrence: 3 }),
        securityTransactionRow(s.businessId, { occurrence: 3, tradePrice: 99 }),
      ],
    },
    // another tenant (RLS)
    { transactions: [securityTransactionRow(s.missingId, { occurrence: 4 })] },
  ]),

  fetchPoalimDepositTaxEventsByKeys: caseFor<IFetchPoalimDepositTaxEventsByKeysQuery>(() => [
    {
      bankNumbers: [12],
      branchNumbers: [12],
      accountNumbers: [112233],
      executingDates: ['2026-11-04'],
    },
    {
      bankNumbers: [12],
      branchNumbers: [12],
      accountNumbers: [112233],
      executingDates: ['2026-11-05'],
    },
  ]),

  uploadPoalimDepositTaxEvents: caseFor<IUploadPoalimDepositTaxEventsQuery>(s => [
    // the fixture's event unchanged: skipped
    { events: [depositTaxEventRow(s.businessId)] },
    // restated, and a new event
    {
      events: [
        depositTaxEventRow(s.businessId, { taxEventAmount: 13, debitAmount: 13 }),
        depositTaxEventRow(s.businessId, {
          eventSerialNumber: 2,
          actionTypeDescription: 'Withholding',
        }),
      ],
    },
    // another tenant (RLS)
    { events: [depositTaxEventRow(s.missingId, { eventSerialNumber: 3 })] },
  ]),
};
