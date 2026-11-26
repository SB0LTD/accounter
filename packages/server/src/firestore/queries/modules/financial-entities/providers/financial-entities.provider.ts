import {
  deletable,
  insertRow,
  pgParams,
  runWritableCtes,
  uuidList,
  uuidParam,
  type UpdateStep,
} from '../_helpers.js';
import type {
  IDeleteFinancialEntityQuery,
  IGetAllFinancialEntitiesQuery,
  IGetFinancialEntitiesByIdsQuery,
  IInsertFinancialEntitiesQuery,
  IReplaceFinancialEntitiesQuery,
  IUpdateFinancialEntityQuery,
} from '../../../../../modules/financial-entities/__generated__/financial-entities.types.js';
import { coalescePatch } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';

/** SELECT * FROM financial_entities WHERE id IN $$ids */
export const getFinancialEntitiesByIds = port<IGetFinancialEntitiesByIdsQuery>(
  async ({ ids }, db) => db.whereIn('financial_entities', 'id', uuidList(ids)),
);

/** SELECT * FROM financial_entities */
export const getAllFinancialEntities = port<IGetAllFinancialEntitiesQuery>(async (_params, db) =>
  db.rows('financial_entities'),
);

/**
 * UPDATE financial_entities SET name = COALESCE($name, name), sort_code = COALESCE($sortCode, sort_code),
 *   type = COALESCE($type, type), irs_code = COALESCE($irsCode, irs_code),
 *   is_active = COALESCE($isActive, is_active)
 * WHERE id = $financialEntityId RETURNING *
 */
export const updateFinancialEntity = port<IUpdateFinancialEntityQuery>(async (params, db) => {
  const patch = pgParams(
    'financial_entities',
    coalescePatch({
      name: params.name,
      sort_code: params.sortCode,
      type: params.type,
      irs_code: params.irsCode,
      is_active: params.isActive,
    }) as never,
  );
  const id = uuidParam(params.financialEntityId);
  if (id == null) return [];
  const updated = [];
  for (const fe of await db.where('financial_entities', { id })) {
    updated.push(await db.update('financial_entities', fe, patch));
  }
  return updated;
});

/**
 * INSERT INTO financial_entities (type, owner_id, name, sort_code, irs_code, is_active)
 * VALUES $$financialEntities(type, ownerId, name, sortCode, irsCode, isActive)
 * RETURNING *
 */
export const insertFinancialEntities = port<IInsertFinancialEntitiesQuery>(
  async ({ financialEntities }, db) => {
    const rows = financialEntities.map(fe =>
      pgParams('financial_entities', {
        type: fe.type ?? null,
        owner_id: fe.ownerId ?? null,
        name: fe.name ?? null,
        sort_code: fe.sortCode ?? null,
        irs_code: fe.irsCode ?? null,
        is_active: fe.isActive ?? null,
      } as never),
    );
    const inserted = [];
    for (const values of rows) {
      const row = await insertRow(db, 'financial_entities', values);
      if (row) inserted.push(row);
    }
    return inserted;
  },
);

/** DELETE FROM financial_entities WHERE id = $financialEntityId RETURNING id */
export const deleteFinancialEntity = port<IDeleteFinancialEntityQuery>(
  async ({ financialEntityId }, db) => {
    const id = uuidParam(financialEntityId);
    if (id == null) return [];
    const deleted = [];
    for (const fe of deletable(db, await db.where('financial_entities', { id }))) {
      await db.delete('financial_entities', fe);
      deleted.push({ id: fe.id });
    }
    return deleted;
  },
);

/**
 * WITH ledger_debit1 AS (UPDATE ledger_records SET debit_entity1 = $targetEntityId
 *     WHERE debit_entity1 = $entityIdToReplace RETURNING id),
 *   ledger_debit2 AS (... debit_entity2 ...), ledger_credit1 AS (... credit_entity1 ...),
 *   ledger_credit2 AS (... credit_entity2 ...),
 *   misc_expenses_creditor AS (UPDATE misc_expenses SET creditor_id = $targetEntityId
 *     WHERE creditor_id = $entityIdToReplace RETURNING id)
 * UPDATE misc_expenses SET debtor_id = $targetEntityId WHERE debtor_id = $entityIdToReplace
 * RETURNING id
 *
 * See runWritableCtes for the order Postgres runs the parts in (a row that references the entity
 * on two columns gets only one of them replaced).
 */
export const replaceFinancialEntities = port<IReplaceFinancialEntitiesQuery>(
  async ({ targetEntityId, entityIdToReplace }, db) => {
    const set = (table: UpdateStep['table'], column: string): UpdateStep => ({
      table,
      column,
      value: targetEntityId,
      match: entityIdToReplace,
    });
    const rows = await runWritableCtes(db, [
      set('ledger_records', 'debit_entity1'),
      set('ledger_records', 'debit_entity2'),
      set('ledger_records', 'credit_entity1'),
      set('ledger_records', 'credit_entity2'),
      set('misc_expenses', 'creditor_id'),
      set('misc_expenses', 'debtor_id'),
    ]);
    return rows.map(row => ({ id: row.id as string }));
  },
);
