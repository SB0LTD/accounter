import type {
  IDegradeChargeAccountantApprovalQuery,
  IGetChargesApprovalStatusQuery,
} from '../../../../../modules/accountant-approval/__generated__/accountant-approval.types.js';
import { caseFor, type Cases } from '../../../cases.js';
import { FX } from '../../documents/_fixture-ids.js';

export const cases: Cases = {
  getChargesApprovalStatus: caseFor<IGetChargesApprovalStatusQuery>(s => [
    // the demo year: 15 PENDING demo charges, the APPROVED fixture charge twice (two depreciation
    // rows), the UNAPPROVED one once; the empty APPROVED charge has no dates
    { ownerIds: [s.businessId], fromDate: '2024-01-01', toDate: '2024-12-31' },
    { ownerIds: [s.businessId], fromDate: '2024-07-01', toDate: '2024-12-31' },
    // ledger dates only (2023-06)
    { ownerIds: [s.businessId], fromDate: '2023-01-01', toDate: '2023-06-20' },
    // the OTHER document (2023-05-01) does not count while the charge has invoice-type documents
    { ownerIds: [s.businessId], fromDate: '2023-01-01', toDate: '2023-05-15' },
    { ownerIds: [s.businessId], fromDate: '2030-01-01', toDate: '2030-12-31' },
    { ownerIds: [s.missingId], fromDate: '2024-01-01', toDate: '2024-12-31' },
    { ownerIds: [s.businessId], fromDate: null, toDate: '2024-12-31' },
  ]),
  degradeChargeAccountantApproval: caseFor<IDegradeChargeAccountantApprovalQuery>(s => [
    { chargeId: FX.chargeApproved },
    // not APPROVED: untouched
    { chargeId: FX.chargeUnmatched },
    { chargeId: s.rows('charges').find(c => c.accountant_status === 'PENDING')?.id as string },
    { chargeId: s.missingId },
    { chargeId: null },
  ]),
};
