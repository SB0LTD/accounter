import { F080 } from '../_fixture-ids.js';
import type {
  IInsertApiKeyQuery,
  IListApiKeysQuery,
  IRevokeApiKeyQuery,
} from '../../../../../modules/auth/__generated__/api-keys.types.js';
import { caseFor, type Cases } from '../../../cases.js';

export const cases: Cases = {
  insertApiKey: caseFor<IInsertApiKeyQuery>(s => [
    { ownerId: s.businessId, roleId: 'scraper', keyHash: 'hash080-new', name: 'New key' },
    // Duplicate key hash
    { ownerId: s.businessId, roleId: 'scraper', keyHash: 'hash080-active-1', name: 'Dup' },
    // Unknown role
    { ownerId: s.businessId, roleId: 'no-such-role', keyHash: 'hash080-new-2', name: 'Bad' },
    // NOT NULL name
    { ownerId: s.businessId, roleId: 'scraper', keyHash: 'hash080-new-3', name: null },
  ]),
  listApiKeys: caseFor<IListApiKeysQuery>(s => [
    { ownerId: s.businessId },
    { ownerId: F080.sister },
    { ownerId: s.missingId },
  ]),
  revokeApiKey: caseFor<IRevokeApiKeyQuery>(s => [
    { id: F080.k1, ownerId: s.businessId },
    // Already revoked
    { id: F080.k3, ownerId: s.businessId },
    // Another business's key
    { id: F080.k4, ownerId: s.businessId },
  ]),
};
