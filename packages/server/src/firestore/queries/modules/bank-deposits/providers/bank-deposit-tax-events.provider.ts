import type {
  IGetBankDepositsRevaluationChargeDescriptionsQuery,
  IGetPoalimDepositTaxEventsByAccountIdsQuery,
} from '../../../../../modules/bank-deposits/__generated__/bank-deposit-tax-events.types.js';
import { orderBy } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';

/**
 * SELECT fa.id AS financial_account_id, e.id, e.executing_date, e.event_serial_number,
 *        e.action_type_description, e.short_product_name, e.tax_action_type_description,
 *        e.tax_event_amount, e.debit_amount, e.crdit_amount
 * FROM poalim_deposit_tax_events e
 * INNER JOIN financial_accounts fa ON fa.account_number = e.account_number::text
 * INNER JOIN financial_bank_accounts fba ON fba.id = fa.id
 *   AND fba.bank_number = e.bank_number AND fba.branch_number = e.branch_number
 * WHERE fa.id IN $$accountIds
 * ORDER BY e.executing_date, e.event_serial_number
 */
export const getPoalimDepositTaxEventsByAccountIds =
  port<IGetPoalimDepositTaxEventsByAccountIdsQuery>(async ({ accountIds }, db) => {
    const events = await db.rows('poalim_deposit_tax_events');
    const rows = [];
    for (const fa of await db.whereIn('financial_accounts', 'id', accountIds)) {
      const [fba] = await db.where('financial_bank_accounts', { id: fa.id });
      if (!fba) continue;
      for (const e of events) {
        if (
          String(e.account_number) === fa.account_number &&
          e.bank_number === fba.bank_number &&
          e.branch_number === fba.branch_number
        ) {
          rows.push({
            financial_account_id: fa.id,
            id: e.id,
            executing_date: e.executing_date,
            event_serial_number: e.event_serial_number,
            action_type_description: e.action_type_description,
            short_product_name: e.short_product_name,
            tax_action_type_description: e.tax_action_type_description,
            tax_event_amount: e.tax_event_amount,
            debit_amount: e.debit_amount,
            crdit_amount: e.crdit_amount,
          });
        }
      }
    }
    return orderBy(rows, [
      { value: r => r.executing_date, kind: 'date' },
      { value: r => r.event_serial_number },
    ]) as never;
  });

/** SELECT user_description FROM charges WHERE tax_category_id = $taxCategoryId AND type = 'FINANCIAL' */
export const getBankDepositsRevaluationChargeDescriptions =
  port<IGetBankDepositsRevaluationChargeDescriptionsQuery>(async ({ taxCategoryId }, db) => {
    if (taxCategoryId == null) return [];
    return (await db.where('charges', { tax_category_id: taxCategoryId }))
      .filter(c => c.type === 'FINANCIAL')
      .map(c => ({ user_description: c.user_description }));
  });
