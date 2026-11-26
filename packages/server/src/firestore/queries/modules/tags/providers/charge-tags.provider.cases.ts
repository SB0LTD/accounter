import type {
  IClearAllChargeTagsQuery,
  IClearChargeTagsQuery,
  IGetTagIdsByChargeIDsQuery,
  IInsertChargeTagQuery,
  IUpdateChargeTagPartQuery,
} from '../../../../../modules/tags/__generated__/charge-tags.types.js';
import { caseFor, type Cases } from '../../../cases.js';

export const cases: Cases = {
  getTagIdsByChargeIDs: caseFor<IGetTagIdsByChargeIDsQuery>(s => [
    { chargeIDs: s.values('charge_tags', 'charge_id', 5) as string[] },
    { chargeIDs: s.ids('charges', 5) },
  ]),
  clearChargeTags: caseFor<IClearChargeTagsQuery>(s => [
    {
      chargeId: s.values('charge_tags', 'charge_id', 1)[0] as string,
      tagIDs: s.values('charge_tags', 'tag_id', 2) as string[],
    },
  ]),
  clearAllChargeTags: caseFor<IClearAllChargeTagsQuery>(s => [
    { chargeId: s.values('charge_tags', 'charge_id', 1)[0] as string },
  ]),
  insertChargeTag: caseFor<IInsertChargeTagQuery>(s => [
    {
      chargeId: s.ids('charges', 1)[0],
      tagId: s.ids('tags', 1)[0],
      part: 0.5,
      ownerId: s.businessId,
    },
    // Already tagged: DO NOTHING
    {
      chargeId: s.values('charge_tags', 'charge_id', 1)[0] as string,
      tagId: s.values('charge_tags', 'tag_id', 1)[0] as string,
      part: null,
      ownerId: s.businessId,
    },
  ]),
  updateChargeTagPart: caseFor<IUpdateChargeTagPartQuery>(s => [
    {
      chargeId: s.values('charge_tags', 'charge_id', 1)[0] as string,
      tagId: s.values('charge_tags', 'tag_id', 1)[0] as string,
      part: 0.25,
    },
  ]),
};
