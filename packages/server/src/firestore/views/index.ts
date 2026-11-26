/**
 * The schema's views as TypeScript over the request's tables:
 * `extended_charges`, `extended_tags`, `extended_business_trip_transactions`.
 *
 * Postgres views here run as their owner without `security_invoker`. On a superuser-owned database
 * (local dev) that makes them read every tenant; in a deployed database whose owner is subject to
 * the forced RLS they read the current tenant. The ports follow the deployed behaviour.
 */
import type { QueryDb } from '../query-db.js';
import { extendedTags, type ExtendedTagRow } from './extended-tags.js';

export interface Views {
  extendedCharges(): Promise<readonly Record<string, unknown>[]>;
  extendedTags(): Promise<readonly ExtendedTagRow[]>;
  extendedBusinessTripTransactions(): Promise<readonly Record<string, unknown>[]>;
}

const notPorted = (name: string) => async () => {
  throw new Error(`Firestore store: view ${name} is not ported yet`);
};

export function viewsFor(db: QueryDb): Views {
  return {
    extendedCharges: notPorted('extended_charges'),
    extendedTags: () => extendedTags(db),
    extendedBusinessTripTransactions: notPorted('extended_business_trip_transactions'),
  };
}
