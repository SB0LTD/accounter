import type {
  IGetEmployeeIDsByContractIdsQuery,
  IGetEmployeeIdsByDocumentIdsQuery,
  IInsertDeelContractQuery,
} from '../../../../../modules/deel/__generated__/deel-contracts.types.js';
import { caseFor, type Cases } from '../../../cases.js';

// Fixture rows (scripts/firestore/fixtures/090-accounts-salaries.sql)
const ID = (n: number) => `0f090000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const CONTRACTOR_C = ID(123); // a business with no Deel contract
const UNCHARGED_DOCUMENT = ID(301);

export const cases: Cases = {
  getEmployeeIDsByContractIds: caseFor<IGetEmployeeIDsByContractIdsQuery>(() => [
    { contractIds: ['FXC0901', 'FXC0902'] },
    { contractIds: ['FXC0902', 'FXC0999', null] },
    { contractIds: ['no such contract'] },
  ]),
  getEmployeeIdsByDocumentIds: caseFor<IGetEmployeeIdsByDocumentIdsQuery>(s => [
    // every invoiced document: one with two invoices, one whose contract has no worker
    { documentIds: s.values('deel_invoices', 'document_id', 10) as string[] },
    { documentIds: [UNCHARGED_DOCUMENT, s.missingId] },
    { documentIds: s.ids('documents', 3) },
    { documentIds: [s.missingId] },
  ]),
  insertDeelContract: caseFor<IInsertDeelContractQuery>(s => [
    {
      contractId: 'FXC0903',
      contractorId: ID(203),
      contractorName: 'Contractor C',
      contractStartDate: new Date('2024-05-01T08:15:30.123Z'),
      businessId: CONTRACTOR_C,
      ownerId: s.businessId,
    },
    {
      contractId: 'FXC0904',
      contractorId: ID(204),
      contractorName: 'Contractor C again',
      contractStartDate: '2024-06-01',
      businessId: CONTRACTOR_C,
      ownerId: s.businessId,
    },
    // contract id taken: 23505
    {
      contractId: 'FXC0901',
      contractorId: ID(203),
      contractorName: 'Duplicate',
      contractStartDate: new Date('2024-05-01T00:00:00Z'),
      businessId: CONTRACTOR_C,
      ownerId: s.businessId,
    },
    // no such business: 23503
    {
      contractId: 'FXC0905',
      contractorId: ID(203),
      contractorName: 'Nobody',
      contractStartDate: new Date('2024-05-01T00:00:00Z'),
      businessId: s.missingId,
      ownerId: s.businessId,
    },
    // contract_id varchar(10): too long
    {
      contractId: 'FXC0906-TOO-LONG',
      contractorId: ID(203),
      contractorName: 'Too long',
      contractStartDate: new Date('2024-05-01T00:00:00Z'),
      businessId: CONTRACTOR_C,
      ownerId: s.businessId,
    },
    // contractor_name is NOT NULL
    {
      contractId: 'FXC0907',
      contractorId: ID(203),
      contractorName: null,
      contractStartDate: new Date('2024-05-01T00:00:00Z'),
      businessId: CONTRACTOR_C,
      ownerId: s.businessId,
    },
  ]),
};
