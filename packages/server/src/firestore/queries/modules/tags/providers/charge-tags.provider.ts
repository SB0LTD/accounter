import type {
  IClearAllChargeTagsQuery,
  IClearChargeTagsQuery,
  IGetTagIdsByChargeIDsQuery,
  IInsertChargeTagQuery,
  IUpdateChargeTagPartQuery,
} from '../../../../../modules/tags/__generated__/charge-tags.types.js';
import { port } from '../../../port.js';

/** SELECT * FROM charge_tags WHERE charge_id IN $$chargeIDs */
export const getTagIdsByChargeIDs = port<IGetTagIdsByChargeIDsQuery>(async ({ chargeIDs }, db) =>
  db.whereIn('charge_tags', 'charge_id', chargeIDs),
);

/** DELETE FROM charge_tags WHERE charge_id = $chargeId AND tag_id IN $$tagIDs */
export const clearChargeTags = port<IClearChargeTagsQuery>(async ({ chargeId, tagIDs }, db) => {
  if (chargeId == null) return [];
  const tagIds = new Set(tagIDs);
  for (const row of await db.where('charge_tags', { charge_id: chargeId })) {
    if (tagIds.has(row.tag_id)) await db.delete('charge_tags', row);
  }
  return [];
});

/** DELETE FROM charge_tags WHERE charge_id = $chargeId */
export const clearAllChargeTags = port<IClearAllChargeTagsQuery>(async ({ chargeId }, db) => {
  if (chargeId == null) return [];
  for (const row of await db.where('charge_tags', { charge_id: chargeId })) {
    await db.delete('charge_tags', row);
  }
  return [];
});

/** INSERT INTO charge_tags (charge_id, tag_id, part, owner_id) VALUES (...) ON CONFLICT DO NOTHING */
export const insertChargeTag = port<IInsertChargeTagQuery>(
  async ({ chargeId, tagId, part, ownerId }, db) => {
    await db.insert(
      'charge_tags',
      { charge_id: chargeId!, tag_id: tagId!, part: part as never, owner_id: ownerId! },
      { action: 'nothing' },
    );
    return [];
  },
);

/** UPDATE charge_tags SET part = COALESCE($part, part) WHERE charge_id = $chargeId AND tag_id = $tagId */
export const updateChargeTagPart = port<IUpdateChargeTagPartQuery>(
  async ({ chargeId, tagId, part }, db) => {
    if (chargeId == null || tagId == null) return [];
    for (const row of await db.where('charge_tags', { charge_id: chargeId, tag_id: tagId })) {
      await db.update('charge_tags', row, { part: (part ?? row.part) as never });
    }
    return [];
  },
);
