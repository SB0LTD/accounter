import type {
  IDeleteLedgerRecordsByChargeIdsQuery,
  IDeleteLedgerRecordsQuery,
  IGetLedgerBalanceToDateQuery,
  IGetLedgerRecordsByChargesIdsQuery,
  IGetLedgerRecordsByDatesQuery,
  IGetLedgerRecordsByFiltersParams,
  IGetLedgerRecordsByFiltersQuery,
  IGetLedgerRecordsByFinancialEntityIdsQuery,
  IGetLedgerRecordsByIdsQuery,
  IInsertLedgerRecordsParams,
  IInsertLedgerRecordsQuery,
  ILockLedgerRecordsQuery,
  IReplaceLedgerRecordsChargeIdQuery,
  IUpdateLedgerRecordQuery,
} from '../../../../../modules/ledger/__generated__/ledger.types.js';
import { caseFor, type Cases } from '../../../cases.js';
import { FX } from '../../charges/_fixture-ids.js';

/** What LedgerProvider.getLedgerRecordsByFilters passes when nothing is filtered. */
const filters = (
  over: Partial<IGetLedgerRecordsByFiltersParams> = {},
): IGetLedgerRecordsByFiltersParams => ({
  isChargeIds: 0,
  isOwnerIds: 0,
  isFinancialEntityIds: 0,
  chargeIds: [null],
  ownerIds: [null],
  financialEntityIds: [null],
  matchDebit1: 1,
  matchDebit2: 1,
  matchCredit1: 1,
  matchCredit2: 1,
  fromInvoiceDate: null,
  toInvoiceDate: null,
  fromValueDate: null,
  toValueDate: null,
  fromAnyDate: null,
  toAnyDate: null,
  limit: 10_000,
  ...over,
});

type NewRecord = IInsertLedgerRecordsParams['ledgerRecords'][number];
const newRecord = (over: Partial<NewRecord>): NewRecord => ({
  chargeId: FX.hardware,
  creditEntity1: null,
  creditEntity2: null,
  creditForeignAmount1: null,
  creditForeignAmount2: null,
  creditLocalAmount1: null,
  creditLocalAmount2: null,
  currency: 'ILS',
  debitEntity1: null,
  debitEntity2: null,
  debitForeignAmount1: null,
  debitForeignAmount2: null,
  debitLocalAmount1: null,
  debitLocalAmount2: null,
  description: null,
  invoiceDate: '2024-05-01',
  ownerId: null,
  reference: null,
  valueDate: '2024-05-02',
  ...over,
});

