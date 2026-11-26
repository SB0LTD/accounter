/**
 * AFTER INSERT handlers of the raw bank and card tables (the `insert_*_transaction_handler`
 * functions): file the raw row in `transactions_raw_list`, find the account and its owner, match or
 * create the charge, and create the transaction.
 *
 * Each handler is a port of its PL/pgSQL function; see `docs/firestore/design.md`.
 */
import type { Transaction } from '../transaction.js';
import type { StoredRow } from '../values.js';

export type InsertHandler = (tx: Transaction, row: StoredRow) => Promise<void>;

const notPorted =
  (fn: string): InsertHandler =>
  async () => {
    throw new Error(`Firestore store: trigger function ${fn} is not ported yet`);
  };

export const BANK_INSERT_HANDLERS: Record<string, InsertHandler> = {
  amex_creditcard_transactions: notPorted('insert_amex_transaction_handler'),
  bank_discount_transactions: notPorted('insert_bank_discount_transaction_handler'),
  cal_creditcard_transactions: notPorted('insert_cal_creditcard_transaction_handler'),
  isracard_creditcard_transactions: notPorted('insert_creditcard_transaction_handler'),
  max_creditcard_transactions: notPorted('insert_max_creditcard_transaction_handler'),
  otsar_hahayal_creditcard_transactions: notPorted(
    'insert_otsar_hahayal_creditcard_transaction_handler',
  ),
  otsar_hahayal_foreign_account_transactions: notPorted(
    'insert_otsar_hahayal_foreign_transaction_handler',
  ),
  otsar_hahayal_ils_account_transactions: notPorted('insert_otsar_hahayal_ils_transaction_handler'),
  poalim_foreign_account_transactions: notPorted('insert_poalim_foreign_transaction_handler'),
  poalim_ils_account_transactions: notPorted('insert_poalim_ils_transaction_handler'),
  poalim_swift_account_transactions: notPorted('insert_poalim_swift_transaction_handler'),
};
