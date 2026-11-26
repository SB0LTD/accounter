import { APPLE_KEY, IWDA_KEY, otherOwner, SB1, SB2, SB3 } from '../_fixture.js';
import type {
  IGetSecurityBusinessesByIdentifiersQuery,
  IGetSecurityBusinessesByIdsQuery,
  IGetSecurityBusinessesByIsinsQuery,
  IGetSecurityIdentifiersByBusinessIdsQuery,
  IInsertSecurityBusinessQuery,
  IInsertSecurityIdentifierQuery,
  IUpdateSecurityBusinessesIsForeignQuery,
} from '../../../../../modules/foreign-securities/__generated__/security-businesses.types.js';
import { caseFor, type Cases, type Snapshot } from '../../../cases.js';

/** A business of the tenant that is not a security business yet. */
const plainBusiness = (s: Snapshot) => {
  const securities = new Set(s.rows('businesses_securities').map(row => row.id));
  return s
    .rows('businesses')
    .filter(row => row.owner_id === s.businessId && row.id !== s.businessId)
    .map(row => row.id as string)
    .find(id => !securities.has(id))!;
};

const newSecurity = (s: Snapshot) => ({
  id: plainBusiness(s),
  ownerId: s.businessId,
  isin: 'US5949181045',
  symbol: 'MSFT',
  engName: 'Microsoft Corporation',
  hebName: null,
  exchange: 'NASDAQ',
  currencyCode: 'USD' as const,
  itemType: null,
  stockType: null,
  isEtf: false,
  isForeign: true,
  issuerCountryCode: 'US',
});

export const cases: Cases = {
  getSecurityBusinessesByIds: caseFor<IGetSecurityBusinessesByIdsQuery>(s => [
    { ids: [SB1, SB2, SB3, s.missingId] }, // SB3 is another business's
    { ids: [s.missingId] },
  ]),
  getSecurityBusinessesByIsins: caseFor<IGetSecurityBusinessesByIsinsQuery>(() => [
    { isins: ['US0378331005', 'IE00B4L5Y983'] },
    { isins: ['XX0000000000'] },
    { isins: [] },
  ]),
  getSecurityBusinessesByIdentifiers: caseFor<IGetSecurityBusinessesByIdentifiersQuery>(s => [
    {
      ownerId: s.businessId,
      identifierType: 'POALIM_SECURITY_KEY',
      identifierValues: [APPLE_KEY, IWDA_KEY, 'nope'],
    },
    { ownerId: s.businessId, identifierType: 'ISIN', identifierValues: ['US0378331005'] },
    { ownerId: s.businessId, identifierType: 'ISIN', identifierValues: [APPLE_KEY] },
    {
      ownerId: otherOwner(s),
      identifierType: 'POALIM_SECURITY_KEY',
      identifierValues: [APPLE_KEY],
    },
  ]),
  getSecurityIdentifiersByBusinessIds: caseFor<IGetSecurityIdentifiersByBusinessIdsQuery>(s => [
    { businessIds: [SB1, SB2, SB3] }, // POALIM_SECURITY_KEY sorts before ISIN (enum order)
    { businessIds: [SB2] },
    { businessIds: [s.missingId] },
  ]),
  insertSecurityBusiness: caseFor<IInsertSecurityBusinessQuery>(s => [
    newSecurity(s),
    {
      ...newSecurity(s),
      symbol: null,
      engName: null,
      exchange: null,
      currencyCode: null,
      isEtf: null,
      isForeign: null,
      issuerCountryCode: null,
    },
    { ...newSecurity(s), isin: 'US0378331005' }, // the owner already has this ISIN: 23505
    { ...newSecurity(s), id: SB1 }, // already a security business: 23505
    { ...newSecurity(s), id: s.missingId }, // not a business: 23503
    { ...newSecurity(s), ownerId: otherOwner(s) }, // another business: 42501
  ]),
  updateSecurityBusinessesIsForeign: caseFor<IUpdateSecurityBusinessesIsForeignQuery>(s => [
    { ids: [SB1, SB2, SB3], isForeign: false },
    { ids: [SB2], isForeign: true },
    { ids: [s.missingId], isForeign: true },
    { ids: [], isForeign: true },
  ]),
  insertSecurityIdentifier: caseFor<IInsertSecurityIdentifierQuery>(s => [
    {
      ownerId: s.businessId,
      businessId: SB2,
      identifierType: 'POALIM_SECURITY_KEY',
      identifierValue: '5555555',
    },
    // exists: DO NOTHING
    {
      ownerId: s.businessId,
      businessId: SB2,
      identifierType: 'POALIM_SECURITY_KEY',
      identifierValue: APPLE_KEY,
    },
    {
      ownerId: s.businessId,
      businessId: s.missingId,
      identifierType: 'ISIN',
      identifierValue: 'XX1',
    }, // 23503
    { ownerId: otherOwner(s), businessId: SB3, identifierType: 'ISIN', identifierValue: 'XX2' }, // 42501
  ]),
};
