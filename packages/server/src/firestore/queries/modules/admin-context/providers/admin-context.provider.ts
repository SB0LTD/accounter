import type {
  IGetAdminContextsQuery,
  IGetSecuritiesContextForUpdateQuery,
  IGetSecurityBusinessIdsQuery,
  IUpdateAdminContextParams,
  IUpdateAdminContextQuery,
  IUpdateSecuritiesContextQuery,
} from '../../../../../modules/admin-context/__generated__/admin-context.types.js';
import type { Row } from '../../../../catalog.js';
import { coalescePatch } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';

/** SELECT * FROM user_context WHERE owner_id IN $$ownerIds */
export const getAdminContexts = port<IGetAdminContextsQuery>(
  async ({ ownerIds }, db) => (await db.whereIn('user_context', 'owner_id', ownerIds)) as never,
);

/** SELECT id, owner_id FROM businesses_securities WHERE owner_id IN $$ownerIds */
export const getSecurityBusinessIds = port<IGetSecurityBusinessIdsQuery>(async ({ ownerIds }, db) =>
  (await db.whereIn('businesses_securities', 'owner_id', ownerIds)).map(row => ({
    id: row.id,
    owner_id: row.owner_id,
  })),
);

/** The `col = COALESCE($param, col)` pairs of updateAdminContext's SET list, in its order. */
function adminContextPatch(params: IUpdateAdminContextParams): Partial<Row<'user_context'>> {
  return coalescePatch({
    default_local_currency: params.defaultLocalCurrency,
    default_fiat_currency_for_crypto_conversions: params.defaultFiatCurrencyForCryptoConversions,
    default_tax_category_id: params.defaultTaxCategoryId,
    vat_business_id: params.vatBusinessId,
    input_vat_tax_category_id: params.inputVatTaxCategoryId,
    output_vat_tax_category_id: params.outputVatTaxCategoryId,
    property_output_vat_tax_category_id: params.propertyOutputVatTaxCategoryId,
    tax_business_id: params.taxBusinessId,
    tax_expenses_tax_category_id: params.taxExpensesTaxCategoryId,
    social_security_business_id: params.socialSecurityBusinessId,
    exchange_rate_tax_category_id: params.exchangeRateTaxCategoryId,
    income_exchange_rate_tax_category_id: params.incomeExchangeRateTaxCategoryId,
    exchange_rate_revaluation_tax_category_id: params.exchangeRateRevaluationTaxCategoryId,
    fee_tax_category_id: params.feeTaxCategoryId,
    general_fee_tax_category_id: params.generalFeeTaxCategoryId,
    fine_tax_category_id: params.fineTaxCategoryId,
    untaxable_gifts_tax_category_id: params.untaxableGiftsTaxCategoryId,
    balance_cancellation_tax_category_id: params.balanceCancellationTaxCategoryId,
    development_foreign_tax_category_id: params.developmentForeignTaxCategoryId,
    development_local_tax_category_id: params.developmentLocalTaxCategoryId,
    accumulated_depreciation_tax_category_id: params.accumulatedDepreciationTaxCategoryId,
    rnd_depreciation_expenses_tax_category_id: params.rndDepreciationExpensesTaxCategoryId,
    gnm_depreciation_expenses_tax_category_id: params.gnmDepreciationExpensesTaxCategoryId,
    marketing_depreciation_expenses_tax_category_id:
      params.marketingDepreciationExpensesTaxCategoryId,
    depreciation_disposal_gain_tax_category_id: params.depreciationDisposalGainTaxCategoryId,
    depreciation_disposal_loss_tax_category_id: params.depreciationDisposalLossTaxCategoryId,
    depreciation_correction_tax_category_id: params.depreciationCorrectionTaxCategoryId,
    bank_deposit_interest_income_tax_category_id: params.bankDepositInterestIncomeTaxCategoryId,
    bank_deposit_withholding_tax_category_id: params.bankDepositWithholdingTaxCategoryId,
    business_trip_tax_category_id: params.businessTripTaxCategoryId,
    business_trip_tag_id: params.businessTripTagId,
    expenses_to_pay_tax_category_id: params.expensesToPayTaxCategoryId,
    expenses_in_advance_tax_category_id: params.expensesInAdvanceTaxCategoryId,
    income_to_collect_tax_category_id: params.incomeToCollectTaxCategoryId,
    income_in_advance_tax_category_id: params.incomeInAdvanceTaxCategoryId,
    zkufot_expenses_tax_category_id: params.zkufotExpensesTaxCategoryId,
    zkufot_income_tax_category_id: params.zkufotIncomeTaxCategoryId,
    social_security_expenses_tax_category_id: params.socialSecurityExpensesTaxCategoryId,
    salary_expenses_tax_category_id: params.salaryExpensesTaxCategoryId,
    training_fund_expenses_tax_category_id: params.trainingFundExpensesTaxCategoryId,
    pension_fund_expenses_tax_category_id: params.pensionFundExpensesTaxCategoryId,
    compensation_fund_expenses_tax_category_id: params.compensationFundExpensesTaxCategoryId,
    batched_employees_business_id: params.batchedEmployeesBusinessId,
    batched_funds_business_id: params.batchedFundsBusinessId,
    tax_deductions_business_id: params.taxDeductionsBusinessId,
    recovery_reserve_expenses_tax_category_id: params.recoveryReserveExpensesTaxCategoryId,
    recovery_reserve_tax_category_id: params.recoveryReserveTaxCategoryId,
    vacation_reserve_expenses_tax_category_id: params.vacationReserveExpensesTaxCategoryId,
    vacation_reserve_tax_category_id: params.vacationReserveTaxCategoryId,
    poalim_business_id: params.poalimBusinessId,
    discount_business_id: params.discountBusinessId,
    otsar_hahayal_business_id: params.otsarHahayalBusinessId,
    isracard_business_id: params.isracardBusinessId,
    amex_business_id: params.amexBusinessId,
    cal_business_id: params.calBusinessId,
    otsar_hahayal_credit_card_business_id: params.otsarHahayalCreditCardBusinessId,
    etana_business_id: params.etanaBusinessId,
    kraken_business_id: params.krakenBusinessId,
    etherscan_business_id: params.etherscanBusinessId,
    swift_business_id: params.swiftBusinessId,
    bank_deposit_business_id: params.bankDepositBusinessId,
    dividend_withholding_tax_business_id: params.dividendWithholdingTaxBusinessId,
    dividend_tax_category_id: params.dividendTaxCategoryId,
    salary_excess_expenses_tax_category_id: params.salaryExcessExpensesTaxCategoryId,
    ledger_lock: params.ledgerLock,
    date_established: params.dateEstablished,
    initial_accounter_year: params.initialAccounterYear,
    locality: params.locality,
  }) as Partial<Row<'user_context'>>;
}

