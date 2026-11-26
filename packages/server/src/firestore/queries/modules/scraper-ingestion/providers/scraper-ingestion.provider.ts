import { insertValues } from '../_helpers.js';
import type {
  IUploadCalTransactionsQuery,
  IUploadCurrencyRatesQuery,
  IUploadDiscountTransactionsQuery,
  IUploadMaxTransactionsQuery,
} from '../../../../../modules/scraper-ingestion/__generated__/scraper-ingestion.types.js';
import { port } from '../../../port.js';

/**
 * INSERT INTO cal_creditcard_transactions (<37 columns>) VALUES $$transactions(...)
 * ON CONFLICT (trn_int_id) DO NOTHING
 * RETURNING id, trn_purchase_date, merchant_name, trn_amt, card
 */
export const uploadCalTransactions = port<IUploadCalTransactionsQuery>(
  async ({ transactions }, db) =>
    insertValues(db, {
      table: 'cal_creditcard_transactions',
      values: {
        card: 'card',
        trn_int_id: 'trnIntId',
        trn_numaretor: 'trnNumaretor',
        merchant_name: 'merchantName',
        trn_purchase_date: 'trnPurchaseDate',
        trn_amt: 'trnAmt',
        trn_currency_symbol: 'trnCurrencySymbol',
        trn_type: 'trnType',
        trn_type_code: 'trnTypeCode',
        deb_crd_date: 'debCrdDate',
        amt_before_conv_and_index: 'amtBeforeConvAndIndex',
        deb_crd_currency_symbol: 'debCrdCurrencySymbol',
        merchant_address: 'merchantAddress',
        merchant_phone_no: 'merchantPhoneNo',
        branch_code_desc: 'branchCodeDesc',
        trans_card_present_ind: 'transCardPresentInd',
        cur_payment_num: 'curPaymentNum',
        num_of_payments: 'numOfPayments',
        token_ind: 'tokenInd',
        wallet_provider_code: 'walletProviderCode',
        wallet_provider_desc: 'walletProviderDesc',
        token_number_part4: 'tokenNumberPart4',
        cash_account_trn_amt: 'cashAccountTrnAmt',
        charge_external_to_card_comment: 'chargeExternalToCardComment',
        refund_ind: 'refundInd',
        is_immediate_comment_ind: 'isImmediateCommentInd',
        is_immediate_hhk_ind: 'isImmediateHhkInd',
        is_margarita: 'isMargarita',
        is_spread_paymenst_abroad: 'isSpreadPaymenstAbroad',
        trn_exac_way: 'trnExacWay',
        debit_spread_ind: 'debitSpreadInd',
        on_going_transactions_comment: 'onGoingTransactionsComment',
        early_payment_ind: 'earlyPaymentInd',
        merchant_id: 'merchantId',
        crd_ext_id_num_type_code: 'crdExtIdNumTypeCode',
        trans_source: 'transSource',
        is_abroad_transaction: 'isAbroadTransaction',
      },
      rows: transactions,
      onConflict: { target: ['trn_int_id'], action: 'nothing' },
      returning: ['id', 'trn_purchase_date', 'merchant_name', 'trn_amt', 'card'],
    }) as never,
);

/**
 * INSERT INTO bank_discount_transactions (<30 columns>) VALUES $$transactions(...)
 * ON CONFLICT (urn, account_number) WHERE urn IS NOT NULL AND account_number IS NOT NULL DO NOTHING
 * RETURNING id, operation_date, operation_description, operation_amount, account_number
 */
