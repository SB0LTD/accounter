import type { Row } from '../../../../catalog.js';
import type {
  IDeleteBankAccountQuery,
  IGetAllFinancialBankAccountsQuery,
  IGetFinancialBankAccountsByIdsQuery,
  IInsertBankAccountsQuery,
  IUpdateBankAccountQuery,
} from '../../../../../modules/financial-accounts/__generated__/financial-bank-accounts.types.js';
import { coalescePatch } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';
import { deletable, typed } from '../../salaries/_helpers.js';

type BankAccountRow = Row<'financial_bank_accounts'>;

/** Every column but owner_id, in the SELECT's order. */
const bankAccountColumns = (row: BankAccountRow) => ({
  id: row.id,
  bank_number: row.bank_number,
  branch_number: row.branch_number,
  iban: row.iban,
  swift_code: row.swift_code,
  extended_bank_number: row.extended_bank_number,
  party_preferred_indication: row.party_preferred_indication,
  party_account_involvement_code: row.party_account_involvement_code,
  account_deal_date: row.account_deal_date,
  account_update_date: row.account_update_date,
  meteg_doar_net: row.meteg_doar_net,
  kod_harshaat_peilut: row.kod_harshaat_peilut,
  account_closing_reason_code: row.account_closing_reason_code,
  account_agreement_opening_date: row.account_agreement_opening_date,
  service_authorization_desc: row.service_authorization_desc,
  branch_type_code: row.branch_type_code,
  mymail_entitlement_switch: row.mymail_entitlement_switch,
  product_label: row.product_label,
});

/**
 * SELECT id, bank_number, branch_number, iban, swift_code, extended_bank_number,
 *   party_preferred_indication, party_account_involvement_code, account_deal_date,
 *   account_update_date, meteg_doar_net, kod_harshaat_peilut, account_closing_reason_code,
 *   account_agreement_opening_date, service_authorization_desc, branch_type_code,
 *   mymail_entitlement_switch, product_label
 * FROM financial_bank_accounts WHERE id IN $$bankAccountIds
 */
export const getFinancialBankAccountsByIds = port<IGetFinancialBankAccountsByIdsQuery>(
  async ({ bankAccountIds }, db) =>
    (await db.whereIn('financial_bank_accounts', 'id', bankAccountIds)).map(bankAccountColumns),
);

/** SELECT <same columns> FROM financial_bank_accounts */
export const getAllFinancialBankAccounts = port<IGetAllFinancialBankAccountsQuery>(
  async (_params, db) => (await db.rows('financial_bank_accounts')).map(bankAccountColumns),
);

/**
 * UPDATE financial_bank_accounts SET <column> = COALESCE($param, <column>) for bank_number,
 *   branch_number, iban, swift_code, extended_bank_number, party_preferred_indication,
 *   party_account_involvement_code, account_deal_date, account_update_date, meteg_doar_net,
 *   kod_harshaat_peilut, account_closing_reason_code, account_agreement_opening_date,
 *   service_authorization_desc, branch_type_code, mymail_entitlement_switch, product_label
 * WHERE id = $bankAccountId
 * RETURNING *
 */
export const updateBankAccount = port<IUpdateBankAccountQuery>(async (params, db) => {
  if (params.bankAccountId == null) return [];
  const patch = typed(
    'financial_bank_accounts',
    coalescePatch({
      bank_number: params.bankNumber,
      branch_number: params.branchNumber,
      iban: params.iban,
      swift_code: params.swiftCode,
      extended_bank_number: params.extendedBankNumber,
      party_preferred_indication: params.partyPreferredIndication,
      party_account_involvement_code: params.partyAccountInvolvementCode,
      account_deal_date: params.accountDealDate,
      account_update_date: params.accountUpdateDate,
      meteg_doar_net: params.metegDoarNet,
      kod_harshaat_peilut: params.kodHarshaatPeilut,
      account_closing_reason_code: params.accountClosingReasonCode,
      account_agreement_opening_date: params.accountAgreementOpeningDate,
      service_authorization_desc: params.serviceAuthorizationDesc,
      branch_type_code: params.branchTypeCode,
      mymail_entitlement_switch: params.mymailEntitlementSwitch,
      product_label: params.productLabel,
    }),
  );
  const updated: BankAccountRow[] = [];
  for (const row of await db.where('financial_bank_accounts', { id: params.bankAccountId })) {
    updated.push(await db.update('financial_bank_accounts', row, patch));
  }
  return updated;
});

/**
 * INSERT INTO financial_bank_accounts (id, bank_number, branch_number, iban, swift_code,
 *   extended_bank_number, party_preferred_indication, party_account_involvement_code,
 *   account_deal_date, account_update_date, meteg_doar_net, kod_harshaat_peilut,
 *   account_closing_reason_code, account_agreement_opening_date, service_authorization_desc,
 *   branch_type_code, mymail_entitlement_switch, product_label, owner_id)
 * VALUES $$bankAccounts(id, bankNumber, ..., productLabel, ownerId)
 * RETURNING *
 */
export const insertBankAccounts = port<IInsertBankAccountsQuery>(async ({ bankAccounts }, db) => {
  const inserted: BankAccountRow[] = [];
  for (const account of bankAccounts) {
    const row = await db.insert(
      'financial_bank_accounts',
      typed('financial_bank_accounts', {
        id: account.id ?? null,
        bank_number: account.bankNumber ?? null,
        branch_number: account.branchNumber ?? null,
        iban: account.iban ?? null,
        swift_code: account.swiftCode ?? null,
        extended_bank_number: account.extendedBankNumber ?? null,
        party_preferred_indication: account.partyPreferredIndication ?? null,
        party_account_involvement_code: account.partyAccountInvolvementCode ?? null,
        account_deal_date: account.accountDealDate ?? null,
        account_update_date: account.accountUpdateDate ?? null,
        meteg_doar_net: account.metegDoarNet ?? null,
        kod_harshaat_peilut: account.kodHarshaatPeilut ?? null,
        account_closing_reason_code: account.accountClosingReasonCode ?? null,
        account_agreement_opening_date: account.accountAgreementOpeningDate ?? null,
        service_authorization_desc: account.serviceAuthorizationDesc ?? null,
        branch_type_code: account.branchTypeCode ?? null,
        mymail_entitlement_switch: account.mymailEntitlementSwitch ?? null,
        product_label: account.productLabel ?? null,
        owner_id: account.ownerId ?? null,
      }),
    );
    if (row) inserted.push(row);
  }
  return inserted;
});

/** DELETE FROM financial_bank_accounts WHERE id = $bankAccountId RETURNING id */
export const deleteBankAccount = port<IDeleteBankAccountQuery>(async ({ bankAccountId }, db) => {
  if (bankAccountId == null) return [];
  const rows = await db.where('financial_bank_accounts', { id: bankAccountId });
  const deleted: { id: string }[] = [];
  for (const row of deletable(rows, db.ctx.businessId)) {
    await db.delete('financial_bank_accounts', row);
    deleted.push({ id: row.id });
  }
  return deleted;
});
