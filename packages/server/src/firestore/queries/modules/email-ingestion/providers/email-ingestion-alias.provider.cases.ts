import { F080 } from '../_fixture-ids.js';
import type {
  IGetAliasesQuery,
  IInsertAliasQuery,
  IUpdateAliasActiveQuery,
} from '../../../../../modules/email-ingestion/__generated__/email-ingestion-alias.types.js';
import { caseFor, type Cases } from '../../../cases.js';

export const cases: Cases = {
  getAliases: caseFor<IGetAliasesQuery>(s => [
    { ownerIds: [s.businessId] },
    // Every alias is readable, the sister business's too
    { ownerIds: [F080.sister] },
    { ownerIds: [s.businessId, F080.sister] },
    { ownerIds: [s.missingId] },
    { ownerIds: null },
  ]),
  insertAlias: caseFor<IInsertAliasQuery>(s => [
    { alias: 'new080', ownerId: s.businessId },
    // An active alias with the same lower(alias) exists
    { alias: 'ACME080', ownerId: s.businessId },
    // Only the current business's aliases may be written
    { alias: 'other080', ownerId: F080.sister },
    { alias: null, ownerId: s.businessId },
  ]),
  updateAliasActive: caseFor<IUpdateAliasActiveQuery>(s => [
    { id: F080.aliasOld, isActive: true },
    { id: F080.aliasAcme, isActive: false },
    // Reactivating collides with the sister's active alias
    { id: F080.aliasSisterUpper, isActive: true },
    // The sister's alias: invisible to the update, so no row
    { id: F080.aliasSister, isActive: false },
    { id: F080.aliasAcme, isActive: null },
    { id: s.missingId, isActive: true },
  ]),
};
