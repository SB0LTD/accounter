import {
  castUuid,
  insertRow,
  joinBusinesses,
  jsonbText,
  jsonField,
  likeEscape,
  lower,
  paramEquals,
  pgParams,
  runWritableCtes,
  uuidList,
  uuidParam,
  type UpdateStep,
} from '../_helpers.js';
import type {
  IGetAllBusinessesQuery,
  IGetBusinessByEmailQuery,
  IGetBusinessesByFiltersQuery,
  IGetBusinessesByIdsQuery,
  IInsertBusinessesQuery,
  IReplaceBusinessesQuery,
  IUpdateBusinessQuery,
} from '../../../../../modules/financial-entities/__generated__/businesses.types.js';
import { coalescePatch, inList } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';

/**
 * SELECT fe.*, b.vat_number, b.hebrew_name, ..., b.city, b.zip_code
 * FROM businesses b INNER JOIN financial_entities fe USING (id)
 * WHERE b.id IN $$ids
 */
export const getBusinessesByIds = port<IGetBusinessesByIdsQuery>(async ({ ids }, db) =>
  joinBusinesses(db, await db.whereIn('businesses', 'id', uuidList(ids))),
);

/**
 * SELECT fe.*, b.vat_number, b.hebrew_name, ..., b.city, b.zip_code
 * FROM businesses b INNER JOIN financial_entities fe USING (id)
 */
export const getAllBusinesses = port<IGetAllBusinessesQuery>(async (_params, db) =>
  joinBusinesses(db, await db.rows('businesses')),
);

/**
 * SELECT fe.*, b.vat_number, ... FROM businesses b INNER JOIN financial_entities fe USING (id)
 * WHERE ($name::TEXT IS NULL
 *     OR strpos(lower(fe.name), lower($name::TEXT)) > 0
 *     OR strpos(lower(b.hebrew_name), lower($name::TEXT)) > 0)
 *   AND (($isTaxCategoryIds = 0 AND $withoutTaxCategory::BOOLEAN IS NOT TRUE)
 *     OR ($isTaxCategoryIds = 1 AND EXISTS (SELECT 1 FROM business_tax_category_match tcm
 *           WHERE tcm.business_id = b.id AND tcm.tax_category_id IN $$taxCategoryIds))
 *     OR ($withoutTaxCategory::BOOLEAN IS TRUE AND NOT EXISTS (SELECT 1 FROM business_tax_category_match tcm
 *           WHERE tcm.business_id = b.id)))
 *   AND (($isSortCodes = 0 AND $withoutSortCode::BOOLEAN IS NOT TRUE)
 *     OR ($isSortCodes = 1 AND fe.sort_code IN $$sortCodes)
 *     OR ($withoutSortCode::BOOLEAN IS TRUE AND fe.sort_code IS NULL))
 *   AND ($isCountries = 0 OR b.country IN $$countries)
 *   AND ($isClient::BOOLEAN IS NULL OR EXISTS (SELECT 1 FROM clients c WHERE c.business_id = b.id) = $isClient::BOOLEAN)
 *   AND ($isActive::BOOLEAN IS NULL OR fe.is_active = $isActive::BOOLEAN)
 *   AND ($isAdmin::BOOLEAN IS NULL OR EXISTS (SELECT 1 FROM businesses_admin ba WHERE ba.id = b.id) = $isAdmin::BOOLEAN)
 *
 * The predicates only combine with AND / OR (the negations, IS NOT TRUE and NOT EXISTS, are
 * two-valued), so a NULL comparison can be treated as false throughout.
 */
export const getBusinessesByFilters = port<IGetBusinessesByFiltersQuery>(async (params, db) => {
  const name = params.name == null ? null : lower(String(params.name));
  const withoutTaxCategory = params.withoutTaxCategory === true;
  const withoutSortCode = params.withoutSortCode === true;
  const taxCategoryIds = inList(uuidList(params.taxCategoryIds));
  const sortCodes = inList(params.sortCodes);
  const countries = inList(params.countries);

  const matches = await db.rows('business_tax_category_match');
  const matchesByBusiness = new Map<string, string[]>();
  for (const tcm of matches) {
    const list = matchesByBusiness.get(tcm.business_id) ?? [];
    list.push(tcm.tax_category_id);
    matchesByBusiness.set(tcm.business_id, list);
  }
  const clientIds = new Set((await db.rows('clients')).map(c => c.business_id));
  const adminIds = new Set((await db.rows('businesses_admin')).map(ba => ba.id));

  const result = [];
  for (const row of await joinBusinesses(db, await db.rows('businesses'))) {
    const nameOk =
      name === null ||
      lower(row.name).includes(name) ||
      (row.hebrew_name != null && lower(row.hebrew_name).includes(name));
    if (!nameOk) continue;

    const businessMatches = matchesByBusiness.get(row.id) ?? [];
    const taxOk =
      (paramEquals(params.isTaxCategoryIds, 0) && !withoutTaxCategory) ||
      (paramEquals(params.isTaxCategoryIds, 1) && businessMatches.some(taxCategoryIds)) ||
      (withoutTaxCategory && businessMatches.length === 0);
    if (!taxOk) continue;

    const sortOk =
      (paramEquals(params.isSortCodes, 0) && !withoutSortCode) ||
      (paramEquals(params.isSortCodes, 1) && sortCodes(row.sort_code)) ||
      (withoutSortCode && row.sort_code == null);
    if (!sortOk) continue;

    if (!(paramEquals(params.isCountries, 0) || countries(row.country))) continue;
    if (params.isClient != null && clientIds.has(row.id) !== params.isClient) continue;
    if (params.isActive != null && row.is_active !== params.isActive) continue;
    if (params.isAdmin != null && adminIds.has(row.id) !== params.isAdmin) continue;
    result.push(row);
  }
  return result;
});

