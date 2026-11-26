import type {
  IGetAllSortCodesQuery,
  IGetSortCodesByIdsQuery,
  IGetSortCodesByOwnerIdsQuery,
  IInsertSortCodeQuery,
  IInsertSortCodesQuery,
  IUpdateSortCodeQuery,
} from '../../../../../modules/sort-codes/__generated__/sort-codes.types.js';
import { inList } from '../../../../sql-helpers.js';
import { port } from '../../../port.js';
import { insertRow, pgParams } from '../../financial-entities/_helpers.js';

/** SELECT * FROM sort_codes */
export const getAllSortCodes = port<IGetAllSortCodesQuery>(async (_params, db) =>
  db.rows('sort_codes'),
);

/** SELECT sc.* FROM sort_codes sc WHERE ($isSortCodesIds = 0 OR sc.key IN $$sortCodesIds) */
export const getSortCodesByIds = port<IGetSortCodesByIdsQuery>(
  async ({ isSortCodesIds, sortCodesIds }, db) => {
    const all = isSortCodesIds != null && Number(isSortCodesIds) === 0;
    const wanted = inList(sortCodesIds);
    return (await db.rows('sort_codes')).filter(sc => all || wanted(sc.key));
  },
);

/** SELECT sc.* FROM sort_codes sc WHERE sc.owner_id IN $$ownerIds */
export const getSortCodesByOwnerIds = port<IGetSortCodesByOwnerIdsQuery>(async ({ ownerIds }, db) =>
  db.whereIn('sort_codes', 'owner_id', ownerIds),
);

/**
 * INSERT INTO sort_codes (name, key, default_irs_code, owner_id)
 * VALUES ($name, $key, $defaultIrsCode, $ownerId) RETURNING *
 */
export const insertSortCode = port<IInsertSortCodeQuery>(
  async ({ name, key, defaultIrsCode, ownerId }, db) => {
    const row = await insertRow(
      db,
      'sort_codes',
      pgParams('sort_codes', {
        name: name ?? null,
        key: key ?? null,
        default_irs_code: defaultIrsCode ?? null,
        owner_id: ownerId ?? null,
      } as never),
    );
    return row ? [row] : [];
  },
);

/**
 * INSERT INTO sort_codes (name, key, default_irs_code, owner_id)
 * VALUES $$sortCodes(name, key, defaultIrsCode, ownerId)
 * ON CONFLICT (key, owner_id) DO NOTHING RETURNING *
 */
export const insertSortCodes = port<IInsertSortCodesQuery>(async ({ sortCodes }, db) => {
  const rows = sortCodes.map(sortCode =>
    pgParams('sort_codes', {
      name: sortCode.name ?? null,
      key: sortCode.key ?? null,
      default_irs_code: sortCode.defaultIrsCode ?? null,
      owner_id: sortCode.ownerId ?? null,
    } as never),
  );
  const inserted = [];
  for (const values of rows) {
    const row = await insertRow(db, 'sort_codes', values, {
      target: ['key', 'owner_id'],
      action: 'nothing',
    });
    if (row) inserted.push(row);
  }
  return inserted;
});

/**
 * UPDATE sort_codes SET name = COALESCE($name, name),
 *   default_irs_code = COALESCE($defaultIrsCode, default_irs_code)
 * WHERE key = $key AND owner_id = $ownerId RETURNING *
 */
export const updateSortCode = port<IUpdateSortCodeQuery>(
  async ({ name, defaultIrsCode, key, ownerId }, db) => {
    if (key == null || ownerId == null) return [];
    const updated = [];
    for (const sc of await db.where('sort_codes', { key, owner_id: ownerId })) {
      updated.push(
        await db.update('sort_codes', sc, {
          name: name ?? sc.name,
          default_irs_code: defaultIrsCode ?? sc.default_irs_code,
        }),
      );
    }
    return updated;
  },
);
