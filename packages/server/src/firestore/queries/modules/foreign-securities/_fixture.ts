/** Fixture ids and lookups shared by the foreign-securities cases (060-depreciation-securities.sql). */
import type { Snapshot } from '../../cases.js';

export const id = (n: number) => `0f060000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** Security businesses: 301 and 302 the tenant's, 303 another business's. */
export const SB1 = id(301);
export const SB2 = id(302);
export const SB3 = id(303);

/** Executions (poalim_securities_transactions) by fixture number. */
export const E = (n: number) => id(500 + n);

export const APPLE_KEY = '1105467';
export const IWDA_KEY = '1159250';

export const BUY = 'קניה';
export const SELL = 'מכירה';
export const DISTRIBUTION = 'הטבה חלוקת מניות';
export const DIVIDEND_PAYMENT = 'דבידנד תשלום';
export const CORPORATE_ACTIONS = 'תשלומים ואירועי חברה';
export const DIVIDEND_IN_KIND = 'דיבידנד בעין';
export const DIVIDEND = 'דיבידנד';
export const CANCELLED = 'כן';

/** The other business that owns the hidden fixture rows. */
export const otherOwner = (s: Snapshot) =>
  s.rows('businesses_securities').find(row => row.id === SB3)?.owner_id as string;

/** The charge a fixture execution (501-517) is linked to: c5 for 501 and 505, c0 for 510. */
export const linkedCharge = (s: Snapshot, execution: number) => {
  const charge = s
    .rows('charges_securities_executions')
    .find(row => row.execution_id === id(execution))?.charge_id;
  if (typeof charge !== 'string') throw new Error(`fixture execution ${execution} has no charge`);
  return charge;
};