export const uploadDiscountTransactions = port<IUploadDiscountTransactionsQuery>(
  async ({ transactions }, db) =>
    insertValues(db, {
      table: 'bank_discount_transactions',
      values: {
        operation_date: 'operationDate',
        value_date: 'valueDate',
        operation_code: 'operationCode',
        operation_description: 'operationDescription',
        operation_description2: 'operationDescription2',
        operation_description3: 'operationDescription3',
        operation_branch: 'operationBranch',
        operation_bank: 'operationBank',
        account_number: 'accountNumber',
        channel: 'channel',
        channel_name: 'channelName',
        check_number: 'checkNumber',
        institute_code: 'instituteCode',
        operation_amount: 'operationAmount',
        balance_after_operation: 'balanceAfterOperation',
        operation_number: 'operationNumber',
        branch_treasury_number: 'branchTreasuryNumber',
        urn: 'urn',
        operation_details_service_name: 'operationDetailsServiceName',
        commission_channel_code: 'commissionChannelCode',
        commission_channel_name: 'commissionChannelName',
        commission_type_name: 'commissionTypeName',
        business_day_date: 'businessDayDate',
        event_name: 'eventName',
        category_code: 'categoryCode',
        category_desc_code: 'categoryDescCode',
        category_description: 'categoryDescription',
        operation_description_to_display: 'operationDescriptionToDisplay',
        operation_order: 'operationOrder',
        is_last_seen: 'isLastSeen',
      },
      rows: transactions,
      onConflict: { target: ['urn', 'account_number'], action: 'nothing' },
      returning: [
        'id',
        'operation_date',
        'operation_description',
        'operation_amount',
        'account_number',
      ],
    }) as never,
);

/**
 * INSERT INTO max_creditcard_transactions (<87 columns>) VALUES $$transactions(...)
 * ON CONFLICT (uid, arn, purchase_date, payment_date, original_amount) DO NOTHING
 * RETURNING id, purchase_date, merchant_name, actual_payment_amount, card_index
 */
