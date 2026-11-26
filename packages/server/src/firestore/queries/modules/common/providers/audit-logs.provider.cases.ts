import type { IInsertAuditLogQuery } from '../../../../../modules/common/__generated__/audit-logs.types.js';
import { caseFor, type Cases } from '../../../cases.js';
import { FX } from '../../documents/_fixture-ids.js';

// The statement has no RETURNING: the cases compare success and error codes.
export const cases: Cases = {
  insertAuditLog: caseFor<IInsertAuditLogQuery>(s => [
    {
      ownerId: s.businessId,
      userId: s.userId,
      auth0UserId: 'auth0|fixture',
      action: 'DOCUMENT_UPDATE',
      entity: 'Document',
      entityId: FX.d1,
      details: JSON.stringify({ before: { amount: 1 }, after: { amount: 2 }, tags: ['a', 'b'] }),
      ipAddress: '10.0.0.1',
    },
    {
      ownerId: null,
      userId: null,
      auth0UserId: null,
      action: 'USER_LOGIN_FAILED',
      entity: null,
      entityId: null,
      details: null,
      ipAddress: '2001:db8::1',
    },
    // user without business: the (user_id, business_id) key is not checked (MATCH SIMPLE)
    { ownerId: null, userId: s.missingId, action: 'X', ipAddress: '192.168.0.0/24' },
    { ownerId: s.businessId, userId: s.missingId, action: 'X' },
    { ownerId: s.missingId, action: 'X' },
    { ownerId: s.businessId, action: null },
    { action: 'X', ipAddress: 'not an address' },
    { action: 'X', details: '{not json' },
  ]),
};
