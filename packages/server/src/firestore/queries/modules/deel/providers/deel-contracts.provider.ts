import type {
  IGetEmployeeIDsByContractIdsQuery,
  IGetEmployeeIdsByDocumentIdsQuery,
  IInsertDeelContractQuery,
} from '../../../../../modules/deel/__generated__/deel-contracts.types.js';
import { groupBy } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';
import { timestampParam, typed } from '../../salaries/_helpers.js';

/** SELECT * FROM deel_workers WHERE contract_id IN $$contractIds */
export const getEmployeeIDsByContractIds = port<IGetEmployeeIDsByContractIdsQuery>(
  async ({ contractIds }, db) => db.whereIn('deel_workers', 'contract_id', contractIds),
);

/**
 * SELECT di.document_id, dw.business_id
 * FROM deel_invoices di
 * LEFT JOIN deel_workers dw ON di.contract_id = dw.contract_id
 * WHERE di.document_id IN $$documentIds
 */
export const getEmployeeIdsByDocumentIds = port<IGetEmployeeIdsByDocumentIdsQuery>(
  async ({ documentIds }, db) => {
    const invoices = await db.whereIn('deel_invoices', 'document_id', documentIds);
    const workers = groupBy(
      await db.whereIn(
        'deel_workers',
        'contract_id',
        invoices.map(invoice => invoice.contract_id),
      ),
      worker => worker.contract_id,
    );
    return invoices.flatMap(invoice => {
      const matches = invoice.contract_id == null ? [] : (workers.get(invoice.contract_id) ?? []);
      if (matches.length === 0) {
        // LEFT JOIN: no worker for the contract leaves dw.business_id NULL
        return [{ document_id: invoice.document_id, business_id: null as unknown as string }];
      }
      return matches.map(worker => ({
        document_id: invoice.document_id,
        business_id: worker.business_id,
      }));
    });
  },
);

/**
 * INSERT INTO deel_workers (contract_id, contractor_id, contractor_name, contract_start_date,
 *   business_id, owner_id)
 * VALUES ($contractId, $contractorId, $contractorName, $contractStartDate, $businessId, $ownerId)
 * RETURNING *
 */
export const insertDeelContract = port<IInsertDeelContractQuery>(async (params, db) => {
  const row = await db.insert(
    'deel_workers',
    typed('deel_workers', {
      contract_id: params.contractId ?? null,
      contractor_id: params.contractorId ?? null,
      contractor_name: params.contractorName ?? null,
      contract_start_date:
        params.contractStartDate == null ? null : timestampParam(params.contractStartDate),
      business_id: params.businessId ?? null,
      owner_id: params.ownerId ?? null,
    }),
  );
  return row ? [row] : [];
});
