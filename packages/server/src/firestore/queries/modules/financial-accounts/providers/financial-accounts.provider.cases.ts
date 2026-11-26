import type {
  IDeleteFinancialAccountQuery,
  IGetFinancialAccountsByAccountIDsQuery,
  IGetFinancialAccountsByAccountNumbersQuery,
  IGetFinancialAccountsByOwnerIdsQuery,
  IInsertFinancialAccountsQuery,
  IUpdateFinancialAccountQuery,
} from '../../../../../modules/financial-accounts/__generated__/financial-accounts.types.js';
import { caseFor, type Cases } from '../../../cases.js';

// Fixture rows (scripts/firestore/fixtures/090-accounts-salaries.sql)
const FA = (n: number) => `0f090000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const CARD = FA(1); // has tax categories
const BANK = FA(2); // bank account + a tax category
const NO_OWNER = FA(3); // bank account only
const WALLET = FA(4); // nothing attached
const SECOND_EMPLOYER = FA(131);

export const cases: Cases = {
  getFinancialAccountsByOwnerIds: caseFor<IGetFinancialAccountsByOwnerIdsQuery>(s => [
    { ownerIds: [s.businessId] },
    { ownerIds: [SECOND_EMPLOYER, s.missingId] },
    { ownerIds: [null, s.businessId] },
    { ownerIds: [s.missingId] },
  ]),
  getFinancialAccountsByAccountNumbers: caseFor<IGetFinancialAccountsByAccountNumbersQuery>(s => [
    { accountNumbers: ['090-1004', '090-1001'] },
    { accountNumbers: s.values('financial_accounts', 'account_number', 20) as string[] },
    { accountNumbers: ['no such account'] },
  ]),
  getFinancialAccountsByAccountIDs: caseFor<IGetFinancialAccountsByAccountIDsQuery>(s => [
    { accountIDs: s.ids('financial_accounts', 20) },
    { accountIDs: [WALLET, s.missingId] },
    { accountIDs: [s.missingId] },
  ]),
  updateFinancialAccount: caseFor<IUpdateFinancialAccountQuery>(s => [
    {
      financialAccountId: CARD,
      accountNumber: '090-9999',
      name: 'Renamed card',
      privateBusiness: 'private',
      ownerId: SECOND_EMPLOYER,
      type: 'BANK_ACCOUNT',
    },
    { financialAccountId: NO_OWNER, name: 'Only the name' },
    {
      financialAccountId: BANK,
      accountNumber: null,
      name: null,
      privateBusiness: null,
      ownerId: null,
      type: null,
    },
    { financialAccountId: s.ids('financial_accounts', 1)[0], ownerId: s.businessId },
    { financialAccountId: s.missingId, name: 'nobody' },
    { financialAccountId: null, name: 'nobody' },
  ]),
  insertFinancialAccounts: caseFor<IInsertFinancialAccountsQuery>(s => [
    {
      bankAccounts: [
        {
          accountNumber: '090-2001',
          name: 'New card',
          privateBusiness: 'business',
          ownerId: s.businessId,
          type: 'CREDIT_CARD',
        },
        {
          accountNumber: '090-2002',
          name: null,
          privateBusiness: 'private',
          ownerId: s.businessId,
          type: 'BANK_DEPOSIT_ACCOUNT',
        },
      ],
    },
    // private_business has a default, but an explicit NULL violates NOT NULL
    {
      bankAccounts: [
        {
          accountNumber: '090-2003',
          name: null,
          privateBusiness: null,
          ownerId: s.businessId,
          type: 'CREDIT_CARD',
        },
      ],
    },
    // owner_id of another business: RLS WITH CHECK
    {
      bankAccounts: [
        {
          accountNumber: '090-2004',
          name: null,
          privateBusiness: 'business',
          ownerId: SECOND_EMPLOYER,
          type: 'CREDIT_CARD',
        },
      ],
    },
  ]),
  deleteFinancialAccount: caseFor<IDeleteFinancialAccountQuery>(s => [
    { financialAccountId: WALLET }, // nothing attached
    { financialAccountId: NO_OWNER }, // cascades to its bank account
    { financialAccountId: CARD }, // tax categories reference it: 23503
    { financialAccountId: BANK }, // bank account cascades, tax category raises 23503
    { financialAccountId: s.ids('financial_accounts', 1)[0] }, // demo account with transactions
    { financialAccountId: s.missingId },
    { financialAccountId: null },
  ]),
};
