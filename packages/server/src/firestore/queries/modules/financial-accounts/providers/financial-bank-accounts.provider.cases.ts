import type {
  IDeleteBankAccountQuery,
  IGetFinancialBankAccountsByIdsQuery,
  IInsertBankAccountsQuery,
  IUpdateBankAccountQuery,
} from '../../../../../modules/financial-accounts/__generated__/financial-bank-accounts.types.js';
import { caseFor, type Cases } from '../../../cases.js';

// Fixture rows (scripts/firestore/fixtures/090-accounts-salaries.sql)
const FA = (n: number) => `0f090000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const CARD = FA(1); // no bank account
const BANK = FA(2); // bank account, mostly NULL
const NO_OWNER = FA(3); // bank account, every column set
const WALLET = FA(4); // no bank account
const SECURITIES = FA(5); // no bank account

const emptyAccount = {
  bankNumber: null,
  branchNumber: null,
  iban: null,
  swiftCode: null,
  extendedBankNumber: null,
  partyPreferredIndication: null,
  partyAccountInvolvementCode: null,
  accountDealDate: null,
  accountUpdateDate: null,
  metegDoarNet: null,
  kodHarshaatPeilut: null,
  accountClosingReasonCode: null,
  accountAgreementOpeningDate: null,
  serviceAuthorizationDesc: null,
  branchTypeCode: null,
  mymailEntitlementSwitch: null,
  productLabel: null,
};

export const cases: Cases = {
  getFinancialBankAccountsByIds: caseFor<IGetFinancialBankAccountsByIdsQuery>(s => [
    { bankAccountIds: [BANK, NO_OWNER] },
    { bankAccountIds: s.ids('financial_accounts', 20) },
    { bankAccountIds: [CARD, s.missingId] },
  ]),
  updateBankAccount: caseFor<IUpdateBankAccountQuery>(s => [
    {
      bankAccountId: BANK,
      bankNumber: 20,
      branchNumber: 461,
      iban: 'IL170200000000123456789',
      swiftCode: 'MIZBILIT',
      extendedBankNumber: 20461,
      partyPreferredIndication: 0,
      partyAccountInvolvementCode: 1,
      accountDealDate: 20200101,
      accountUpdateDate: 20240601,
      metegDoarNet: 1,
      kodHarshaatPeilut: 2,
      accountClosingReasonCode: 0,
      accountAgreementOpeningDate: 20200102,
      serviceAuthorizationDesc: 'Limited',
      branchTypeCode: 3,
      mymailEntitlementSwitch: 1,
      productLabel: 'Updated label',
    },
    { bankAccountId: NO_OWNER, ...emptyAccount },
    { bankAccountId: NO_OWNER, productLabel: 'Only the label', iban: 'GB33BUKB20201555555555' },
    // varchar(34): too long
    { bankAccountId: BANK, iban: 'IL17020000000012345678901234567890XY' },
    // varchar(34): trailing spaces past the limit are cut, not an error
    { bankAccountId: BANK, iban: 'IL170200000000123456789           ' + '   ' },
    // integer column given a fraction: 22P02
    { bankAccountId: BANK, accountDealDate: 1.5 },
    { bankAccountId: s.missingId, bankNumber: 1 },
    { bankAccountId: null, bankNumber: 1 },
  ]),
  insertBankAccounts: caseFor<IInsertBankAccountsQuery>(s => [
    {
      bankAccounts: [
        {
          id: WALLET,
          bankNumber: 31,
          branchNumber: 100,
          iban: 'IL310310000000000123456',
          swiftCode: 'FIRBILITXXX',
          extendedBankNumber: 31100,
          partyPreferredIndication: 1,
          partyAccountInvolvementCode: 2,
          accountDealDate: 20210301,
          accountUpdateDate: 20240301,
          metegDoarNet: 0,
          kodHarshaatPeilut: 1,
          accountClosingReasonCode: 0,
          accountAgreementOpeningDate: 20210302,
          serviceAuthorizationDesc: 'Full',
          branchTypeCode: 1,
          mymailEntitlementSwitch: 0,
          productLabel: 'Wallet bank',
          ownerId: s.businessId,
        },
        { id: CARD, ...emptyAccount, bankNumber: 12, branchNumber: 601, ownerId: s.businessId },
      ],
    },
    // already has a bank account: 23505
    {
      bankAccounts: [
        { id: BANK, ...emptyAccount, bankNumber: 12, branchNumber: 600, ownerId: s.businessId },
      ],
    },
    // no such financial account: 23503
    {
      bankAccounts: [
        {
          id: s.missingId,
          ...emptyAccount,
          bankNumber: 12,
          branchNumber: 600,
          ownerId: s.businessId,
        },
      ],
    },
    // bank_number is NOT NULL
    { bankAccounts: [{ id: SECURITIES, ...emptyAccount, ownerId: s.businessId }] },
    // swift_code varchar(255): too long
    {
      bankAccounts: [
        {
          id: SECURITIES,
          ...emptyAccount,
          bankNumber: 12,
          branchNumber: 600,
          swiftCode: 'X'.repeat(256),
          ownerId: s.businessId,
        },
      ],
    },
  ]),
  deleteBankAccount: caseFor<IDeleteBankAccountQuery>(s => [
    { bankAccountId: BANK },
    { bankAccountId: CARD },
    { bankAccountId: s.missingId },
    { bankAccountId: null },
  ]),
};