export const uploadMaxTransactions = port<IUploadMaxTransactionsQuery>(
  async ({ transactions }, db) =>
    insertValues(db, {
      table: 'max_creditcard_transactions',
      values: {
        actual_payment_amount: 'actualPaymentAmount',
        arn: 'arn',
        card_index: 'cardIndex',
        category_id: 'categoryId',
        comments: 'comments',
        deal_data_acq: 'dealDataAcq',
        deal_data_adjustment_amount: 'dealDataAdjustmentAmount',
        deal_data_adjustment_type: 'dealDataAdjustmentType',
        deal_data_amount: 'dealDataAmount',
        deal_data_amount_ils: 'dealDataAmountIls',
        deal_data_amount_left: 'dealDataAmountLeft',
        deal_data_arn: 'dealDataArn',
        deal_data_authorization_number: 'dealDataAuthorizationNumber',
        deal_data_card_name: 'dealDataCardName',
        deal_data_card_token: 'dealDataCardToken',
        deal_data_commission_vat: 'dealDataCommissionVat',
        deal_data_direct_exchange: 'dealDataDirectExchange',
        deal_data_exchange_commission_amount: 'dealDataExchangeCommissionAmount',
        deal_data_exchange_commission_maam: 'dealDataExchangeCommissionMaam',
        deal_data_exchange_commission_type: 'dealDataExchangeCommissionType',
        deal_data_exchange_direct: 'dealDataExchangeDirect',
        deal_data_exchange_rate: 'dealDataExchangeRate',
        deal_data_index_rate_base: 'dealDataIndexRateBase',
        deal_data_index_rate_pmt: 'dealDataIndexRatePmt',
        deal_data_interest_amount: 'dealDataInterestAmount',
        deal_data_is_allowed_spread_with_benefit: 'dealDataIsAllowedSpreadWithBenefit',
        deal_data_issuer_currency: 'dealDataIssuerCurrency',
        deal_data_issuer_exchange_rate: 'dealDataIssuerExchangeRate',
        deal_data_original_term: 'dealDataOriginalTerm',
        deal_data_percent_maam: 'dealDataPercentMaam',
        deal_data_plan: 'dealDataPlan',
        deal_data_pos_entry_emv: 'dealDataPosEntryEmv',
        deal_data_processing_date: 'dealDataProcessingDate',
        deal_data_purchase_amount: 'dealDataPurchaseAmount',
        deal_data_purchase_time: 'dealDataPurchaseTime',
        deal_data_ref_nbr: 'dealDataRefNbr',
        deal_data_show_cancel_debit: 'dealDataShowCancelDebit',
        deal_data_show_spread: 'dealDataShowSpread',
        deal_data_show_spread_benefit_button: 'dealDataShowSpreadBenefitButton',
        deal_data_show_spread_button: 'dealDataShowSpreadButton',
        deal_data_show_spread_for_leumi: 'dealDataShowSpreadForLeumi',
        deal_data_tdm_card_token: 'dealDataTdmCardToken',
        deal_data_tdm_transaction_type: 'dealDataTdmTransactionType',
        deal_data_transaction_type: 'dealDataTransactionType',
        deal_data_txn_code: 'dealDataTxnCode',
        deal_data_user_name: 'dealDataUserName',
        deal_data_withdrawal_commission_amount: 'dealDataWithdrawalCommissionAmount',
        discount_key_amount: 'discountKeyAmount',
        discount_key_rec_type: 'discountKeyRecType',
        ethoca_ind: 'ethocaInd',
        funds_transfer_comment: 'fundsTransferComment',
        funds_transfer_receiver_or_transfer: 'fundsTransferReceiverOrTransfer',
        is_register_ch: 'isRegisterCh',
        is_spreading_autorization_allowed: 'isSpreadingAutorizationAllowed',
        issuer_id: 'issuerId',
        merchant_address: 'merchantAddress',
        merchant_coordinates: 'merchantCoordinates',
        merchant_max_phone: 'merchantMaxPhone',
        merchant: 'merchant',
        merchant_commercial_name: 'merchantCommercialName',
        merchant_number: 'merchantNumber',
        merchant_phone: 'merchantPhone',
        merchant_tax_id: 'merchantTaxId',
        merchant_name: 'merchantName',
        original_amount: 'originalAmount',
        original_currency: 'originalCurrency',
        payment_currency: 'paymentCurrency',
        payment_date: 'paymentDate',
        plan_name: 'planName',
        plan_type_id: 'planTypeId',
        promotion_amount: 'promotionAmount',
        promotion_club: 'promotionClub',
        promotion_type: 'promotionType',
        purchase_date: 'purchaseDate',
        receipt_p_d_f: 'receiptPDF',
        ref_index: 'refIndex',
        runtime_reference_internal_id: 'runtimeReferenceInternalId',
        runtime_reference_type: 'runtimeReferenceType',
        runtime_reference_id: 'runtimeReferenceId',
        short_card_number: 'shortCardNumber',
        spread_transaction_by_campain_ind: 'spreadTransactionByCampainInd',
        spread_transaction_by_campain_number: 'spreadTransactionByCampainNumber',
        table_type: 'tableType',
        tag: 'tag',
        uid: 'uid',
        up_sale_for_transaction_result: 'upSaleForTransactionResult',
        user_index: 'userIndex',
      },
      rows: transactions,
      onConflict: {
        target: ['uid', 'arn', 'purchase_date', 'payment_date', 'original_amount'],
        action: 'nothing',
      },
      returning: ['id', 'purchase_date', 'merchant_name', 'actual_payment_amount', 'card_index'],
    }) as never,
);

/**
 * INSERT INTO exchange_rates (<8 columns>) VALUES $$rates(...)
 * ON CONFLICT (exchange_date) DO NOTHING
 * RETURNING exchange_date, usd, eur, gbp, cad, jpy, aud, sek
 */
export const uploadCurrencyRates = port<IUploadCurrencyRatesQuery>(
  async ({ rates }, db) =>
    insertValues(db, {
      table: 'exchange_rates',
      values: {
        exchange_date: 'exchangeDate',
        usd: 'usd',
        eur: 'eur',
        gbp: 'gbp',
        cad: 'cad',
        jpy: 'jpy',
        aud: 'aud',
        sek: 'sek',
      },
      rows: rates,
      onConflict: { target: ['exchange_date'], action: 'nothing' },
      returning: ['exchange_date', 'usd', 'eur', 'gbp', 'cad', 'jpy', 'aud', 'sek'],
    }) as never,
);
