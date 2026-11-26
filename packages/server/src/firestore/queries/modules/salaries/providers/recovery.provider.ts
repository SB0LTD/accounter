import type { IGetRecoveryDataQuery } from '../../../../../modules/salaries/__generated__/recovery.types.js';
import { port } from '../../../port.js';

/** SELECT * FROM recovery */
export const getRecoveryData = port<IGetRecoveryDataQuery>(async (_params, db) =>
  db.rows('recovery'),
);
