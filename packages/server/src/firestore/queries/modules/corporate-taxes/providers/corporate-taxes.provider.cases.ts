import type {
  IDeleteCorporateTaxQuery,
  IGetCorporateTaxesByCorporateIdsQuery,
  IInsertCorporateTaxQuery,
  IUpdateCorporateTaxQuery,
} from '../../../../../modules/corporate-taxes/__generated__/corporate-taxes.types.js';
import { caseFor, type Cases } from '../../../cases.js';

const ACME_USA = '87916ff6-a3f1-5d39-b6e0-7b5d7e155426';

export const cases: Cases = {
  getCorporateTaxesByCorporateIds: caseFor<IGetCorporateTaxesByCorporateIdsQuery>(s => [
    { corporateIds: [s.businessId] },
    { corporateIds: [s.businessId, ACME_USA] },
    { corporateIds: [s.missingId] },
  ]),
  updateCorporateTax: caseFor<IUpdateCorporateTaxQuery>(s => [
    // rates only; a JS number goes out as its shortest digits
    {
      corporateId: s.businessId,
      originalDate: '2023-01-01',
      date: null,
      taxRate: 0.1 + 0.2,
      originalTaxRate: null,
    },
    // move the key
    {
      corporateId: s.businessId,
      originalDate: '2023-01-01',
      date: '2023-07-01',
      taxRate: '23.50',
      originalTaxRate: 23,
    },
    // onto an existing key: unique violation
    {
      corporateId: s.businessId,
      originalDate: '2023-01-01',
      date: '2024-01-01',
      taxRate: null,
      originalTaxRate: null,
    },
    // nothing to change
    {
      corporateId: s.businessId,
      originalDate: '1999-01-01',
      date: null,
      taxRate: 1,
      originalTaxRate: 1,
    },
  ]),
  insertCorporateTax: caseFor<IInsertCorporateTaxQuery>(s => [
    {
      corporateId: s.businessId,
      date: '2025-01-01',
      taxRate: '23.000',
      originalTaxRate: 1e-7,
      ownerId: s.businessId,
    },
    // existing key
    {
      corporateId: s.businessId,
      date: '2024-01-01',
      taxRate: 23,
      originalTaxRate: 23,
      ownerId: s.businessId,
    },
    // explicit NULL original_tax_rate
    {
      corporateId: s.businessId,
      date: '2026-01-01',
      taxRate: 23,
      originalTaxRate: null,
      ownerId: s.businessId,
    },
    // unknown business: foreign key violation
    {
      corporateId: s.missingId,
      date: '2025-01-01',
      taxRate: 23,
      originalTaxRate: 23,
      ownerId: s.businessId,
    },
    // another tenant: RLS
    {
      corporateId: s.businessId,
      date: '2027-01-01',
      taxRate: 23,
      originalTaxRate: 23,
      ownerId: s.missingId,
    },
  ]),
  deleteCorporateTax: caseFor<IDeleteCorporateTaxQuery>(s => [
    { corporateId: s.businessId, date: '2024-01-01' },
    { corporateId: ACME_USA, date: '2022-07-01' },
    { corporateId: s.businessId, date: '1999-01-01' },
    { corporateId: null, date: '2024-01-01' },
  ]),
};
