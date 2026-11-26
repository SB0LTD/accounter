import { otsarCreditCardRow, otsarForeignRow, otsarIlsRow } from '../_case-rows.js';
import type {
  IFetchOtsarHahayalCreditCardByKeysQuery,
  IFetchOtsarHahayalForeignByKeysQuery,
  IFetchOtsarHahayalIlsByKeysQuery,
  IUploadOtsarHahayalCreditCardTransactionsQuery,
  IUploadOtsarHahayalForeignTransactionsQuery,
  IUploadOtsarHahayalIlsTransactionsQuery,
} from '../../../../../modules/scraper-ingestion/__generated__/otsar-hahayal-scraper-ingestion.types.js';
import { caseFor, type Cases } from '../../../cases.js';

/** 'עמלת מטח' (an FX fee, which the ILS trigger flags) */
const FX_FEE = 'עמלת מטח ';

export const cases: Cases = {
  fetchOtsarHahayalIlsByKeys: caseFor<IFetchOtsarHahayalIlsByKeysQuery>(() => [
    {
      accountNumbers: [445566],
      branchNumbers: [12],
      dateOfRegistrations: ['2026-11-04T00:00:00'],
    },
    {
      accountNumbers: [445566, 1],
      branchNumbers: [12],
      dateOfRegistrations: [new Date('2026-11-04T00:00:00Z'), '2026-11-05T00:00:00'],
    },
    { accountNumbers: [445566], branchNumbers: [13], dateOfRegistrations: ['2026-11-04'] },
    { accountNumbers: [445566], branchNumbers: [12], dateOfRegistrations: [] },
  ]),

  uploadOtsarHahayalIlsTransactions: caseFor<IUploadOtsarHahayalIlsTransactionsQuery>(s => [
    // a credit with a correspondent account, and a debit that is an FX fee
    {
      transactions: [
        otsarIlsRow(s.businessId),
        otsarIlsRow(s.businessId, {
          reference: 457,
          creditAmount: 0,
          debitAmount: '35.5',
          description: FX_FEE,
          correspondentAccount: 0,
          name: '   ',
          customerName: '',
          transactionReason: '',
        }),
      ],
    },
    // the fixture row's conflict key
    {
      transactions: [
        otsarIlsRow(s.businessId, {
          dateOfRegistration: '2026-11-04T00:00:00',
          dateOfBusinessDay: '2026-11-04T00:00:00',
          reference: 123,
          creditAmount: 0,
          debitAmount: 250,
        }),
        otsarIlsRow(s.businessId, { reference: 458 }),
      ],
    },
    // no such account / an account without an owner: RAISE
    { transactions: [otsarIlsRow(s.businessId, { accountNumber: 445599 })] },
    { transactions: [otsarIlsRow(s.businessId, { accountNumber: 445567 })] },
    // another tenant's row (RLS)
    { transactions: [otsarIlsRow(s.missingId)] },
    // an explicit NULL origin_reference does not take the column default
    { transactions: [otsarIlsRow(s.businessId, { originReference: null })] },
  ]),

  fetchOtsarHahayalForeignByKeys: caseFor<IFetchOtsarHahayalForeignByKeysQuery>(() => [
    { accounts: [778899], branches: [12], dates: ['2026-11-05'], references: ['REF-1'] },
    { accounts: [778899], branches: [12], dates: ['2026-11-05'], references: ['REF-9'] },
    {
      accounts: [778899, 778800],
      branches: [12, 13],
      dates: ['2026-11-05'],
      references: ['REF-1'],
    },
  ]),

  uploadOtsarHahayalForeignTransactions: caseFor<IUploadOtsarHahayalForeignTransactionsQuery>(s => [
    {
      transactions: [
        otsarForeignRow(s.businessId),
        otsarForeignRow(s.businessId, {
          reference: 'REF-3',
          credit: 0,
          debit: '4.2',
          balance: 195.8,
          description: 'עמלת העברות SWIFT',
          currency: 'USD',
        }),
      ],
    },
    // the fixture row's conflict key
    {
      transactions: [
        otsarForeignRow(s.businessId, {
          reference: 'REF-1',
          date: '2026-11-05',
          valueDate: '2026-11-05',
          description: 'עמלה בגין העברה',
        }),
      ],
    },
    // no bank account 778801, and 778800 is a card: the RAISE itself fails (42703)
    { transactions: [otsarForeignRow(s.businessId, { account: 778801 })] },
    { transactions: [otsarForeignRow(s.businessId, { account: 778800 })] },
    // not a currency
    { transactions: [otsarForeignRow(s.businessId, { currency: 'XYZ' })] },
    // jsonb from a JS array: pg sends an array literal, which is not JSON
    { transactions: [otsarForeignRow(s.businessId, { subTransactions: [{ amount: 1 }] })] },
    // ...unless it is empty ('{}')
    { transactions: [otsarForeignRow(s.businessId, { reference: 'REF-4', subTransactions: [] })] },
  ]),

  fetchOtsarHahayalCreditCardByKeys: caseFor<IFetchOtsarHahayalCreditCardByKeysQuery>(() => [
    {
      resourceIds: ['0f030000-0000-4000-8000-000000000201'],
      cardTypes: [1],
      dates: ['2026-11-03'],
    },
    {
      resourceIds: ['0f030000-0000-4000-8000-000000000201'],
      cardTypes: [2],
      dates: ['2026-11-03'],
    },
  ]),

  uploadOtsarHahayalCreditCardTransactions: caseFor<IUploadOtsarHahayalCreditCardTransactionsQuery>(
    s => [
      {
        transactions: [
          otsarCreditCardRow(s.businessId),
          otsarCreditCardRow(s.businessId, {
            counter: 1,
            name: 'דמי כרטיס חודשיים',
            notes: '',
            chargeAmount: 9.9,
            chargeCurrency: 'שקל חדש',
          }),
          otsarCreditCardRow(s.businessId, { counter: 2, chargeCurrency: 'אירו', notes: '  ' }),
        ],
      },
      // the fixture row's conflict key
      {
        transactions: [
          otsarCreditCardRow(s.businessId, {
            date: '2026-11-03',
            chargeDate: '2026-11-10',
            dealAmount: 15,
            dealCurrency: 'ILS',
            name: 'דמי כרטיס',
            notes: '',
            counter: 0,
          }),
        ],
      },
      // unknown charge currency, a card without an owner: RAISE
      { transactions: [otsarCreditCardRow(s.businessId, { chargeCurrency: 'ין' })] },
      { transactions: [otsarCreditCardRow(s.businessId, { maskedPan: '5326-2222' })] },
      // an explicit NULL notes does not take the column default
      { transactions: [otsarCreditCardRow(s.businessId, { notes: null })] },
    ],
  ),
};
