/**
 * The schema's views as TypeScript over the request's tables:
 * `extended_charges`, `extended_tags`, `extended_business_trip_transactions`.
 *
 * Postgres views here run as their owner without `security_invoker`. On a superuser-owned database
 * (local dev) that makes them read every tenant; in a deployed database whose owner is subject to
 * the forced RLS they read the current tenant. The ports follow the deployed behaviour (and the
 * verification database sets `security_invoker` to match).
 */
import type { QueryDb } from '../query-db.js';
import {
  extendedBusinessTripTransactions,
  type ExtendedBusinessTripTransactionRow,
} from './extended-business-trip-transactions.js';
import { extendedCharges, type ExtendedChargeRow } from './extended-charges.js';
import { extendedTags, type ExtendedTagRow } from './extended-tags.js';

export type { ExtendedBusinessTripTransactionRow, ExtendedChargeRow, ExtendedTagRow };

export interface Views {
  extendedCharges(): Promise<readonly ExtendedChargeRow[]>;
  extendedTags(): Promise<readonly ExtendedTagRow[]>;
  extendedBusinessTripTransactions(): Promise<readonly ExtendedBusinessTripTransactionRow[]>;
}

export function viewsFor(db: QueryDb): Views {
  return {
    extendedCharges: () => extendedCharges(db),
    extendedTags: () => extendedTags(db),
    extendedBusinessTripTransactions: () => extendedBusinessTripTransactions(db),
  };
}
