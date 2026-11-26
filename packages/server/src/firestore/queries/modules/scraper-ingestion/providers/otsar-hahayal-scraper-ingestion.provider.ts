import { insertValues, selectWhereAny } from '../_helpers.js';
import type {
  IFetchOtsarHahayalCreditCardByKeysQuery,
  IFetchOtsarHahayalForeignByKeysQuery,
  IFetchOtsarHahayalIlsByKeysQuery,
  IUploadOtsarHahayalCreditCardTransactionsQuery,
  IUploadOtsarHahayalForeignTransactionsQuery,
  IUploadOtsarHahayalIlsTransactionsQuery,
} from '../../../../../modules/scraper-ingestion/__generated__/otsar-hahayal-scraper-ingestion.types.js';
import { port } from '../../../port.js';

/**
 * SELECT 29 columns FROM otsar_hahayal_ils_account_transactions
 * WHERE account_number = ANY($accountNumbers!)
 *   AND branch_number = ANY($branchNumbers!)
 *   AND date_of_registration = ANY($dateOfRegistrations!)
 */
export const fetchOtsarHahayalIlsByKeys = port<IFetchOtsarHahayalIlsByKeysQuery>(
  async ({ accountNumbers, branchNumbers, dateOfRegistrations }, db) =>
    selectWhereAny(
      db,
      'otsar_hahayal_ils_account_transactions',
      [
        'id',
        'account_number',
        'branch_number',
        'date_of_registration',
        'action_code',
        'bfb_source',
        'closing_balance',
        'correspondent_account',
        'correspondent_account_type',
        'correspondent_bank',
        'correspondent_branch',
        'credit_amount',
        'customer_name',
        'date_of_business_day',
        'debit_amount',
        'depositor_id',
        'description',
        'drill_down_url',
        'drill_down_data',
        'first_transaction_of_day',
        'last_transaction_of_day',
        'name',
        'opening_balance',
        'operation_source',
        'reference',
        'salary_ind',
        'transaction_source',
        'transaction_reason',
        'origin_reference',
      ],
      [
        ['account_number', accountNumbers],
        ['branch_number', branchNumbers],
        ['date_of_registration', dateOfRegistrations],
      ],
    ) as never,
);

/**
 * INSERT INTO otsar_hahayal_ils_account_transactions (<30 columns>) VALUES $$transactions(...)
 * ON CONFLICT (account_number, branch_number, date_of_registration, date_of_business_day, reference, origin_reference, credit_amount, debit_amount) DO NOTHING
 * RETURNING id, account_number, branch_number, date_of_registration, description, credit_amount, debit_amount
 */
export const uploadOtsarHahayalIlsTransactions = port<IUploadOtsarHahayalIlsTransactionsQuery>(
  async ({ transactions }, db) =>
    insertValues(db, {
      table: 'otsar_hahayal_ils_account_transactions',
      values: {
        account_number: 'accountNumber',
        account_type: 'accountType',
        branch_number: 'branchNumber',
        action_code: 'actionCode',
        bfb_source: 'bfbSource',
        closing_balance: 'closingBalance',
        correspondent_account: 'correspondentAccount',
        correspondent_account_type: 'correspondentAccountType',
        correspondent_bank: 'correspondentBank',
        correspondent_branch: 'correspondentBranch',
        credit_amount: 'creditAmount',
        customer_name: 'customerName',
        date_of_business_day: 'dateOfBusinessDay',
        date_of_registration: 'dateOfRegistration',
        debit_amount: 'debitAmount',
        depositor_id: 'depositorId',
        description: 'description',
        drill_down_url: 'drillDownUrl',
        drill_down_data: 'drillDownData',
        first_transaction_of_day: 'firstTransactionOfDay',
        last_transaction_of_day: 'lastTransactionOfDay',
        name: 'name',
        opening_balance: 'openingBalance',
        operation_source: 'operationSource',
        reference: 'reference',
        salary_ind: 'salaryInd',
        transaction_source: 'transactionSource',
        transaction_reason: 'transactionReason',
        origin_reference: 'originReference',
        owner_id: 'ownerId',
      },
      rows: transactions,
      onConflict: {
        target: [
          'account_number',
          'branch_number',
          'date_of_registration',
          'date_of_business_day',
          'reference',
          'origin_reference',
          'credit_amount',
          'debit_amount',
        ],
        action: 'nothing',
      },
      returning: [
        'id',
        'account_number',
        'branch_number',
        'date_of_registration',
        'description',
        'credit_amount',
        'debit_amount',
      ],
    }) as never,
);

