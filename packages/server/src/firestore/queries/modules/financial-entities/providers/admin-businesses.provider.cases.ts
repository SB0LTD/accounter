import { FX } from '../_fixture-ids.js';
import type {
  IGetAdminBusinessesByIdsQuery,
  IInsertAdminBusinessQuery,
  IUpdateAdminBusinessesQuery,
} from '../../../../../modules/financial-entities/__generated__/admin-businesses.types.js';
import { caseFor, type Cases } from '../../../cases.js';

export const cases: Cases = {
  getAdminBusinessesByIds: caseFor<IGetAdminBusinessesByIdsQuery>(s => [
    { ids: [s.businessId, FX.iota, FX.zeta, s.missingId] },
    { ids: [FX.iota.toUpperCase()] },
    { ids: [s.missingId] },
  ]),
  updateAdminBusinesses: caseFor<IUpdateAdminBusinessesQuery>(s => [
    {
      id: FX.iota,
      companyTaxId: '987654321',
      businessRegistrationStartDate: '2021-05-01' as never,
      advanceTaxRates: [{ date: '2025-01-01', rate: 0.2 }],
    },
    // nothing to change: the row comes back as it is
    { id: FX.iota },
    {
      id: FX.iota,
      taxAdvancesIds: [],
      socialSecurityEmployerIds: [{ year: 2024, id: 'SS-1' }],
      withholdingTaxAnnualIds: [
        { year: 2023, id: 'W-1' },
        { year: 2024, id: 'W-2' },
      ],
    },
    { id: s.businessId, companyTaxId: '1' },
    // varchar(9): too long raises, trailing spaces are cut
    { id: FX.iota, companyTaxId: '1234567890' },
    { id: FX.iota, companyTaxId: '123456789   ' },
    // no row: the length is never checked
    { id: s.missingId, companyTaxId: '1234567890' },
    { id: 'not-a-uuid', companyTaxId: '1' },
  ]),
  insertAdminBusiness: caseFor<IInsertAdminBusinessQuery>(s => [
    { id: s.businessId }, // exists: DO NOTHING
    { id: FX.zeta }, // owner_id = id, another tenant: RLS
    { id: null },
  ]),
};
