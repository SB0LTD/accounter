import { isracardAbroadRow, isracardFixtureRow, isracardRow } from '../_case-rows.js';
import type {
  IFetchAmexByCardsQuery,
  IFetchIsracardByCardsQuery,
  IUploadAmexTransactionsQuery,
  IUploadIsracardTransactionsQuery,
} from '../../../../../modules/scraper-ingestion/__generated__/isracard-amex-scraper-ingestion.types.js';
import { caseFor, type Cases } from '../../../cases.js';

/** 'דמי כרטיס הנחה': a zero card fee line the trigger leaves out */
const CARD_FEE_LINE = 'דמי כרטיס הנחה';

const uploads = (card: number) => [
  // domestic and abroad rows; numeric(8,2) and numeric(9,2) get their scale
  {
    transactions: [
      isracardRow({ card }),
      isracardAbroadRow({ card }),
      isracardRow({ card, voucherNumber: 555003, supplierId: null, currencyId: 'EUR' }),
    ],
  },
  // summary and zero-fee lines are stored but not filed (the trigger's filter)
  {
    transactions: [
      isracardAbroadRow({ card, fullSupplierNameOutbound: 'TOTAL FOR DATE' }),
      isracardRow({ card, voucherNumber: 555004, supplierName: CARD_FEE_LINE, paymentSum: 0 }),
      isracardRow({ card, voucherNumber: 555005, supplierName: CARD_FEE_LINE, paymentSum: null }),
    ],
  },
  // the dedup index (NULLS NOT DISTINCT over COALESCE expressions): a second identical row in the
  // statement is skipped
  { transactions: [isracardRow({ card }), isracardRow({ card, paymentSum: '64.300' })] },
  // both purchase dates set: the trigger's event_date is NULL
  { transactions: [isracardRow({ card, fullPurchaseDateOutbound: '08/11/2026' })] },
  // no voucher number: the trigger's source_reference is NULL
  { transactions: [isracardAbroadRow({ card, voucherNumber: null })] },
  // bit(1) takes '0'/'1' only
  { transactions: [isracardRow({ card, tablePageNum: true })] },
];

export const cases: Cases = {
  fetchIsracardByCards: caseFor<IFetchIsracardByCardsQuery>(() => [
    { cards: [1234] },
    { cards: [1234, 5678, 9999] },
    { cards: [9999] },
    { cards: [] },
  ]),
  uploadIsracardTransactions: caseFor<IUploadIsracardTransactionsQuery>(() => [
    ...uploads(1234),
    // the fixture row's dedup key
    { transactions: [isracardFixtureRow(), isracardRow({ voucherNumber: 555006 })] },
  ]),
  fetchAmexByCards: caseFor<IFetchAmexByCardsQuery>(() => [
    { cards: [5678] },
    { cards: [1234] },
    { cards: [5678, 1234] },
  ]),
  uploadAmexTransactions: caseFor<IUploadAmexTransactionsQuery>(() => [
    ...uploads(5678),
    // the amex fixture row's dedup key
    {
      transactions: [
        isracardAbroadRow({
          card: 5678,
          cardIndex: 1,
          voucherNumber: 777002,
          voucherNumberRatzOutbound: 777,
          supplierNameOutbound: 'AMAZON',
          fullSupplierNameOutbound: 'AMAZON MKTPL',
          city: 'SEATTLE',
          fullPurchaseDateOutbound: '06/11/2026',
          dealSumOutbound: 33.25,
          paymentSumOutbound: 33.25,
        }),
      ],
    },
    // no account for this card
    { transactions: [isracardRow({ card: 4321 })] },
  ]),
};