/** `jsonb_array_elements_text(CASE WHEN jsonb_typeof(sd->'emails') = 'array' THEN sd->'emails' ELSE '[]' END)` */
function recognitionEmails(suggestionData: unknown): (string | null)[] {
  if (
    suggestionData === null ||
    typeof suggestionData !== 'object' ||
    Array.isArray(suggestionData)
  ) {
    return [];
  }
  const emails = (suggestionData as Record<string, unknown>)['emails'];
  return Array.isArray(emails) ? emails.map(jsonbText) : [];
}

/** `replace(replace(replace(replace(lower(candidate), '#', '##'), '%', '#%'), '_', '#_'), '*', '%')` */
const emailPattern = (candidate: string) =>
  lower(candidate)
    .replaceAll('#', '##')
    .replaceAll('%', '#%')
    .replaceAll('_', '#_')
    .replaceAll('*', '%');

/**
 * SELECT fe.*, b.vat_number, ... FROM businesses b INNER JOIN financial_entities fe USING (id)
 * WHERE EXISTS (
 *   SELECT 1 FROM jsonb_array_elements_text(
 *     CASE WHEN jsonb_typeof(b.suggestion_data->'emails') = 'array' THEN b.suggestion_data->'emails'
 *          ELSE '[]'::jsonb END) AS candidate
 *   WHERE lower($email::text) LIKE
 *     replace(replace(replace(replace(lower(candidate), '#', '##'), '%', '#%'), '_', '#_'), '*', '%')
 *     ESCAPE '#')
 * LIMIT 1
 *
 * LIMIT 1 without ORDER BY: when several businesses match, Postgres returns whichever its plan
 * reaches first; this returns the first in replica order.
 */
export const getBusinessByEmail = port<IGetBusinessByEmailQuery>(async ({ email }, db) => {
  if (email == null) return [];
  const needle = lower(String(email));
  for (const row of await joinBusinesses(db, await db.rows('businesses'))) {
    const hit = recognitionEmails(row.suggestion_data).some(
      candidate => candidate != null && likeEscape(needle, emailPattern(candidate), '#'),
    );
    if (hit) return [row];
  }
  return [];
});

/**
 * UPDATE businesses SET vat_number = COALESCE($vatNumber, vat_number),
 *   hebrew_name = COALESCE($hebrewName, ...), address = COALESCE($address, ...),
 *   city = COALESCE($city, ...), zip_code = COALESCE($zipCode, ...),
 *   address_hebrew = COALESCE($addressHebrew, ...), email = COALESCE($email, ...),
 *   website = COALESCE($website, ...), phone_number = COALESCE($phoneNumber, ...),
 *   country = COALESCE($country, ...), no_invoices_required = COALESCE($isDocumentsOptional, ...),
 *   suggestion_data = COALESCE($suggestionData, ...), can_settle_with_receipt = COALESCE($isReceiptEnough, ...),
 *   exempt_dealer = COALESCE($exemptDealer, ...), optional_vat = COALESCE($optionalVat, ...),
 *   pcn874_record_type_override = COALESCE($pcn874RecordTypeOverride, ...)
 * WHERE id = $businessId RETURNING *
 */
export const updateBusiness = port<IUpdateBusinessQuery>(async (params, db) => {
  const patch = pgParams(
    'businesses',
    coalescePatch({
      vat_number: params.vatNumber,
      hebrew_name: params.hebrewName,
      address: params.address,
      city: params.city,
      zip_code: params.zipCode,
      address_hebrew: params.addressHebrew,
      email: params.email,
      website: params.website,
      phone_number: params.phoneNumber,
      country: params.country,
      no_invoices_required: params.isDocumentsOptional,
      suggestion_data: params.suggestionData,
      can_settle_with_receipt: params.isReceiptEnough,
      exempt_dealer: params.exemptDealer,
      optional_vat: params.optionalVat,
      pcn874_record_type_override: params.pcn874RecordTypeOverride,
    }) as never,
  );
  const id = uuidParam(params.businessId);
  if (id == null) return [];
  const updated = [];
  for (const b of await db.where('businesses', { id })) {
    updated.push(await db.update('businesses', b, patch));
  }
  return updated;
});

