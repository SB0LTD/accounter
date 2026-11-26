import type {
  IGetAllSecurityBusinessesQuery,
  IGetSecurityBusinessesByIdentifiersQuery,
  IGetSecurityBusinessesByIdsQuery,
  IGetSecurityBusinessesByIsinsQuery,
  IGetSecurityIdentifiersByBusinessIdsQuery,
  IInsertSecurityBusinessQuery,
  IInsertSecurityIdentifierQuery,
  IUpdateSecurityBusinessesIsForeignQuery,
} from '../../../../../modules/foreign-securities/__generated__/security-businesses.types.js';
import type { Row } from '../../../../catalog.js';
import { inList, orderBy } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';

/** SELECT * FROM businesses_securities WHERE id IN $$ids */
export const getSecurityBusinessesByIds = port<IGetSecurityBusinessesByIdsQuery>(
  async ({ ids }, db) => db.whereIn('businesses_securities', 'id', ids),
);

/** SELECT * FROM businesses_securities */
export const getAllSecurityBusinesses = port<IGetAllSecurityBusinessesQuery>(async (_params, db) =>
  db.rows('businesses_securities'),
);

/** SELECT * FROM businesses_securities WHERE isin = ANY($isins!) */
export const getSecurityBusinessesByIsins = port<IGetSecurityBusinessesByIsinsQuery>(
  async ({ isins }, db) =>
    isins == null ? [] : db.whereIn('businesses_securities', 'isin', isins),
);

/**
 * SELECT si.identifier_value, si.owner_id AS identifier_owner_id, bs.*
 * FROM security_identifiers si
 * INNER JOIN businesses_securities bs ON bs.id = si.business_id
 * WHERE si.owner_id = $ownerId! AND si.identifier_type = $identifierType!
 *   AND si.identifier_value = ANY($identifierValues!)
 */
export const getSecurityBusinessesByIdentifiers = port<IGetSecurityBusinessesByIdentifiersQuery>(
  async ({ ownerId, identifierType, identifierValues }, db) => {
    if (ownerId == null || identifierType == null || identifierValues == null) return [];
    const wanted = inList(identifierValues);
    const identifiers = (
      await db.where('security_identifiers', {
        owner_id: ownerId,
        identifier_type: identifierType,
      })
    ).filter(si => wanted(si.identifier_value));
    const businesses = new Map(
      (
        await db.whereIn(
          'businesses_securities',
          'id',
          identifiers.map(si => si.business_id),
        )
      ).map(bs => [bs.id, bs]),
    );
    return identifiers.flatMap(si => {
      const bs = businesses.get(si.business_id);
      return bs
        ? [{ identifier_value: si.identifier_value, identifier_owner_id: si.owner_id, ...bs }]
        : [];
    });
  },
);

/**
 * SELECT * FROM security_identifiers WHERE business_id IN $$businessIds
 * ORDER BY identifier_type, identifier_value
 *
 * identifier_type is an enum: it orders by declaration (POALIM_SECURITY_KEY before ISIN).
 */
export const getSecurityIdentifiersByBusinessIds = port<IGetSecurityIdentifiersByBusinessIdsQuery>(
  async ({ businessIds }, db) =>
    orderBy(await db.whereIn('security_identifiers', 'business_id', businessIds), [
      { value: si => si.identifier_type, enumType: 'security_identifier_type' },
      { value: si => si.identifier_value },
    ]),
);

/**
 * INSERT INTO businesses_securities (id, owner_id, isin, symbol, eng_name, heb_name, exchange,
 *   currency_code, item_type, stock_type, is_etf, is_foreign, issuer_country_code)
 * VALUES ($id!, $ownerId!, $isin!, $symbol, $engName, $hebName, $exchange,
 *   $currencyCode, $itemType, $stockType, $isEtf, $isForeign, $issuerCountryCode)
 * RETURNING *
 */
export const insertSecurityBusiness = port<IInsertSecurityBusinessQuery>(async (params, db) => {
  const row = await db.insert('businesses_securities', {
    id: params.id ?? null,
    owner_id: params.ownerId ?? null,
    isin: params.isin ?? null,
    symbol: params.symbol ?? null,
    eng_name: params.engName ?? null,
    heb_name: params.hebName ?? null,
    exchange: params.exchange ?? null,
    currency_code: params.currencyCode ?? null,
    item_type: params.itemType ?? null,
    stock_type: params.stockType ?? null,
    is_etf: params.isEtf ?? null,
    is_foreign: params.isForeign ?? null,
    issuer_country_code: params.issuerCountryCode ?? null,
  } as never);
  return row ? [row] : [];
});

/**
 * UPDATE businesses_securities SET is_foreign = $isForeign! WHERE id = ANY($ids!) RETURNING *
 * (updated_at is set by the table's BEFORE UPDATE trigger)
 */
export const updateSecurityBusinessesIsForeign = port<IUpdateSecurityBusinessesIsForeignQuery>(
  async ({ ids, isForeign }, db) => {
    if (ids == null) return [];
    const result: Row<'businesses_securities'>[] = [];
    for (const row of await db.whereIn('businesses_securities', 'id', ids)) {
      result.push(await db.update('businesses_securities', row, { is_foreign: isForeign ?? null }));
    }
    return result;
  },
);

/**
 * INSERT INTO security_identifiers (owner_id, business_id, identifier_type, identifier_value)
 * VALUES ($ownerId!, $businessId!, $identifierType!, $identifierValue!)
 * ON CONFLICT (owner_id, identifier_type, identifier_value) DO NOTHING
 */
export const insertSecurityIdentifier = port<IInsertSecurityIdentifierQuery>(
  async ({ ownerId, businessId, identifierType, identifierValue }, db) => {
    await db.insert(
      'security_identifiers',
      {
        owner_id: (ownerId ?? null) as never,
        business_id: (businessId ?? null) as never,
        identifier_type: (identifierType ?? null) as never,
        identifier_value: (identifierValue ?? null) as never,
      },
      { target: ['owner_id', 'identifier_type', 'identifier_value'], action: 'nothing' },
    );
    return [];
  },
);
