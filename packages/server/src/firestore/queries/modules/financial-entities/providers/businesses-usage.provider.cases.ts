import { FX } from '../_fixture-ids.js';
import type { IGetUsageCountsByBusinessIdsQuery } from '../../../../../modules/financial-entities/__generated__/businesses-usage.types.js';
import { caseFor, type Cases } from '../../../cases.js';

export const cases: Cases = {
  getUsageCountsByBusinessIds: caseFor<IGetUsageCountsByBusinessIdsQuery>(s => [
    {
      businessIds: [
        ...(s.values('transactions', 'business_id', 3) as string[]),
        FX.alpha,
        FX.beta,
        FX.eta,
        s.missingId,
      ],
    },
    { businessIds: [s.businessId] },
    { businessIds: [FX.gamma, null] },
  ]),
};
