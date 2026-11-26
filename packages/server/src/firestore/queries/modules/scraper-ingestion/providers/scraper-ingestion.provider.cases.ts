import { calRow, discountRow, maxFixtureKey, maxRow, rateRow } from '../_case-rows.js';
import type {
  IUploadCalTransactionsQuery,
  IUploadCurrencyRatesQuery,
  IUploadDiscountTransactionsQuery,
  IUploadMaxTransactionsQuery,
} from '../../../../../modules/scraper-ingestion/__generated__/scraper-ingestion.types.js';
import { caseFor, type Cases } from '../../../cases.js';

// The raw rows' AFTER INSERT triggers run on both sides; only RETURNING is compared here
// (scripts/firestore/verify-bank-handlers.ts compares what the triggers write).
export const cases: Cases = {
  uploadCalTransactions: caseFor<IUploadCalTransactionsQuery>(() => [
    // two new rows; numeric(15,2) gets 19.9 as 19.90; no merchant id → counter account = name
    {
      transactions: [
        calRow(),
        calRow({
          trnIntId: 'V030-CAL-2',
          merchantId: null,
          trnAmt: '-5.125',
          trnCurrencySymbol: 'USD',
        }),
      ],
    },
    // the fixture row's trn_int_id: DO NOTHING; a duplicate inside the statement is skipped too
    {
      transactions: [
        calRow({ trnIntId: 'F030-CAL-1' }),
        calRow(),
        calRow({ merchantName: 'Twice' }),
      ],
    },
    // NULL trn_int_id: the trigger's transaction has no source_reference (NOT NULL)
    { transactions: [calRow({ trnIntId: null })] },
    // a card no account has: the trigger's charge has no owner (RLS)
    { transactions: [calRow({ card: 1111 })] },
    // not a currency
    { transactions: [calRow({ trnCurrencySymbol: 'NIS' })] },
    // to_date range check
    { transactions: [calRow({ trnPurchaseDate: '31/02/2026' })] },
    // varchar(255) overflow
    { transactions: [calRow({ merchantName: 'x'.repeat(256) })] },
  ]),

  uploadDiscountTransactions: caseFor<IUploadDiscountTransactionsQuery>(() => [
    {
      transactions: [
        discountRow(),
        discountRow({ urn: 'V030-URN-2', operationNumber: 7788, operationAmount: '42.1' }),
      ],
    },
    // conflict with the fixture (urn, account_number), and a duplicate inside the statement
    {
      transactions: [
        discountRow({ urn: 'F030-URN-1' }),
        discountRow({ urn: 'V030-URN-3' }),
        discountRow({ urn: 'V030-URN-3', operationAmount: 1 }),
      ],
    },
    // NULL urn is outside the partial index, but the trigger needs it (source_reference NOT NULL)
    { transactions: [discountRow({ urn: null })] },
    // same urn on another account: no conflict, but no account either (RLS on the charge)
    { transactions: [discountRow({ urn: 'F030-URN-1', accountNumber: '0309999999' })] },
    // an ISO date is out of range for to_date(.., 'DD/MM/YYYY')
    { transactions: [discountRow({ operationDate: '2026-11-12' })] },
  ]),

  uploadMaxTransactions: caseFor<IUploadMaxTransactionsQuery>(() => [
    {
      transactions: [
        maxRow(),
        maxRow({ uid: 'V030-MAX-2', merchantTaxId: '515151515', dealDataPurchaseTime: null }),
      ],
    },
    // the fixture's conflict key
    { transactions: [maxRow(maxFixtureKey), maxRow({ uid: 'V030-MAX-3' })] },
    // no account for the card: RAISE
    { transactions: [maxRow({ shortCardNumber: '1111' })] },
    // not ILS: RAISE
    { transactions: [maxRow({ originalCurrency: 'USD' })] },
    // NOT NULL column
    { transactions: [maxRow({ merchant: null })] },
  ]),

  uploadCurrencyRates: caseFor<IUploadCurrencyRatesQuery>(() => [
    { rates: [rateRow(), rateRow({ exchangeDate: '2026-11-03', usd: '3.71449', cad: 2.6 })] },
    // the fixture's date: DO NOTHING
    { rates: [rateRow({ exchangeDate: '2026-11-01' }), rateRow({ exchangeDate: '2026-11-04' })] },
    // numeric(4,3) cannot hold 12.5
    { rates: [rateRow({ usd: 12.5 })] },
  ]),
};
