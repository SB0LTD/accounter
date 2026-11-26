import type {
  IDeleteContractQuery,
  IGetContractsByAdminBusinessIdsQuery,
  IGetContractsByClientIdsQuery,
  IGetContractsByFiltersParams,
  IGetContractsByFiltersQuery,
  IGetContractsByIdsQuery,
  IInsertContractParams,
  IInsertContractQuery,
  IUpdateContractQuery,
} from '../../../../../modules/contracts/__generated__/contracts.types.js';
import { caseFor, type Cases } from '../../../cases.js';
import { FX } from '../../documents/_fixture-ids.js';

const noFilters: IGetContractsByFiltersParams = {
  isOwnerIds: 0,
  isClientIds: 0,
  isContractIds: 0,
  ownerIds: [null],
  clientIds: [null],
  contractIds: [null],
  isActive: null,
};

const newContract = (
  ownerId: string,
  patch: Partial<IInsertContractParams> = {},
): IInsertContractParams => ({
  clientId: FX.initech,
  purchaseOrders: ['PO-100'],
  startDate: '2025-01-01',
  endDate: '2025-12-31',
  remarks: 'new contract',
  documentType: 'INVOICE',
  amount: 2500.25,
  currency: 'USD',
  billingCycle: 'monthly',
  product: 'HIVE',
  plan: 'ENTERPRISE',
  isActive: true,
  msCloud: null,
  operationsLimit: '25000000',
  ownerId,
  ...patch,
});

export const cases: Cases = {
  getContractsByIds: caseFor<IGetContractsByIdsQuery>(s => [
    { ids: [FX.k1, FX.k3, s.missingId] },
    { ids: [null] },
  ]),
  getContractsByAdminBusinessIds: caseFor<IGetContractsByAdminBusinessIdsQuery>(s => [
    { adminBusinessIds: [s.businessId] },
    { adminBusinessIds: [s.missingId] },
  ]),
  getContractsByClientIds: caseFor<IGetContractsByClientIdsQuery>(s => [
    { clientIds: [FX.globex] },
    { clientIds: [FX.initech, s.missingId] },
  ]),
  getContractsByFilters: caseFor<IGetContractsByFiltersQuery>(s => [
    // K1 and K3 share a start date: id breaks the tie
    noFilters,
    // a NULL is_active counts as inactive
    { ...noFilters, isActive: false },
    { ...noFilters, isActive: true },
    { ...noFilters, isClientIds: 1, clientIds: [FX.initech] },
    {
      ...noFilters,
      isContractIds: 1,
      contractIds: [FX.k2, FX.k3],
      isOwnerIds: 1,
      ownerIds: [s.businessId],
    },
    { ...noFilters, isOwnerIds: 1, ownerIds: [s.missingId] },
    // NULL flags apply the list filters
    { ...noFilters, isClientIds: null, clientIds: [FX.globex] },
  ]),
  deleteContract: caseFor<IDeleteContractQuery>(s => [{ id: FX.k1 }, { id: s.missingId }]),
  updateContract: caseFor<IUpdateContractQuery>(s => [
    {
      contractId: FX.k2,
      clientId: FX.initech,
      purchaseOrders: ['A', 'B'],
      startDate: '2023-02-01',
      endDate: '2024-01-31',
      remarks: 'renewed',
      documentType: 'INVOICE',
      amount: 12.75,
      currency: 'USD',
      billingCycle: 'annual',
      product: 'P',
      plan: 'Q',
      isActive: true,
      msCloud: 'https://ms.example.test/2',
      operationsLimit: 77,
    },
    { contractId: FX.k1 },
    { contractId: FX.k3, purchaseOrders: [], isActive: false },
    // client_id must be a client
    { contractId: FX.k3, clientId: s.missingId },
    { contractId: FX.k3, documentType: 'NOT_A_TYPE' as never },
    { contractId: s.missingId, remarks: 'nothing' },
    { contractId: null, remarks: 'no id' },
  ]),
  insertContract: caseFor<IInsertContractQuery>(s => [
    newContract(s.businessId),
    newContract(s.businessId, {
      remarks: null,
      product: null,
      plan: null,
      isActive: null,
      purchaseOrders: [],
    }),
    // explicit NULLs do not take the column defaults
    newContract(s.businessId, { documentType: null }),
    newContract(s.businessId, { billingCycle: null }),
    newContract(s.businessId, { clientId: FX.d1 }),
    newContract(s.missingId),
  ]),
};