/**
 * INSERT INTO businesses (id, hebrew_name, address, city, zip_code, email, website, phone_number,
 *   vat_number, exempt_dealer, suggestion_data, optional_vat, country, pcn874_record_type_override,
 *   can_settle_with_receipt, no_invoices_required, owner_id)
 * VALUES $$businesses(id, hebrewName, address, city, zipCode, email, website, phoneNumber,
 *   governmentId, exemptDealer, suggestions, optionalVat, country, pcn874RecordTypeOverride,
 *   isReceiptEnough, isDocumentsOptional, ownerId)
 * RETURNING *
 */
export const insertBusinesses = port<IInsertBusinessesQuery>(async ({ businesses }, db) => {
  const rows = businesses.map(b =>
    pgParams('businesses', {
      id: b.id ?? null,
      hebrew_name: b.hebrewName ?? null,
      address: b.address ?? null,
      city: b.city ?? null,
      zip_code: b.zipCode ?? null,
      email: b.email ?? null,
      website: b.website ?? null,
      phone_number: b.phoneNumber ?? null,
      vat_number: b.governmentId ?? null,
      exempt_dealer: b.exemptDealer ?? null,
      suggestion_data: b.suggestions ?? null,
      optional_vat: b.optionalVat ?? null,
      country: b.country ?? null,
      pcn874_record_type_override: b.pcn874RecordTypeOverride ?? null,
      can_settle_with_receipt: b.isReceiptEnough ?? null,
      no_invoices_required: b.isDocumentsOptional ?? null,
      owner_id: b.ownerId ?? null,
    } as never),
  );
  const inserted = [];
  for (const values of rows) {
    const row = await insertRow(db, 'businesses', values);
    if (row) inserted.push(row);
  }
  return inserted;
});

/**
 * WITH ledger_debit1 AS (UPDATE ledger_records SET debit_entity1 = $target WHERE debit_entity1 = $replaced),
 *   ledger_debit2 AS (... debit_entity2 ...), ledger_credit1 AS (... credit_entity1 ...),
 *   ledger_credit2 AS (... credit_entity2 ...),
 *   documents_debtor AS (UPDATE documents SET debtor_id = ...), documents_creditor AS (... creditor_id ...),
 *   employees AS (UPDATE employees SET business_id = ...),
 *   funds AS (UPDATE pension_funds SET id = ...),
 *   business_trips_attendees AS (UPDATE business_trips_attendees SET attendee_business_id = ...),
 *   business_trips_employee_payments AS (UPDATE ... SET employee_business_id = ...),
 *   charge_unbalanced_ledger_businesses AS (UPDATE ... SET business_id = ...),
 *   charge_balance_cancellation AS (UPDATE ... SET business_id = ...),
 *   dividends AS (UPDATE dividends SET business_id = ...),
 *   shareholders AS (UPDATE shareholders SET business_id = ...),
 *   corporate_tax_variables AS (UPDATE corporate_tax_variables SET corporate_id = ...),
 *   clients AS (UPDATE clients SET business_id = ... RETURNING (integrations->>'greenInvoiceId')::uuid),
 *   security_identifiers AS (UPDATE security_identifiers SET business_id = $target
 *     WHERE business_id = $replaced
 *       AND EXISTS (SELECT 1 FROM businesses_securities WHERE id = $target))
 * UPDATE transactions SET business_id = $targetBusinessId WHERE business_id = $businessIdToReplace
 * RETURNING id
 *
 * See runWritableCtes for the order Postgres runs the parts in.
 */
export const replaceBusinesses = port<IReplaceBusinessesQuery>(
  async ({ targetBusinessId, businessIdToReplace }, db) => {
    const value = uuidParam(targetBusinessId);
    const match = uuidParam(businessIdToReplace);
    const targetIsSecurity =
      value != null && (await db.where('businesses_securities', { id: value })).length > 0;
    const set = (table: UpdateStep['table'], column: string, extra: Partial<UpdateStep> = {}) => ({
      table,
      column,
      value,
      match,
      ...extra,
    });
    const rows = await runWritableCtes(db, [
      set('ledger_records', 'debit_entity1'),
      set('ledger_records', 'debit_entity2'),
      set('ledger_records', 'credit_entity1'),
      set('ledger_records', 'credit_entity2'),
      set('documents', 'debtor_id'),
      set('documents', 'creditor_id'),
      set('employees', 'business_id'),
      set('pension_funds', 'id'),
      set('business_trips_attendees', 'attendee_business_id'),
      set('business_trips_employee_payments', 'employee_business_id'),
      set('charge_unbalanced_ledger_businesses', 'business_id'),
      set('charge_balance_cancellation', 'business_id'),
      set('dividends', 'business_id'),
      set('shareholders', 'business_id'),
      set('corporate_tax_variables', 'corporate_id'),
      set('clients', 'business_id', {
        returning: client => {
          const text = jsonField(client.integrations, 'greenInvoiceId');
          if (text != null) castUuid(text);
        },
      }),
      set('security_identifiers', 'business_id', { where: () => targetIsSecurity }),
      set('transactions', 'business_id'),
    ]);
    return rows.map(row => ({ id: row.id as string }));
  },
);
