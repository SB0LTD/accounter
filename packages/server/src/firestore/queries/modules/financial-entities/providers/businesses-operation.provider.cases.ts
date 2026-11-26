import { FX } from '../_fixture-ids.js';
import type { IDeleteBusinessQuery } from '../../../../../modules/financial-entities/__generated__/businesses-operation.types.js';
import { caseFor, type Cases } from '../../../cases.js';

export const cases: Cases = {
  deleteBusiness: caseFor<IDeleteBusinessQuery>(s => [
    { businessId: FX.gamma }, // unreferenced
    { businessId: FX.eta }, // still referenced: 23503
    { businessId: s.businessId }, // the tenant itself: referenced everywhere
    { businessId: FX.theta }, // a financial entity without a businesses row
    { businessId: s.missingId },
    { businessId: null },
  ]),
};