export const cases: Cases = {
  getLedgerRecordsByIds: caseFor<IGetLedgerRecordsByIdsQuery>(s => [
    { ids: [FX.ledger(1), FX.ledger(3), FX.ledger(8), s.missingId], ownerId: s.businessId },
    { ids: [FX.ledger(1)], ownerId: s.missingId },
    { ids: [FX.ledger(1)], ownerId: null },
  ]),

  getLedgerRecordsByChargesIds: caseFor<IGetLedgerRecordsByChargesIdsQuery>(s => [
    { chargeIds: [FX.officeSupplies, FX.retainer, FX.demoJanuary], ownerId: s.businessId },
    { chargeIds: [FX.emptyCharge], ownerId: s.businessId },
    { chargeIds: [FX.officeSupplies], ownerId: s.missingId },
  ]),

  getLedgerRecordsByFinancialEntityIds: caseFor<IGetLedgerRecordsByFinancialEntityIdsQuery>(s => [
    { financialEntityIds: [FX.globex], ownerId: s.businessId },
    { financialEntityIds: [FX.consulting, FX.inputVat], ownerId: s.businessId },
    { financialEntityIds: [FX.incomeFx], ownerId: s.businessId },
    // the owner test binds to the last OR branch only
    { financialEntityIds: [FX.globex, FX.initech], ownerId: s.missingId },
    { financialEntityIds: [s.missingId], ownerId: s.businessId },
  ]),

  getLedgerRecordsByDates: caseFor<IGetLedgerRecordsByDatesQuery>(s => [
    { fromDate: '2024-01-01', toDate: '2024-04-30', ownerId: s.businessId },
    { fromDate: '2024-03-04', toDate: '2024-03-04', ownerId: s.businessId },
    { fromDate: '2025-01-01', toDate: '2024-01-01', ownerId: s.businessId },
    { fromDate: null, toDate: '2024-12-31', ownerId: s.businessId },
    { fromDate: '2024-01-01', toDate: '2025-12-31', ownerId: s.missingId },
  ]),

  getLedgerRecordsByFilters: caseFor<IGetLedgerRecordsByFiltersQuery>(s => [
    filters(),
    filters({ limit: 3 }),
    filters({ limit: null }),
    filters({ isChargeIds: 1, chargeIds: [FX.officeSupplies, FX.retainer] }),
    filters({ isOwnerIds: 1, ownerIds: [s.businessId] }),
    filters({ isOwnerIds: 1, ownerIds: [s.missingId] }),
    filters({ isFinancialEntityIds: 1, financialEntityIds: [FX.globex] }),
    filters({
      isFinancialEntityIds: 1,
      financialEntityIds: [FX.globex, FX.consulting],
      matchDebit1: 0,
      matchDebit2: 0,
      matchCredit1: 1,
      matchCredit2: 0,
    }),
    filters({
      isFinancialEntityIds: 1,
      financialEntityIds: [FX.inputVat, FX.incomeFx],
      matchDebit1: 0,
      matchDebit2: 1,
      matchCredit1: 0,
      matchCredit2: 1,
    }),
    filters({ fromInvoiceDate: '2024-04-01', toInvoiceDate: '2024-12-20' }),
    filters({ fromValueDate: '2024-03-06', toValueDate: '2024-05-04' }),
    filters({ fromAnyDate: '2024-04-05', toAnyDate: '2024-04-30' }),
    filters({ fromAnyDate: '2024-12-25' }),
    filters({ toAnyDate: '2024-01-10' }),
    filters({ isChargeIds: 1, chargeIds: [FX.retainer], fromAnyDate: '2025-01-16', limit: 5 }),
  ]),

  getLedgerBalanceToDate: caseFor<IGetLedgerBalanceToDateQuery>(() => [
    { date: '2024-12-31' },
    { date: '2024-04-01' },
    { date: '2030-01-01' },
    { date: '2000-01-01' },
    { date: null },
  ]),

  updateLedgerRecord: caseFor<IUpdateLedgerRecordQuery>(s => [
    {
      ledgerId: FX.ledger(1),
      ownerId: s.businessId,
      chargeId: FX.hardware,
      creditEntity1: FX.initech,
      creditEntity2: FX.incomeFx,
      creditForeignAmount1: '10.5',
      creditForeignAmount2: 2,
      creditLocalAmount1: 1001.25,
      creditLocalAmount2: '0.001',
      currency: 'EUR',
      debitEntity1: FX.globex,
      debitEntity2: FX.inputVat,
      debitForeignAmount1: '3',
      debitForeignAmount2: '4.40',
      debitLocalAmount1: '1000.000',
      debitLocalAmount2: 1.26,
      description: 'Edited',
      invoiceDate: '2024-03-05',
      reference: 'REF-X',
      valueDate: '2024-03-07',
    },
    { ledgerId: FX.ledger(3), ownerId: s.businessId, description: 'Only description' },
    { ledgerId: FX.ledger(8), ownerId: s.businessId },
    { ledgerId: FX.ledger(1), ownerId: s.missingId, description: 'other owner' },
    { ledgerId: FX.ledger(1), ownerId: s.businessId, chargeId: s.missingId },
    { ledgerId: s.missingId, ownerId: s.businessId, description: 'nothing' },
  ]),

  insertLedgerRecords: caseFor<IInsertLedgerRecordsQuery>(s => [
    {
      ledgerRecords: [
        newRecord({
          ownerId: s.businessId,
          debitEntity1: FX.consulting,
          debitLocalAmount1: 12.5,
          creditEntity1: FX.globex,
          creditLocalAmount1: '12.50',
          description: 'one',
          reference: 'R1',
        }),
        newRecord({
          ownerId: s.businessId,
          chargeId: FX.retainer,
          currency: 'USD',
          debitEntity1: FX.initech,
          debitForeignAmount1: '100',
          debitLocalAmount1: '370.123',
          creditEntity1: FX.serviceIncome,
          creditForeignAmount1: 100,
          creditLocalAmount1: '370.123',
          invoiceDate: '2024-06-01',
          valueDate: '2024-06-03',
        }),
      ],
    },
    // NOT NULL currency
    { ledgerRecords: [newRecord({ ownerId: s.businessId, currency: null })] },
    // unknown charge
    { ledgerRecords: [newRecord({ ownerId: s.businessId, chargeId: s.missingId })] },
    // another tenant
    { ledgerRecords: [newRecord({ ownerId: s.missingId })] },
  ]),

  deleteLedgerRecords: caseFor<IDeleteLedgerRecordsQuery>(s => [
    { ledgerRecordIds: [FX.ledger(1), FX.ledger(2)], ownerId: s.businessId },
    { ledgerRecordIds: [FX.ledger(1)], ownerId: s.missingId },
  ]),

  deleteLedgerRecordsByChargeIds: caseFor<IDeleteLedgerRecordsByChargeIdsQuery>(s => [
    { chargeIds: [FX.officeSupplies, FX.retainer], ownerId: s.businessId },
    { chargeIds: [s.missingId], ownerId: s.businessId },
  ]),

  replaceLedgerRecordsChargeId: caseFor<IReplaceLedgerRecordsChargeIdQuery>(s => [
    { replaceChargeID: FX.officeSupplies, assertChargeID: FX.hardware },
    { replaceChargeID: FX.retainer, assertChargeID: s.missingId },
    { replaceChargeID: FX.officeSupplies, assertChargeID: null },
    { replaceChargeID: s.missingId, assertChargeID: FX.hardware },
  ]),

  lockLedgerRecords: caseFor<ILockLedgerRecordsQuery>(() => [
    { date: '2024-03-31' },
    { date: '2024-01-01' },
    { date: '2023-01-01' },
    { date: null },
  ]),
};
