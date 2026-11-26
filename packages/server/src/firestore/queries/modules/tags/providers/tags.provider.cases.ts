import type {
  IAddNewTagQuery,
  IDeleteTagQuery,
  IGetTagsByIDsQuery,
  IGetTagsByNamesQuery,
  IRenameTagQuery,
  IUpdateTagParentQuery,
} from '../../../../../modules/tags/__generated__/tags.types.js';
import { caseFor, type Cases } from '../../../cases.js';

export const cases: Cases = {
  getTagsByIDs: caseFor<IGetTagsByIDsQuery>(s => [
    { tagIDs: s.ids('tags', 5) },
    { tagIDs: [s.missingId] },
  ]),
  getTagsByNames: caseFor<IGetTagsByNamesQuery>(s => [
    { tagNames: s.values('tags', 'name', 5) as string[] },
    { tagNames: ['no such tag'] },
  ]),
  addNewTag: caseFor<IAddNewTagQuery>(s => [
    { name: 'verify-new-root', parentId: null, ownerId: s.businessId },
    { name: 'verify-new-child', parentId: s.ids('tags', 1)[0] ?? null, ownerId: s.businessId },
  ]),
  renameTag: caseFor<IRenameTagQuery>(s => [
    { id: s.ids('tags', 1)[0], newName: 'renamed' },
    { id: s.missingId, newName: 'renamed' },
  ]),
  deleteTag: caseFor<IDeleteTagQuery>(s => [{ id: s.ids('tags', 1)[0] }, { id: s.missingId }]),
  updateTagParent: caseFor<IUpdateTagParentQuery>(s => [
    { id: s.ids('tags', 3)[2], parentId: null },
    { id: s.ids('tags', 3)[2], parentId: s.ids('tags', 1)[0] },
  ]),
};
