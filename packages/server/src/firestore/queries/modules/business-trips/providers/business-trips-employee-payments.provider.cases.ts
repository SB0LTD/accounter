import type {
  IDeleteBusinessTripEmployeePaymentQuery,
  IGetBusinessTripEmployeePaymentByIdQuery,
  IGetBusinessTripEmployeePaymentsByChargeIdsQuery,
  IInsertBusinessTripEmployeePaymentQuery,
  IReplaceBusinessTripsEmployeePaymentsChargeIdQuery,
  IUpdateBusinessTripEmployeePaymentQuery,
} from '../../../../../modules/business-trips/__generated__/business-trips-employee-payments.types.js';
import { caseFor, type Cases, type Snapshot } from '../../../cases.js';
import { EMPLOYEE, EXPENSE, TRIP, tripCharges, unlinkedCharge } from '../_fixture-ids.js';

const paymentCharges = (s: Snapshot) =>
  s.values('business_trips_employee_payments', 'charge_id', 10) as string[];

export const cases: Cases = {
  getBusinessTripEmployeePaymentsByChargeIds: caseFor<IGetBusinessTripEmployeePaymentsByChargeIdsQuery>(
    s => [
      { chargeIds: paymentCharges(s) },
      { chargeIds: s.ids('charges', 20) },
      { chargeIds: [s.missingId, null] },
    ],
  ),
  getBusinessTripEmployeePaymentById: caseFor<IGetBusinessTripEmployeePaymentByIdQuery>(s => [
    { businessTripExpenseId: EXPENSE.tns },
    { businessTripExpenseId: EXPENSE.flight },
    { businessTripExpenseId: s.missingId },
    { businessTripExpenseId: null },
  ]),
  updateBusinessTripEmployeePayment: caseFor<IUpdateBusinessTripEmployeePaymentQuery>(s => [
    {
      businessTripExpenseId: EXPENSE.tns,
      chargeId: unlinkedCharge(s),
      date: '2024-03-13',
      valueDate: '2024-03-21',
      amount: 151.255,
      currency: 'USD',
      employeeBusinessId: EMPLOYEE.omer,
    },
    // COALESCE keeps everything else; the amount takes the column's scale
    { businessTripExpenseId: EXPENSE.otherPaid, amount: '12' },
    { businessTripExpenseId: EXPENSE.otherPaid, amount: 0.1 + 0.2 },
    { businessTripExpenseId: EXPENSE.accommodationPaid, valueDate: '2024-09-30' },
    { businessTripExpenseId: EXPENSE.accommodationPaid },
    // numeric(9,2) overflow
    { businessTripExpenseId: EXPENSE.tns, amount: 99999999 },
    // ... also when no row matches (the parameter is coerced while planning)
    { businessTripExpenseId: s.missingId, amount: 99999999 },
    { businessTripExpenseId: null, amount: '10000000' },
    { businessTripExpenseId: s.missingId, amount: '9999999.994' },
    // unknown employee: foreign key
    { businessTripExpenseId: EXPENSE.tns, employeeBusinessId: s.missingId },
    { businessTripExpenseId: null, amount: 1 },
  ]),
  insertBusinessTripEmployeePayment: caseFor<IInsertBusinessTripEmployeePaymentQuery>(s => [
    {
      businessTripExpenseId: EXPENSE.flight,
      chargeId: tripCharges(s, TRIP.berlin)[0],
      date: '2024-03-14',
      valueDate: null,
      amount: 1234.5,
      currency: 'EUR',
      employeeBusinessId: EMPLOYEE.dana,
      ownerId: s.businessId,
    },
    {
      businessTripExpenseId: EXPENSE.other,
      chargeId: unlinkedCharge(s),
      date: '2024-05-04',
      valueDate: '2024-05-06',
      amount: '-7.005',
      currency: 'ILS',
      employeeBusinessId: EMPLOYEE.omer,
      ownerId: s.businessId,
    },
    // already paid: primary key
    {
      businessTripExpenseId: EXPENSE.tns,
      chargeId: tripCharges(s, TRIP.berlin)[0],
      date: '2024-03-14',
      valueDate: null,
      amount: 1,
      currency: 'EUR',
      employeeBusinessId: EMPLOYEE.dana,
      ownerId: s.businessId,
    },
    // no such expense: foreign key
    {
      businessTripExpenseId: s.missingId,
      chargeId: tripCharges(s, TRIP.berlin)[0],
      date: '2024-03-14',
      valueDate: null,
      amount: 1,
      currency: 'EUR',
      employeeBusinessId: EMPLOYEE.dana,
      ownerId: s.businessId,
    },
    // NOT NULL amount
    {
      businessTripExpenseId: EXPENSE.flight,
      chargeId: tripCharges(s, TRIP.berlin)[0],
      date: '2024-03-14',
      valueDate: null,
      amount: null,
      currency: 'EUR',
      employeeBusinessId: EMPLOYEE.dana,
      ownerId: s.businessId,
    },
    // numeric(9,2) overflow
    {
      businessTripExpenseId: EXPENSE.flight,
      chargeId: tripCharges(s, TRIP.berlin)[0],
      date: '2024-03-14',
      valueDate: null,
      amount: '9999999.995',
      currency: 'EUR',
      employeeBusinessId: EMPLOYEE.dana,
      ownerId: s.businessId,
    },
  ]),
  deleteBusinessTripEmployeePayment: caseFor<IDeleteBusinessTripEmployeePaymentQuery>(s => [
    { businessTripExpenseId: EXPENSE.accommodationPaid },
    { businessTripExpenseId: EXPENSE.flight },
    { businessTripExpenseId: s.missingId },
    { businessTripExpenseId: null },
  ]),
  replaceBusinessTripsEmployeePaymentsChargeId:
    caseFor<IReplaceBusinessTripsEmployeePaymentsChargeIdQuery>(s => [
      { replaceChargeID: paymentCharges(s)[0], assertChargeID: unlinkedCharge(s) },
      { replaceChargeID: s.missingId, assertChargeID: unlinkedCharge(s) },
      // NOT NULL
      { replaceChargeID: paymentCharges(s)[0], assertChargeID: null },
      // unknown charge: foreign key
      { replaceChargeID: paymentCharges(s)[0], assertChargeID: s.missingId },
      { replaceChargeID: null, assertChargeID: unlinkedCharge(s) },
    ]),
};
