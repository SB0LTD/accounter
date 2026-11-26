import type {
  IDeleteDepreciationRecordByChargeIdQuery,
  IDeleteDepreciationRecordQuery,
  IGetDepreciationRecordsActivatedByQuery,
  IGetDepreciationRecordsByChargeIdsQuery,
  IGetDepreciationRecordsByDatesQuery,
  IGetDepreciationRecordsByIdsQuery,
  IInsertDepreciationRecordParams,
  IInsertDepreciationRecordQuery,
  IReplaceDepreciationRecordsChargeIdQuery,
  IUpdateDepreciationRecordQuery,
} from '../../../../../modules/depreciation/__generated__/depreciation.types.js';
import { caseFor, type Cases, type Snapshot } from '../../../cases.js';

/** Fixture ids (060-depreciation-securities.sql) */
const id = (n: number) => `0f060000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** A column of a fixture asset, read from the loaded data. */
const asset = (s: Snapshot, n: number, column: string) =>
  s.rows('depreciation').find(row => row.id === id(n))?.[column] as string;

const newAsset = (s: Snapshot): IInsertDepreciationRecordParams => ({
  chargeId: asset(s, 101, 'charge_id'),
  amount: 4200.5,
  localAmount: null,
  currency: 'ILS',
  activationDate: '2025-03-01',
  type: 'MARKETING',
  categoryId: id(1),
  assetTaxCategoryId: null,
  ownerId: s.businessId,
});

export const cases: Cases = {
  getDepreciationRecordsByChargeIds: caseFor<IGetDepreciationRecordsByChargeIdsQuery>(s => [
    { chargeIds: s.values('depreciation', 'charge_id', 5) as string[] },
    { chargeIds: [asset(s, 103, 'charge_id')] },
    { chargeIds: [s.missingId] },
  ]),
  getDepreciationRecordsByIds: caseFor<IGetDepreciationRecordsByIdsQuery>(s => [
    { depreciationRecordIds: [id(101), id(104), id(107), id(110), s.missingId] },
    { depreciationRecordIds: [s.missingId] },
  ]),
  getDepreciationRecordsByDates: caseFor<IGetDepreciationRecordsByDatesQuery>(() => [
    { fromDate: '2024-01-01', toDate: '2024-12-31', localCurrency: 'ILS' },
    { fromDate: '2023-03-01', toDate: '2023-12-31', localCurrency: 'ILS' },
    { fromDate: '2023-07-01', toDate: '2023-12-31', localCurrency: 'ILS' },
    { fromDate: null, toDate: '2030-01-01', localCurrency: 'ILS' },
    { fromDate: '2024-01-01', toDate: '2024-12-31', localCurrency: 'USD' },
    { fromDate: '2024-01-01', toDate: '2024-12-31', localCurrency: null },
    { fromDate: '2099-01-01', toDate: '2099-12-31', localCurrency: 'ILS' },
    { fromDate: '2024-01-01', toDate: null, localCurrency: 'ILS' },
  ]),
  getDepreciationRecordsActivatedBy: caseFor<IGetDepreciationRecordsActivatedByQuery>(s => [
    { date: '2023-04-01', ownerId: s.businessId }, // ties on activation_date: by id
    { date: '2030-01-01', ownerId: s.businessId },
    { date: '2021-12-31', ownerId: s.businessId },
    { date: '2030-01-01', ownerId: asset(s, 107, 'owner_id') }, // another business: hidden
    { date: null, ownerId: s.businessId },
  ]),
  replaceDepreciationRecordsChargeId: caseFor<IReplaceDepreciationRecordsChargeIdQuery>(s => [
    { replaceChargeID: asset(s, 101, 'charge_id'), assertChargeID: asset(s, 103, 'charge_id') },
    { replaceChargeID: asset(s, 105, 'charge_id'), assertChargeID: null }, // 23502
    { replaceChargeID: asset(s, 105, 'charge_id'), assertChargeID: s.missingId }, // 23503
    { replaceChargeID: s.missingId, assertChargeID: asset(s, 101, 'charge_id') },
  ]),
  updateDepreciationRecord: caseFor<IUpdateDepreciationRecordQuery>(s => [
    { id: id(101), amount: 12000.5, currency: null, type: 'MARKETING', clearLocalAmount: null },
    { id: id(103), clearLocalAmount: true, clearAssetTaxCategoryId: true, localAmount: 1 },
    {
      id: id(104),
      localAmount: '50.10',
      assetTaxCategoryId: asset(s, 103, 'asset_tax_category_id'),
      activationDate: '2022-02-01',
      categoryId: id(2),
      chargeId: asset(s, 105, 'charge_id'),
      clearLocalAmount: false,
      clearAssetTaxCategoryId: false,
    },
    { id: id(101), categoryId: s.missingId }, // 23503
    { id: id(107), amount: 1 }, // another business's: no row
    { id: s.missingId, amount: 1 },
  ]),
  insertDepreciationRecord: caseFor<IInsertDepreciationRecordQuery>(s => [
    newAsset(s),
    {
      ...newAsset(s),
      amount: null,
      localAmount: '1234.5678',
      currency: 'EUR',
      type: null,
      assetTaxCategoryId: asset(s, 103, 'asset_tax_category_id'),
    },
    { ...newAsset(s), categoryId: s.missingId }, // 23503
    { ...newAsset(s), chargeId: null }, // 23502
    { ...newAsset(s), ownerId: asset(s, 107, 'owner_id') }, // another business: 42501
  ]),
  deleteDepreciationRecord: caseFor<IDeleteDepreciationRecordQuery>(s => [
    { depreciationRecordId: id(101) }, // its disposal cascades
    { depreciationRecordId: id(105) },
    { depreciationRecordId: id(107) }, // another business's: no row
    { depreciationRecordId: s.missingId },
  ]),
  deleteDepreciationRecordByChargeId: caseFor<IDeleteDepreciationRecordByChargeIdQuery>(s => [
    { chargeId: asset(s, 103, 'charge_id') },
    { chargeId: asset(s, 101, 'charge_id') }, // 107 of another business shares it: not deleted
    { chargeId: s.missingId },
  ]),
};
