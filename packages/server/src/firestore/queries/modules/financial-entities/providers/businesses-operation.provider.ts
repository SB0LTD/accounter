import { deletable, uuidParam } from '../_helpers.js';
import type { IDeleteBusinessQuery } from '../../../../../modules/financial-entities/__generated__/businesses-operation.types.js';
import { port } from '../../../port.js';

/** DELETE FROM businesses WHERE id = $businessId RETURNING id */
export const deleteBusiness = port<IDeleteBusinessQuery>(async ({ businessId }, db) => {
  const id = uuidParam(businessId);
  if (id == null) return [];
  const deleted = [];
  for (const b of deletable(db, await db.where('businesses', { id }))) {
    await db.delete('businesses', b);
    deleted.push({ id: b.id });
  }
  return deleted;
});