/**
 * SELECT 15 columns FROM otsar_hahayal_foreign_account_transactions
 * WHERE account = ANY($accounts!)
 *   AND branch = ANY($branches!)
 *   AND date = ANY($dates!)
 *   AND reference = ANY($references!)
 */
export const fetchOtsarHahayalForeignByKeys = port<IFetchOtsarHahayalForeignByKeysQuery>(
  async ({ accounts, branches, dates, references }, db) =>
    selectWhereAny(
      db,
      'otsar_hahayal_foreign_account_transactions',
      [
        'id',
        'account',
        'branch',
        'account_type',
        'currency',
        'opening_balance',
        'balance',
        'value_date',
        'credit',
        'debit',
        'description',
        'sp',
        'reference',
        'date',
        'sub_transactions',
      ],
      [
        ['account', accounts],
        ['branch', branches],
        ['date', dates],
        ['reference', references],
      ],
    ) as never,
);

/**
 * INSERT INTO otsar_hahayal_foreign_account_transactions (<15 columns>) VALUES $$transactions(...)
 * ON CONFLICT (account, branch, date, value_date, reference, description) DO NOTHING
 * RETURNING id, account, branch, currency, date, description, credit, debit
 */
export const uploadOtsarHahayalForeignTransactions =
  port<IUploadOtsarHahayalForeignTransactionsQuery>(
    async ({ transactions }, db) =>
      insertValues(db, {
        table: 'otsar_hahayal_foreign_account_transactions',
        values: {
          account: 'account',
          branch: 'branch',
          account_type: 'accountType',
          currency: 'currency',
          opening_balance: 'openingBalance',
          balance: 'balance',
          value_date: 'valueDate',
          credit: 'credit',
          debit: 'debit',
          description: 'description',
          sp: 'sp',
          reference: 'reference',
          date: 'date',
          sub_transactions: 'subTransactions',
          owner_id: 'ownerId',
        },
        rows: transactions,
        onConflict: {
          target: ['account', 'branch', 'date', 'value_date', 'reference', 'description'],
          action: 'nothing',
        },
        returning: [
          'id',
          'account',
          'branch',
          'currency',
          'date',
          'description',
          'credit',
          'debit',
        ],
      }) as never,
  );

/**
 * SELECT 15 columns FROM otsar_hahayal_creditcard_transactions
 * WHERE resource_id = ANY($resourceIds!)
 *   AND card_type = ANY($cardTypes!)
 *   AND date = ANY($dates!)
 */
export const fetchOtsarHahayalCreditCardByKeys = port<IFetchOtsarHahayalCreditCardByKeysQuery>(
  async ({ resourceIds, cardTypes, dates }, db) =>
    selectWhereAny(
      db,
      'otsar_hahayal_creditcard_transactions',
      [
        'id',
        'resource_id',
        'masked_pan',
        'card_type',
        'billing_period',
        'date',
        'charge_date',
        'name',
        'deal_amount',
        'charge_amount',
        'notes',
        'wallet_type',
        'charge_currency',
        'deal_currency',
        'counter',
      ],
      [
        ['resource_id', resourceIds],
        ['card_type', cardTypes],
        ['date', dates],
      ],
    ) as never,
);

/**
 * INSERT INTO otsar_hahayal_creditcard_transactions (<15 columns>) VALUES $$transactions(...)
 * ON CONFLICT (resource_id, card_type, date, charge_date, deal_amount, deal_currency, name, notes, counter) DO NOTHING
 * RETURNING id, resource_id, date, name, charge_amount, charge_currency
 */
export const uploadOtsarHahayalCreditCardTransactions =
  port<IUploadOtsarHahayalCreditCardTransactionsQuery>(
    async ({ transactions }, db) =>
      insertValues(db, {
        table: 'otsar_hahayal_creditcard_transactions',
        values: {
          resource_id: 'resourceId',
          masked_pan: 'maskedPan',
          card_type: 'cardType',
          billing_period: 'dealGroup',
          date: 'date',
          charge_date: 'chargeDate',
          name: 'name',
          deal_amount: 'dealAmount',
          charge_amount: 'chargeAmount',
          notes: 'notes',
          wallet_type: 'walletType',
          charge_currency: 'chargeCurrency',
          deal_currency: 'dealCurrency',
          counter: 'counter',
          owner_id: 'ownerId',
        },
        rows: transactions,
        onConflict: {
          target: [
            'resource_id',
            'card_type',
            'date',
            'charge_date',
            'deal_amount',
            'deal_currency',
            'name',
            'notes',
            'counter',
          ],
          action: 'nothing',
        },
        returning: ['id', 'resource_id', 'date', 'name', 'charge_amount', 'charge_currency'],
      }) as never,
  );
