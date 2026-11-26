/**
 * The schema's triggers. Postgres has two kinds:
 *
 * - BEFORE UPDATE `updated_at = now()` on 13 tables (`documents` has its trigger AFTER UPDATE, where
 *   setting NEW does nothing, so its updated_at never moves; kept that way here),
 * - AFTER INSERT on the raw bank/card tables: file the raw row and create the transaction and charge
 *   (`bank-handlers.ts`).
 */
import type { AnyRow } from '../catalog.js';
import type { Transaction } from '../transaction.js';
import type { StoredRow } from '../values.js';
import { BANK_INSERT_HANDLERS } from './bank-handlers.js';

const UPDATED_AT_TABLES = new Set([
  'annual_audit_step_status',
  'business_users',
  'businesses_securities',
  'charges',
  'dynamic_report_templates',
  'email_ingestion_alias_routing',
  'email_ingestion_quarantine',
  'financial_entities',
  'ledger_records',
  'provider_credentials',
  'report_1214_profiles',
  'shareholders',
  'transactions',
]);

export class Hooks {
  beforeUpdate(tx: Transaction, table: string, _old: StoredRow, row: AnyRow): AnyRow {
    if (UPDATED_AT_TABLES.has(table)) row.updated_at = new Date(tx.time.getTime());
    return row;
  }

  async afterInsert(tx: Transaction, table: string, row: StoredRow): Promise<void> {
    const handler = BANK_INSERT_HANDLERS[table];
    if (handler) await handler(tx, row);
  }
}
