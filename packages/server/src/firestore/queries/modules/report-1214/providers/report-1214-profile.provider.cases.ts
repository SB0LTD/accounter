import type {
  IGetReport1214ProfilesByOwnerAndYearsQuery,
  IUpsertReport1214ProfileQuery,
} from '../../../../../modules/report-1214/__generated__/report-1214-profile.types.js';
import { caseFor, type Cases } from '../../../cases.js';

const blocks = {
  company: null,
  declarations: null,
  preparer: null,
  attachments: null,
  bankAccount: null,
  otherTaxableIncome: null,
  capitalGainsSummary: null,
  qualifyingCompany: null,
  relatedCompanies: null,
  rdInvestments: null,
  amountOverrides: null,
};

export const cases: Cases = {
  getReport1214ProfilesByOwnerAndYears: caseFor<IGetReport1214ProfilesByOwnerAndYearsQuery>(s => [
    { ownerIds: [s.businessId, s.businessId], years: [2023, 2024] },
    { ownerIds: [s.businessId], years: [2024] },
    // padded with NULL: only the first pair can match
    { ownerIds: [s.businessId, s.businessId], years: [2023] },
    { ownerIds: [s.missingId], years: [2024] },
    { ownerIds: null, years: [2024] },
    // not a smallint
    { ownerIds: [s.businessId], years: [70000] },
  ]),
  upsertReport1214Profile: caseFor<IUpsertReport1214ProfileQuery>(s => [
    // a new year, every block defaulted
    { ...blocks, ownerId: s.businessId, year: 2025 },
    // a new year with blocks as text (as the provider sends them)
    {
      ...blocks,
      ownerId: s.businessId,
      year: 2022,
      company: JSON.stringify({ phone: '050', address: { city: 'TLV' } }),
      relatedCompanies: JSON.stringify([{ name: 'A' }, { name: 'B' }]),
      amountOverrides: JSON.stringify({ '010': 12.5 }),
    },
    // the stored year: given blocks replace, NULL ones are kept
    {
      ...blocks,
      ownerId: s.businessId,
      year: 2023,
      company: '{}',
      rdInvestments: JSON.stringify([{ amount: 1000 }]),
    },
    // nothing given: the row is kept (and its updated_at moves)
    { ...blocks, ownerId: s.businessId, year: 2023 },
    // a block of the wrong JSON type: CHECK
    { ...blocks, ownerId: s.businessId, year: 2023, relatedCompanies: '{}' },
    { ...blocks, ownerId: s.businessId, year: 2025, company: '[]' },
    // a JSON null is not SQL NULL: COALESCE keeps it and the CHECK fails
    { ...blocks, ownerId: s.businessId, year: 2023, preparer: 'null' },
    // not JSON
    { ...blocks, ownerId: s.businessId, year: 2023, preparer: 'not json' },
    // year out of the CHECK's range
    { ...blocks, ownerId: s.businessId, year: 1999 },
    // another tenant: RLS
    { ...blocks, ownerId: s.missingId, year: 2024 },
  ]),
};
