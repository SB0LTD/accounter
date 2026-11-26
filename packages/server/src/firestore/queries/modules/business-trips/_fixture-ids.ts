/**
 * Ids of the rows in scripts/firestore/fixtures/010-business-trips.sql, for the cases files.
 */
import type { Snapshot } from '../../cases.js';

const id = (suffix: string) => `0f010000-0000-4000-8000-${suffix.padStart(12, '0')}`;

export const TRIP = {
  berlin: id('1'),
  newYork: id('2'),
  empty: id('3'),
  paris: id('4'),
  london: id('5'),
};

export const EMPLOYEE = { dana: id('e1'), omer: id('e2') };

/** business_trips_transactions ids (expenses) */
export const EXPENSE = {
  /** FLIGHT, one transaction matched twice */
  flight: id('101'),
  /** ACCOMMODATION, two USD transactions */
  accommodation: id('102'),
  /** TRAVEL_AND_SUBSISTENCE, paid by an employee */
  tns: id('103'),
  /** CAR_RENTAL, USD + ILS transactions */
  carRental: id('104'),
  /** OTHER, nothing matched or paid */
  other: id('105'),
  /** OTHER, matched and paid by an employee */
  otherPaid: id('106'),
  /** ACCOMMODATION, paid by an employee, no value date */
  accommodationPaid: id('107'),
  /** FLIGHT, nothing matched or paid */
  flightBare: id('108'),
  /** CAR_RENTAL (Paris), referenced by nothing */
  unreferenced: id('109'),
};

/** Extension rows without an expense row */
export const ORPHAN = { carRental: id('1f1'), tns: id('1f2') };

/** The EUR transaction the fixture adds */
export const EUR_TRANSACTION = id('1e0');

/** Ids a case may insert (not in the fixture). */
export const FRESH = { a: id('a01'), b: id('a02') };

/** Charges linked to a trip by the fixture (business_trip_charges). */
export function tripCharges(s: Snapshot, tripId: string | null): string[] {
  return s
    .rows('business_trip_charges')
    .filter(r => r.business_trip_id === tripId)
    .map(r => r.charge_id as string)
    .sort();
}

/** A demo charge with no business_trip_charges row. */
export function unlinkedCharge(s: Snapshot): string {
  const linked = new Set(s.rows('business_trip_charges').map(r => r.charge_id));
  return s.ids('charges', 100).find(chargeId => !linked.has(chargeId))!;
}
