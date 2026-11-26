import type {
  IDeleteExpenseQuery,
  IGetExpensesByChargeIdsQuery,
  IGetExpensesByFinancialEntityIdsQuery,
  IGetExpensesByIdsQuery,
  IInsertExpenseQuery,
  IInsertExpensesParams,
  IInsertExpensesQuery,
  IReplaceMiscExpensesChargeIdQuery,
  IUpdateExpenseQuery,
} from '../../../../../modules/misc-expenses/__generated__/misc-expenses.types.js';
import { caseFor, type Cases } from '../../../cases.js';
import { FX } from '../../documents/_fixture-ids.js';

type NewExpense = IInsertExpensesParams['miscExpenses'][number];
const newExpense = (ownerId: string, patch: Partial<NewExpense> = {}): NewExpense => ({
  chargeId: FX.chargeApproved,
  creditorId: FX.globex,
  debtorId: ownerId,
  amount: '10.10',
  currency: 'ILS',
  description: 'Parking',
  invoiceDate: '2024-06-01',
  valueDate: '2024-06-02 09:45:00',
  ownerId,
  ...patch,
});

export const cases: Cases = {
  getExpensesByChargeIds: caseFor<IGetExpensesByChargeIdsQuery>(s => [
    { chargeIds: [FX.chargeApproved, FX.chargeUnmatched] },
    { chargeIds: [s.missingId, null] },
  ]),
  getExpensesByIds: caseFor<IGetExpensesByIdsQuery>(s => [
    { ids: [FX.m1, FX.m3, s.missingId] },
    { ids: [null] },
  ]),
  getExpensesByFinancialEntityIds: caseFor<IGetExpensesByFinancialEntityIdsQuery>(s => [
    { financialEntityIds: [FX.globex] },
    { financialEntityIds: [s.businessId, FX.initech] },
    { financialEntityIds: [s.missingId] },
  ]),
  updateExpense: caseFor<IUpdateExpenseQuery>(s => [
    {
      miscExpenseId: FX.m1,
      chargeId: FX.chargeUnmatched,
      creditorId: FX.initech,
      debtorId: FX.globex,
      amount: '99.990',
      currency: 'GBP',
      description: 'Train',
      invoiceDate: '2024-05-01',
      valueDate: '2024-05-02 10:15:00',
    },
    { miscExpenseId: FX.m2 },
    { miscExpenseId: FX.m3, amount: 1.5, valueDate: new Date('2024-06-01T00:00:00.000Z') },
    { miscExpenseId: FX.m1, chargeId: s.missingId },
    { miscExpenseId: FX.m1, currency: 'XYZ' as never },
    { miscExpenseId: s.missingId, description: 'nothing' },
    { miscExpenseId: null, description: 'no id' },
  ]),
  replaceMiscExpensesChargeId: caseFor<IReplaceMiscExpensesChargeIdQuery>(s => [
    { assertChargeID: FX.chargeEmpty, replaceChargeID: FX.chargeApproved },
    // charge_id is NOT NULL
    { assertChargeID: null, replaceChargeID: FX.chargeUnmatched },
    { assertChargeID: s.missingId, replaceChargeID: FX.chargeApproved },
    { assertChargeID: FX.chargeEmpty, replaceChargeID: s.missingId },
  ]),
  insertExpense: caseFor<IInsertExpenseQuery>(s => [
    newExpense(s.businessId),
    newExpense(s.businessId, { description: null, amount: -3, currency: 'USD' }),
    newExpense(s.businessId, { chargeId: null }),
    newExpense(s.businessId, { creditorId: s.missingId }),
    newExpense(s.businessId, { currency: 'XYZ' as never }),
    newExpense(s.missingId),
  ]),
  insertExpenses: caseFor<IInsertExpensesQuery>(s => [
    {
      miscExpenses: [
        newExpense(s.businessId),
        newExpense(s.businessId, {
          chargeId: FX.chargeUnmatched,
          creditorId: s.businessId,
          debtorId: FX.initech,
          amount: '0.001',
          currency: 'EUR',
          description: null,
        }),
      ],
    },
    { miscExpenses: [newExpense(s.businessId), newExpense(s.businessId, { invoiceDate: null })] },
  ]),
  deleteExpense: caseFor<IDeleteExpenseQuery>(s => [
    { id: FX.m1 },
    { id: s.missingId },
    { id: null },
  ]),
};
