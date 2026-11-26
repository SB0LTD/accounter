import { insertRow, pgParams } from '../_helpers.js';
import type {
  IEnsureBusinessQuery,
  IEnsureCountryQuery,
  IEnsureFinancialEntityQuery,
  IEnsureTaxCategoryQuery,
} from '../../../../../modules/financial-entities/__generated__/entity-ensure.types.js';
import { port } from '../../../port.js';

/**
 * INSERT INTO financial_entities (id, name, type, owner_id)
 * VALUES ($id, $name, $type, $ownerId) ON CONFLICT (id) DO NOTHING
 */
export const ensureFinancialEntity = port<IEnsureFinancialEntityQuery>(
  async ({ id, name, type, ownerId }, db) => {
    await insertRow(
      db,
      'financial_entities',
      pgParams('financial_entities', {
        id: id ?? null,
        name: name ?? null,
        type: type ?? null,
        owner_id: ownerId ?? null,
      } as never),
      { target: ['id'], action: 'nothing' },
    );
    return [];
  },
);

/**
 * INSERT INTO businesses (id, hebrew_name, address, city, zip_code, email, website, phone_number,
 *   vat_number, exempt_dealer, optional_vat, country, can_settle_with_receipt, no_invoices_required,
 *   owner_id)
 * VALUES ($id, $hebrewName, $address, $city, $zipCode, $email, $website, $phoneNumber,
 *   $governmentId, $exemptDealer, $optionalVat, $country, $isReceiptEnough, $isDocumentsOptional,
 *   $ownerId)
 * ON CONFLICT (id) DO NOTHING
 */
export const ensureBusiness = port<IEnsureBusinessQuery>(async (params, db) => {
  await insertRow(
    db,
    'businesses',
    pgParams('businesses', {
      id: params.id ?? null,
      hebrew_name: params.hebrewName ?? null,
      address: params.address ?? null,
      city: params.city ?? null,
      zip_code: params.zipCode ?? null,
      email: params.email ?? null,
      website: params.website ?? null,
      phone_number: params.phoneNumber ?? null,
      vat_number: params.governmentId ?? null,
      exempt_dealer: params.exemptDealer ?? null,
      optional_vat: params.optionalVat ?? null,
      country: params.country ?? null,
      can_settle_with_receipt: params.isReceiptEnough ?? null,
      no_invoices_required: params.isDocumentsOptional ?? null,
      owner_id: params.ownerId ?? null,
    } as never),
    { target: ['id'], action: 'nothing' },
  );
  return [];
});

/**
 * INSERT INTO tax_categories (id, hashavshevet_name, tax_excluded, owner_id)
 * VALUES ($id, $hashavshevetName, $taxExcluded, $ownerId) ON CONFLICT (id) DO NOTHING
 */
export const ensureTaxCategory = port<IEnsureTaxCategoryQuery>(
  async ({ id, hashavshevetName, taxExcluded, ownerId }, db) => {
    await insertRow(
      db,
      'tax_categories',
      pgParams('tax_categories', {
        id: id ?? null,
        hashavshevet_name: hashavshevetName ?? null,
        tax_excluded: taxExcluded ?? null,
        owner_id: ownerId ?? null,
      } as never),
      { target: ['id'], action: 'nothing' },
    );
    return [];
  },
);

/** INSERT INTO countries (code, name) VALUES ($code, $name) ON CONFLICT (code) DO NOTHING */
export const ensureCountry = port<IEnsureCountryQuery>(async ({ code, name }, db) => {
  await insertRow(
    db,
    'countries',
    pgParams('countries', { code: code ?? null, name: name ?? null } as never),
    { target: ['code'], action: 'nothing' },
  );
  return [];
});
