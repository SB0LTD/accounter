/**
 * `extended_tags`: every tag reachable from a root tag, with the names and ids of its ancestors.
 *
 *   WITH RECURSIVE get_ancestor AS (
 *     SELECT id, parent, name, NULL::text[], NULL::uuid[], owner_id FROM tags WHERE parent IS NULL
 *     UNION
 *     SELECT t.id, t.parent, t.name, append(g.names_path, g.name), append(g.ids_path, g.id), t.owner_id
 *     FROM get_ancestor g JOIN tags t ON t.parent = g.id)
 *   SELECT * FROM get_ancestor
 *
 * A root has null paths; its children get one-element paths. Tags whose chain never reaches a root
 * are not in the view.
 */
import type { QueryDb } from '../query-db.js';

export interface ExtendedTagRow {
  id: string;
  parent: string | null;
  name: string;
  names_path: string[] | null;
  ids_path: string[] | null;
  owner_id: string;
}

export async function extendedTags(db: QueryDb): Promise<ExtendedTagRow[]> {
  const tags = await db.rows('tags');
  const children = new Map<string, (typeof tags)[number][]>();
  for (const tag of tags) {
    if (tag.parent == null) continue;
    const list = children.get(tag.parent) ?? [];
    list.push(tag);
    children.set(tag.parent, list);
  }
  const result: ExtendedTagRow[] = [];
  const queue: ExtendedTagRow[] = tags
    .filter(tag => tag.parent == null)
    .map(tag => ({
      id: tag.id,
      parent: tag.parent,
      name: tag.name,
      names_path: null,
      ids_path: null,
      owner_id: tag.owner_id,
    }));
  const seen = new Set<string>();
  while (queue.length) {
    const node = queue.shift()!;
    // UNION drops duplicate rows; a tag can only be reached one way, so this guards cycles only.
    const key = `${node.id}|${node.ids_path?.join(',') ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(node);
    for (const child of children.get(node.id) ?? []) {
      queue.push({
        id: child.id,
        parent: child.parent,
        name: child.name,
        names_path: node.names_path ? [...node.names_path, node.name] : [node.name],
        ids_path: node.ids_path ? [...node.ids_path, node.id] : [node.id],
        owner_id: child.owner_id,
      });
    }
  }
  return result;
}