/**
 * UPDATE user_context SET default_local_currency = COALESCE($defaultLocalCurrency,
 * default_local_currency), ... (68 columns, see adminContextPatch) WHERE owner_id = $ownerId
 * RETURNING *
 */
export const updateAdminContext = port<IUpdateAdminContextQuery>(async (params, db) => {
  if (params.ownerId == null) return [];
  const patch = adminContextPatch(params);
  const result = [];
  for (const row of await db.where('user_context', { owner_id: params.ownerId })) {
    result.push(await db.update('user_context', row, patch));
  }
  return result as never;
});

/**
 * SELECT securities_context FROM user_context WHERE owner_id = $ownerId! FOR UPDATE
 *
 * FOR UPDATE has nothing to lock here: the store commits a transaction's writes as one batch, with
 * preconditions on the rows it read.
 */
export const getSecuritiesContextForUpdate = port<IGetSecuritiesContextForUpdateQuery>(
  async ({ ownerId }, db) =>
    (await db.where('user_context', { owner_id: ownerId })).map(row => ({
      securities_context: row.securities_context,
    })),
);

/**
 * UPDATE user_context SET securities_context = $securitiesContext! WHERE owner_id = $ownerId!
 * RETURNING *
 */
export const updateSecuritiesContext = port<IUpdateSecuritiesContextQuery>(
  async ({ ownerId, securitiesContext }, db) => {
    const result = [];
    for (const row of await db.where('user_context', { owner_id: ownerId })) {
      result.push(await db.update('user_context', row, { securities_context: securitiesContext }));
    }
    return result as never;
  },
);
