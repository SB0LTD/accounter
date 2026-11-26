import type {
  IGetDividendsByBusinessIdsQuery,
  IGetDividendsByChargeIdQuery,
} from '../../../../../modules/dividends/__generated__/dividends.types.js';
import { caseFor, type Cases } from '../../../cases.js';

const ACME_USA = '87916ff6-a3f1-5d39-b6e0-7b5d7e155426';
const ACME_RETAIL = '51955ea0-2d3d-5393-bd8f-e537dbd6f5f2';
const DIVIDEND_CHARGE = 'ea694759-612f-5dbd-8f5c-c4d544fdf219';
const CLIENT_CHARGE = 'afd7669e-9d86-5201-8948-010aadfdce07';

export const cases: Cases = {
  getDividendsByChargeId: caseFor<IGetDividendsByChargeIdQuery>(s => [
    { chargeIds: [DIVIDEND_CHARGE, CLIENT_CHARGE] },
    { chargeIds: [DIVIDEND_CHARGE] },
    { chargeIds: s.ids('charges', 5) },
    { chargeIds: [s.missingId] },
  ]),
  getDividendsByBusinessIds: caseFor<IGetDividendsByBusinessIdsQuery>(s => [
    { businessIds: [ACME_USA, ACME_RETAIL] },
    { businessIds: [ACME_RETAIL] },
    { businessIds: [s.missingId] },
  ]),
};
