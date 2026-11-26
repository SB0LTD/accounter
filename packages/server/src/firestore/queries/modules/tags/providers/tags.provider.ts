import type {
  IAddNewTagQuery,
  IDeleteTagQuery,
  IGetAllTagsQuery,
  IGetTagsByIDsQuery,
  IGetTagsByNamesQuery,
  IRenameTagQuery,
  IUpdateTagParentQuery,
} from '../../../../../modules/tags/__generated__/tags.types.js';
import { port } from '../../../port.js';

/** SELECT * FROM extended_tags */
export const getAllTags = port<IGetAllTagsQuery>(async (_params, db) => db.views.extendedTags());

/** SELECT * FROM extended_tags WHERE id IN $$tagIDs */
export const getTagsByIDs = port<IGetTagsByIDsQuery>(async ({ tagIDs }, db) => {
  const ids = new Set(tagIDs);
  return (await db.views.extendedTags()).filter(tag => ids.has(tag.id));
});

/** SELECT * FROM extended_tags WHERE name IN $$tagNames */
export const getTagsByNames = port<IGetTagsByNamesQuery>(async ({ tagNames }, db) => {
  const names = new Set(tagNames);
  return (await db.views.extendedTags()).filter(tag => names.has(tag.name));
});

/** INSERT INTO tags (name, parent, owner_id) VALUES (...) RETURNING * */
export const addNewTag = port<IAddNewTagQuery>(async ({ name, parentId, ownerId }, db) => {
  const row = await db.insert('tags', {
    name: name!,
    parent: parentId ?? null,
    owner_id: ownerId!,
  });
  return row ? [row] : [];
});

/** UPDATE tags SET name = $newName WHERE id = $id RETURNING * */
export const renameTag = port<IRenameTagQuery>(async ({ id, newName }, db) => {
  if (id == null) return [];
  const rows = await db.where('tags', { id });
  return Promise.all(rows.map(tag => db.update('tags', tag, { name: newName! })));
});

/** DELETE FROM tags WHERE id = $id RETURNING * */
export const deleteTag = port<IDeleteTagQuery>(async ({ id }, db) => {
  if (id == null) return [];
  const rows = await db.where('tags', { id });
  return Promise.all(rows.map(tag => db.delete('tags', tag)));
});

/** UPDATE tags SET parent = $parentId WHERE id = $id RETURNING * */
export const updateTagParent = port<IUpdateTagParentQuery>(async ({ id, parentId }, db) => {
  if (id == null) return [];
  const rows = await db.where('tags', { id });
  return Promise.all(rows.map(tag => db.update('tags', tag, { parent: parentId ?? null })));
});
