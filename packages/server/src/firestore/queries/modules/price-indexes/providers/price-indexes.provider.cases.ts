import type {
  IGetPriceIndexBasesByCodesQuery,
  IGetPriceIndexValuesByCodesQuery,
} from '../../../../../modules/price-indexes/__generated__/price-indexes.types.js';
import { caseFor, type Cases } from '../../../cases.js';

export const cases: Cases = {
  getPriceIndexValuesByCodes: caseFor<IGetPriceIndexValuesByCodesQuery>(() => [
    { indexCodes: [120_020, 120_010] },
    { indexCodes: [120_010] },
    { indexCodes: [999] },
  ]),
  getPriceIndexBasesByCodes: caseFor<IGetPriceIndexBasesByCodesQuery>(() => [
    { indexCodes: [120_020, 120_010] },
    { indexCodes: [120_020] },
    { indexCodes: [999] },
  ]),
};
