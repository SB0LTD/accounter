import type { IGetAllCountriesQuery } from '../../../../../modules/countries/types.js';
import { port } from '../../../port.js';

/** SELECT * FROM countries */
export const getAllCountries = port<IGetAllCountriesQuery>(async (_params, db) =>
  db.rows('countries'),
);
