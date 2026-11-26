import type {
  IDeleteContractQuery,
  IGetAllOpenContractsQuery,
  IGetAllOpenContractsResult,
  IGetContractsByAdminBusinessIdsQuery,
  IGetContractsByClientIdsQuery,
  IGetContractsByFiltersQuery,
  IGetContractsByIdsQuery,
  IInsertContractQuery,
  IUpdateContractQuery,
} from '../../../../../modules/contracts/__generated__/contracts.types.js';
import type { Row } from '../../../../catalog.js';
import { coalescePatch, inList, orderBy } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';
import { deletableRows, enumParam, isZero } from '../../documents/_helpers.js';

/**
 * A `clients_contracts` row as the queries return it (pgTyped types start_date / end_date as
 * TimelessDateString, the store's row type as string: the same `YYYY-MM-DD` text).
 */
type ContractRow = IGetAllOpenContractsResult;
type ContractPatch = Partial<Row<'clients_contracts'>>;

const asContracts = (rows: readonly Row<'clients_contracts'>[]) => rows as readonly ContractRow[];

/** `SELECT * FROM clients_contracts WHERE is_active IS TRUE` */
export const getAllOpenContracts = port<IGetAllOpenContractsQuery>(async (_params, db) =>
  asContracts(await db.where('clients_contracts', { is_active: true })),
);

/** `SELECT * FROM clients_contracts WHERE id In $$ids` */
export const getContractsByIds = port<IGetContractsByIdsQuery>(async ({ ids }, db) =>
  asContracts(await db.whereIn('clients_contracts', 'id', ids)),
);

/** `SELECT * FROM clients_contracts WHERE owner_id IN $$adminBusinessIds` */
export const getContractsByAdminBusinessIds = port<IGetContractsByAdminBusinessIdsQuery>(
  async ({ adminBusinessIds }, db) =>
    asContracts(await db.whereIn('clients_contracts', 'owner_id', adminBusinessIds)),
);

/** `SELECT * FROM clients_contracts WHERE client_id IN $$clientIds` */
export const getContractsByClientIds = port<IGetContractsByClientIdsQuery>(
  async ({ clientIds }, db) =>
    asContracts(await db.whereIn('clients_contracts', 'client_id', clientIds)),
);

/**
 * SELECT * FROM clients_contracts
 * WHERE ($isOwnerIds = 0 OR owner_id IN $$ownerIds)
 *   AND ($isClientIds = 0 OR client_id IN $$clientIds)
 *   AND ($isContractIds = 0 OR id IN $$contractIds)
 *   AND ($isActive::BOOLEAN IS NULL OR COALESCE(is_active, FALSE) = $isActive)
 * ORDER BY start_date DESC, id;
 */
export const getContractsByFilters = port<IGetContractsByFiltersQuery>(async (params, db) => {
  const ownerMatch = inList(params.ownerIds);
  const clientMatch = inList(params.clientIds);
  const contractMatch = inList(params.contractIds);
  const isActive = params.isActive ?? null;
  return orderBy(
    asContracts(await db.rows('clients_contracts')).filter(
      contract =>
        (isZero(params.isOwnerIds) || ownerMatch(contract.owner_id)) &&
        (isZero(params.isClientIds) || clientMatch(contract.client_id)) &&
        (isZero(params.isContractIds) || contractMatch(contract.id)) &&
        (isActive == null || (contract.is_active ?? false) === isActive),
    ),
    [
      { value: contract => contract.start_date, desc: true, kind: 'date' },
      { value: contract => contract.id },
    ],
  );
});

/** `DELETE FROM clients_contracts WHERE id = $id` */
export const deleteContract = port<IDeleteContractQuery>(async ({ id }, db) => {
  if (id == null) return [];
  for (const row of deletableRows(db, await db.where('clients_contracts', { id }))) {
    await db.delete('clients_contracts', row);
  }
  return [];
});

/**
 * UPDATE clients_contracts SET
 *   client_id = COALESCE($clientId, client_id), purchase_orders = COALESCE($purchaseOrders, purchase_orders),
 *   start_date = COALESCE($startDate, start_date), end_date = COALESCE($endDate, end_date),
 *   remarks = COALESCE($remarks, remarks), document_type = COALESCE($documentType, document_type),
 *   amount = COALESCE($amount, amount), currency = COALESCE($currency, currency),
 *   billing_cycle = COALESCE($billingCycle, billing_cycle), product = COALESCE($product, product),
 *   plan = COALESCE($plan, plan), is_active = COALESCE($isActive, is_active),
 *   ms_cloud = COALESCE($msCloud, ms_cloud), operations_count = COALESCE($operationsLimit, operations_count)
 * WHERE id = $contractId
 * RETURNING *;
 */
export const updateContract = port<IUpdateContractQuery>(async (params, db) => {
  const documentType = enumParam('document_type', params.documentType);
  const currency = enumParam('currency', params.currency);
  if (params.contractId == null) return [];
  const result: ContractRow[] = [];
  for (const row of await db.where('clients_contracts', { id: params.contractId })) {
    const patch = coalescePatch({
      client_id: params.clientId,
      purchase_orders: params.purchaseOrders,
      start_date: params.startDate,
      end_date: params.endDate,
      remarks: params.remarks,
      document_type: documentType,
      amount: params.amount,
      currency,
      billing_cycle: params.billingCycle,
      product: params.product,
      plan: params.plan,
      is_active: params.isActive,
      ms_cloud: params.msCloud,
      operations_count: params.operationsLimit,
    }) as ContractPatch;
    result.push((await db.update('clients_contracts', row, patch)) as ContractRow);
  }
  return result;
});

/**
 * INSERT INTO clients_contracts (client_id, purchase_orders, start_date, end_date, remarks,
 *   document_type, amount, currency, billing_cycle, product, plan, is_active, ms_cloud,
 *   operations_count, owner_id)
 * VALUES ($clientId, $purchaseOrders, $startDate, $endDate, $remarks, $documentType, $amount,
 *   $currency, $billingCycle, $product, $plan, $isActive, $msCloud, $operationsLimit, $ownerId)
 * RETURNING *;
 *
 * Every listed column gets its value, NULL included: an explicit NULL document_type, billing_cycle,
 * purchase_orders or operations_count is a not-null error, not the column default.
 */
export const insertContract = port<IInsertContractQuery>(async (params, db) => {
  const documentType = enumParam('document_type', params.documentType);
  const currency = enumParam('currency', params.currency);
  const row = await db.insert('clients_contracts', {
    client_id: params.clientId ?? null,
    purchase_orders: params.purchaseOrders ?? null,
    start_date: params.startDate ?? null,
    end_date: params.endDate ?? null,
    remarks: params.remarks ?? null,
    document_type: documentType,
    amount: params.amount ?? null,
    currency,
    billing_cycle: params.billingCycle ?? null,
    product: params.product ?? null,
    plan: params.plan ?? null,
    is_active: params.isActive ?? null,
    ms_cloud: params.msCloud ?? null,
    operations_count: params.operationsLimit ?? null,
    owner_id: params.ownerId ?? null,
  } as ContractPatch);
  return row ? [row as ContractRow] : [];
});
