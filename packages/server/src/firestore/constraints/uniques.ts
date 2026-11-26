/**
 * Unique indexes over expressions or with a WHERE clause, as key functions. A key of null means the
 * row is outside the index (its predicate is false, or a column is NULL and nulls are distinct).
 * `uniques.test.ts` fails when the catalog has a custom unique index that is not listed here.
 */
import type { TableInfo } from '../catalog.js';
import { columnsKeyFn, type KeyFn } from '../replica.js';
import { equalityKey, type StoredRow } from '../values.js';

export interface UniqueRule {
  name: string;
  /** Plain columns of the rule, for `ON CONFLICT (columns)` matching; empty for expressions. */
  columns: string[];
  keyFn: KeyFn;
}

const coalesce = (row: StoredRow, ...columns: string[]) => {
  for (const column of columns) if (row[column] != null) return row[column];
  return null;
};

/** NULLS NOT DISTINCT key over computed values. */
const keyOf = (values: unknown[]) => values.map(value => equalityKey(value) ?? '∅').join('\u0000');

const creditCardDedup: KeyFn = row =>
  keyOf([
    row.card,
    coalesce(row, 'full_purchase_date', 'full_purchase_date_outbound'),
    row.full_payment_date,
    // payment_sum is numeric: compare by value
    (() => {
      const value = coalesce(row, 'payment_sum', 'payment_sum_outbound');
      return value == null ? null : equalityKey(value, 'decimal');
    })(),
    row.voucher_number,
    coalesce(row, 'voucher_number_ratz', 'voucher_number_ratz_outbound'),
    row.supplier_id,
    row.current_payment_currency,
    coalesce(row, 'full_supplier_name_heb', 'full_supplier_name_outbound'),
    row.more_info,
    row.deal_sum,
  ]);

type RuleFactory = (info: TableInfo) => UniqueRule;

const whereNotNull =
  (column: string): RuleFactory =>
  info => ({
    name: `transactions_raw_list_${column}_uindex`,
    columns: [column],
    keyFn: columnsKeyFn(info, [column]),
  });

export const CUSTOM_UNIQUES: Record<string, Record<string, RuleFactory>> = {
  amex_creditcard_transactions: {
    amex_creditcard_transactions_dedup_uindex: () => ({
      name: 'amex_creditcard_transactions_dedup_uindex',
      columns: [],
      keyFn: creditCardDedup,
    }),
  },
  isracard_creditcard_transactions: {
    isracard_creditcard_transactions_dedup_uindex: () => ({
      name: 'isracard_creditcard_transactions_dedup_uindex',
      columns: [],
      keyFn: creditCardDedup,
    }),
  },
  bank_discount_transactions: {
    bank_discount_transactions_urn_account_uindex: info => ({
      name: 'bank_discount_transactions_urn_account_uindex',
      columns: ['urn', 'account_number'],
      keyFn: columnsKeyFn(info, ['urn', 'account_number']),
    }),
  },
  email_ingestion_alias_routing: {
    email_ingestion_alias_routing_alias_active_unique: () => ({
      name: 'email_ingestion_alias_routing_alias_active_unique',
      columns: [],
      keyFn: row =>
        row.is_active === true && row.alias != null ? String(row.alias).toLowerCase() : null,
    }),
  },
  invitations: {
    idx_invitations_unique_pending: info => {
      const key = columnsKeyFn(info, ['business_id', 'email']);
      return {
        name: 'idx_invitations_unique_pending',
        columns: ['business_id', 'email'],
        keyFn: row => (row.accepted_at == null ? key(row) : null),
      };
    },
  },
  shareholders: {
    shareholders_owner_year_id_number_key: info => {
      const key = columnsKeyFn(info, ['owner_id', 'year', 'id_number']);
      return {
        name: 'shareholders_owner_year_id_number_key',
        columns: ['owner_id', 'year', 'id_number'],
        keyFn: row =>
          row.id_number == null || ['999999964', '999999998'].includes(String(row.id_number))
            ? null
            : key(row),
      };
    },
  },
  transactions_raw_list: {
    transactions_raw_list_creditcard_id_uindex: whereNotNull('creditcard_id'),
    transactions_raw_list_otsar_hahayal_creditcard_id_uindex: whereNotNull(
      'otsar_hahayal_creditcard_id',
    ),
    transactions_raw_list_otsar_hahayal_foreign_id_uindex: whereNotNull('otsar_hahayal_foreign_id'),
    transactions_raw_list_otsar_hahayal_ils_id_uindex: whereNotNull('otsar_hahayal_ils_id'),
    transactions_raw_list_poalim_ils_id_uindex: whereNotNull('poalim_ils_id'),
  },
};

/** The custom unique rules of a table (those the catalog marks `custom`). */
export function customUniques(info: TableInfo): UniqueRule[] {
  const factories = CUSTOM_UNIQUES[info.name] ?? {};
  return info.uniques
    .filter(unique => unique.custom)
    .map(unique => {
      const factory = factories[unique.name];
      if (!factory) {
        throw new Error(`No rule for custom unique index ${info.name}.${unique.name}`);
      }
      return factory(info);
    });
}
