/**
 * The schema's CHECK constraints as TypeScript, by constraint name. A check passes when it is true
 * or NULL, as in SQL. `checks.test.ts` fails when the catalog has a check that is not listed here.
 */
import type { AnyRow } from '../catalog.js';
import { Numeric } from '../numeric.js';

type Check = (row: AnyRow) => boolean | null;

const isNull = (v: unknown) => v === null || v === undefined;
const oneOf =
  (column: string, values: string[]): Check =>
  row =>
    isNull(row[column]) ? null : values.includes(String(row[column]));
const equals = (column: string, value: string): Check => oneOf(column, [value]);
const numericBetween =
  (column: string, min: number, max: number): Check =>
  row => {
    if (isNull(row[column])) return null;
    const n = Numeric.of(row[column] as string);
    return !n.lt(min) && !n.gt(max);
  };
const intBetween =
  (column: string, min: number, max: number): Check =>
  row =>
    isNull(row[column]) ? null : (row[column] as number) >= min && (row[column] as number) <= max;
const jsonType = (value: unknown): string =>
  value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
const firstOfMonth =
  (column: string): Check =>
  row =>
    isNull(row[column]) ? null : String(row[column]).slice(8, 10) === '01';

export const CHECKS: Record<string, Record<string, Check>> = {
  annual_audit_step_status: {
    annual_audit_step_status_status_check: oneOf('status', [
      'COMPLETED',
      'IN_PROGRESS',
      'PENDING',
      'BLOCKED',
    ]),
  },
  api_keys: {
    api_keys_revoked_at_check: row =>
      isNull(row.revoked_at) ||
      (isNull(row.created_at)
        ? null
        : (row.revoked_at as Date).getTime() > (row.created_at as Date).getTime()),
  },
  depreciation_disposals: {
    depreciation_disposals_disposed_cost_positive: row =>
      isNull(row.disposed_cost) ? null : Numeric.of(row.disposed_cost as string).gt(0),
    depreciation_disposals_proceeds_non_negative: row =>
      isNull(row.proceeds) ? null : !Numeric.of(row.proceeds as string).lt(0),
  },
  dynamic_report_comments: {
    dynamic_report_comments_content_length: row => {
      if (isNull(row.content)) return null;
      const content = String(row.content);
      const length = [...content].length;
      return length >= 1 && length <= 10_000 && /\S/u.test(content);
    },
  },
  dynamic_report_threads: {
    dynamic_report_threads_node_id_length: row => {
      if (isNull(row.node_id)) return null;
      const length = [...String(row.node_id)].length;
      return length >= 1 && length <= 200;
    },
    dynamic_report_threads_node_kind_check: oneOf('node_kind', ['leaf', 'branch']),
  },
  poalim_deposits_account_transactions: {
    data_0_hebrew_purpose_description_enum: equals(
      'data_0_hebrew_purpose_description',
      'לא רלוונטי',
    ),
    data_0_interest_base_description_enum: equals('data_0_interest_base_description', 'פריים'),
    data_0_interest_calculating_method_description_enum: equals(
      'data_0_interest_calculating_method_description',
      'קו ישר',
    ),
    data_0_interest_crediting_method_description_enum: equals(
      'data_0_interest_crediting_method_description',
      'לקרן הפיקדון',
    ),
    data_0_interest_payment_description_enum: equals('data_0_interest_payment_description', 'תחנה'),
    data_0_interest_type_description_enum: equals('data_0_interest_type_description', 'משתנה'),
    data_0_lien_description_enum: oneOf('data_0_lien_description', ['משועבד', 'מבטיח אשראי']),
    data_0_renewal_date_explanation_enum: oneOf('data_0_renewal_date_explanation', [
      'תחנה קרובה',
      'ייפרע לעו"ש בתאריך',
    ]),
    data_0_renewal_description_enum: oneOf('data_0_renewal_description', [
      'פיקדון מתחדש',
      'יפרע לעו"ש',
    ]),
    data_0_short_product_name_enum: equals('data_0_short_product_name', 'פריים'),
    data_0_time_unit_description_enum: equals('data_0_time_unit_description', 'ימים'),
    source_enum: equals('source', 'israeliCurrencyDeposit'),
  },
  price_index_bases: {
    price_index_bases_first_period_check: firstOfMonth('first_period'),
  },
  price_index_values: {
    price_index_values_period_check: firstOfMonth('period'),
  },
  report_1214_profiles: {
    report_1214_profiles_arrays_check: row =>
      jsonType(row.related_companies) === 'array' && jsonType(row.rd_investments) === 'array',
    report_1214_profiles_objects_check: row =>
      [
        'company',
        'declarations',
        'preparer',
        'attachments',
        'bank_account',
        'other_taxable_income',
        'capital_gains_summary',
        'qualifying_company',
        'amount_overrides',
      ].every(column => jsonType(row[column]) === 'object'),
    report_1214_profiles_year_check: intBetween('year', 2000, 2100),
  },
  shareholders: {
    shareholders_dividend_rights_percent_check: numericBetween('dividend_rights_percent', 0, 100),
    shareholders_id_number_check: row =>
      isNull(row.id_number) ? null : /^[0-9]{9}$/.test(String(row.id_number)),
    shareholders_other_rights_percent_check: numericBetween('other_rights_percent', 0, 100),
    shareholders_voting_rights_percent_check: numericBetween('voting_rights_percent', 0, 100),
    shareholders_year_check: intBetween('year', 2000, 2100),
  },
  transactions_raw_list: {
    transactions_raw_list_check: row =>
      [
        'creditcard_id',
        'poalim_ils_id',
        'poalim_foreign_id',
        'poalim_swift_id',
        'kraken_id',
        'etana_id',
        'etherscan_id',
        'amex_id',
        'cal_id',
        'bank_discount_id',
        'max_creditcard_id',
        'otsar_hahayal_ils_id',
        'otsar_hahayal_foreign_id',
        'otsar_hahayal_creditcard_id',
      ].filter(column => !isNull(row[column])).length === 1,
  },
  user_context: {
    user_context_securities_context_is_object: row =>
      isNull(row.securities_context) ? null : jsonType(row.securities_context) === 'object',
  },
};

/** Name of the first failing check on a row, or null when all pass. */
export function runChecks(table: string, row: AnyRow): string | null {
  const checks = CHECKS[table];
  if (!checks) return null;
  for (const [name, check] of Object.entries(checks)) {
    if (check(row) === false) return name;
  }
  return null;
}
